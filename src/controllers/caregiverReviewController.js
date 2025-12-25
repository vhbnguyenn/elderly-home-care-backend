const CaregiverReview = require('../models/CaregiverReview');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { ROLES } = require('../constants');

// @desc    Create a review (Caregiver reviews Careseeker)
// @route   POST /api/caregiver-reviews
// @access  Private (Caregiver only)
exports.createReview = async (req, res, next) => {
  try {
    const {
      bookingId,
      careseekerProfileId,
      elderlyProfileId,
      ratings,
      familySupport,
      issues,
      recommendation,
      additionalNotes
    } = req.body;

    // Validate: User phải là caregiver
    if (req.user.role !== ROLES.CAREGIVER) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ caregiver mới có thể tạo review này'
      });
    }

    // Kiểm tra booking có tồn tại và đã completed
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể review sau khi hoàn thành dịch vụ'
      });
    }

    // Kiểm tra caregiver có phải người làm việc trong booking này không
    if (booking.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền review booking này'
      });
    }

    // Kiểm tra đã review chưa
    const existingReview = await CaregiverReview.findOne({
      reviewer: req.user._id,
      booking: bookingId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã review booking này rồi'
      });
    }

    // Validate ratings
    if (!ratings || !ratings.cooperation || !ratings.communication || 
        !ratings.respect || !ratings.readiness || !ratings.workingEnvironment) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ tất cả các đánh giá'
      });
    }

    // Create review
    const review = await CaregiverReview.create({
      reviewer: req.user._id,
      careseeker: booking.careseeker,
      elderlyProfile: booking.elderlyProfile,
      booking: bookingId,
      ratings,
      familySupport,
      issues: issues || [],
      recommendation,
      additionalNotes
    });

    await review.populate([
      { path: 'careseeker', select: 'name email avatar' },
      { path: 'elderlyProfile', select: 'fullName age gender' },
      { path: 'booking', select: 'bookingDate bookingTime duration workLocation' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Tạo review thành công',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my reviews (reviews I created as caregiver)
// @route   GET /api/caregiver-reviews/my-reviews
// @access  Private (Caregiver)
exports.getMyReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    const reviews = await CaregiverReview.find({ reviewer: req.user._id })
      .populate('careseeker', 'name email avatar')
      .populate('elderlyProfile', 'fullName age gender')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CaregiverReview.countDocuments({ reviewer: req.user._id });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews about a careseeker
// @route   GET /api/caregiver-reviews/careseeker/:careseekerUserId
// @access  Public
exports.getCareseekerReviews = async (req, res, next) => {
  try {
    const { careseekerUserId } = req.params;
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    // Check if careseeker exists
    const careseeker = await User.findById(careseekerUserId);
    if (!careseeker || careseeker.role !== ROLES.CARESEEKER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy careseeker'
      });
    }

    const filterQuery = {
      careseeker: careseekerUserId,
      isVisible: true,
      status: 'active'
    };

    const reviews = await CaregiverReview.find(filterQuery)
      .populate('reviewer', 'name avatar')
      .populate('elderlyProfile', 'fullName age gender')
      .populate('booking', 'bookingDate duration')
      .select('-careseekerResponse') // Không hiển thị response cho public
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CaregiverReview.countDocuments(filterQuery);

    // Calculate statistics
    const stats = await CaregiverReview.aggregate([
      { $match: { careseeker: careseeker._id, isVisible: true, status: 'active' } },
      {
        $group: {
          _id: null,
          avgCooperation: { $avg: '$ratings.cooperation' },
          avgCommunication: { $avg: '$ratings.communication' },
          avgRespect: { $avg: '$ratings.respect' },
          avgReadiness: { $avg: '$ratings.readiness' },
          avgWorkingEnvironment: { $avg: '$ratings.workingEnvironment' },
          totalReviews: { $sum: 1 },
          recommendCount: {
            $sum: {
              $cond: [
                { $in: ['$recommendation', ['highly_recommend', 'recommend']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const reviewStats = stats[0] || {
      avgCooperation: 0,
      avgCommunication: 0,
      avgRespect: 0,
      avgReadiness: 0,
      avgWorkingEnvironment: 0,
      totalReviews: 0,
      recommendCount: 0
    };

    const overallAverage = stats[0] ? 
      ((reviewStats.avgCooperation + reviewStats.avgCommunication + 
        reviewStats.avgRespect + reviewStats.avgReadiness + 
        reviewStats.avgWorkingEnvironment) / 5).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          ...reviewStats,
          overallAverage,
          recommendationRate: reviewStats.totalReviews > 0 ? 
            ((reviewStats.recommendCount / reviewStats.totalReviews) * 100).toFixed(1) : 0
        },
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews received (for careseekers to see reviews about them)
// @route   GET /api/caregiver-reviews/received
// @access  Private (Careseeker)
exports.getReceivedReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    if (req.user.role !== ROLES.CARESEEKER) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ careseeker mới có thể xem reviews nhận được'
      });
    }

    const reviews = await CaregiverReview.find({ careseeker: req.user._id })
      .populate('reviewer', 'name avatar')
      .populate('elderlyProfile', 'fullName age gender')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CaregiverReview.countDocuments({ careseeker: req.user._id });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a review
// @route   PUT /api/caregiver-reviews/:id
// @access  Private (Caregiver - own review only)
exports.updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      ratings,
      familySupport,
      issues,
      recommendation,
      additionalNotes
    } = req.body;

    const review = await CaregiverReview.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    // Check ownership
    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật review này'
      });
    }

    // Update fields
    if (ratings) review.ratings = ratings;
    if (familySupport) review.familySupport = familySupport;
    if (issues !== undefined) review.issues = issues;
    if (recommendation) review.recommendation = recommendation;
    if (additionalNotes !== undefined) review.additionalNotes = additionalNotes;

    await review.save();
    await review.populate([
      { path: 'careseeker', select: 'name email avatar' },
      { path: 'elderlyProfile', select: 'fullName age gender' },
      { path: 'booking', select: 'bookingDate bookingTime duration workLocation' }
    ]);

    res.json({
      success: true,
      message: 'Cập nhật review thành công',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review
// @route   DELETE /api/caregiver-reviews/:id
// @access  Private (Caregiver - own review, or Admin)
exports.deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await CaregiverReview.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    // Check permission: owner or admin
    const isOwner = review.reviewer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa review này'
      });
    }

    await review.deleteOne();

    res.json({
      success: true,
      message: 'Xóa review thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Careseeker responds to a review
// @route   POST /api/caregiver-reviews/:id/response
// @access  Private (Careseeker - only for reviews about them)
exports.respondToReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { responseText } = req.body;

    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung phản hồi'
      });
    }

    const review = await CaregiverReview.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    // Check if the user is the careseeker being reviewed
    if (review.careseeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể phản hồi review về bạn'
      });
    }

    review.careseekerResponse = {
      text: responseText,
      respondedAt: new Date()
    };

    await review.save();

    res.json({
      success: true,
      message: 'Phản hồi review thành công',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single review detail
// @route   GET /api/caregiver-reviews/:id
// @access  Public
exports.getReviewDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await CaregiverReview.findById(id)
      .populate('reviewer', 'name avatar')
      .populate('careseeker', 'name avatar')
      .populate('elderlyProfile', 'fullName age gender')
      .populate('booking', 'bookingDate bookingTime duration workLocation');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    // Chỉ hiển thị review visible hoặc nếu là chủ sở hữu/admin
    const isOwner = req.user && review.reviewer.toString() === req.user._id.toString();
    const isCareseeker = req.user && review.careseeker._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === ROLES.ADMIN;

    if (!review.isVisible && !isOwner && !isCareseeker && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Review không tồn tại hoặc đã bị ẩn'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin toggle review visibility
// @route   PUT /api/caregiver-reviews/:id/toggle-visibility
// @access  Private (Admin only)
exports.toggleReviewVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await CaregiverReview.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    review.isVisible = !review.isVisible;
    review.status = review.isVisible ? 'active' : 'hidden';

    await review.save();

    res.json({
      success: true,
      message: `Review đã được ${review.isVisible ? 'hiển thị' : 'ẩn'}`,
      data: review
    });
  } catch (error) {
    next(error);
  }
};
