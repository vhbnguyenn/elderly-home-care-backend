const CareseekerReview = require('../models/CareseekerReview');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { ROLES } = require('../constants');

// @desc    Create a review (Careseeker reviews Caregiver)
// @route   POST /api/careseeker-reviews
// @access  Private (Careseeker only)
exports.createReview = async (req, res, next) => {
  try {
    const {
      bookingId,
      ratings,
      overallSatisfaction,
      strengths,
      improvements,
      wouldUseAgain,
      additionalNotes
    } = req.body;

    // Validate: User phải là careseeker
    if (req.user.role !== ROLES.CARESEEKER) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ careseeker mới có thể tạo review này'
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

    // Kiểm tra careseeker có phải người đặt booking này không
    if (booking.careseeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền review booking này'
      });
    }

    // Kiểm tra đã review chưa
    const existingReview = await CareseekerReview.findOne({
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
    if (!ratings || !ratings.professionalism || !ratings.attitude || 
        !ratings.punctuality || !ratings.careQuality || !ratings.communication) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ tất cả các đánh giá'
      });
    }

    // Create review
    const review = await CareseekerReview.create({
      reviewer: req.user._id,
      caregiver: booking.caregiver,
      caregiverProfile: booking.caregiverProfile,
      booking: bookingId,
      ratings,
      overallSatisfaction,
      strengths: strengths || [],
      improvements: improvements || [],
      wouldUseAgain,
      additionalNotes
    });

    await review.populate([
      { path: 'caregiver', select: 'name email avatar' },
      { path: 'caregiverProfile', select: 'specializations experience hourlyRate' },
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

// @desc    Get my reviews (reviews I created as careseeker)
// @route   GET /api/careseeker-reviews/my-reviews
// @access  Private (Careseeker)
exports.getMyReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    const reviews = await CareseekerReview.find({ reviewer: req.user._id })
      .populate('caregiver', 'name email avatar')
      .populate('caregiverProfile', 'specializations experience hourlyRate')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CareseekerReview.countDocuments({ reviewer: req.user._id });

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

// @desc    Get reviews about a caregiver
// @route   GET /api/careseeker-reviews/caregiver/:caregiverUserId
// @access  Public
exports.getCaregiverReviews = async (req, res, next) => {
  try {
    const { caregiverUserId } = req.params;
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    // Check if caregiver exists
    const caregiver = await User.findById(caregiverUserId);
    if (!caregiver || caregiver.role !== ROLES.CAREGIVER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver'
      });
    }

    const filterQuery = {
      caregiver: caregiverUserId,
      isVisible: true,
      status: 'active'
    };

    const reviews = await CareseekerReview.find(filterQuery)
      .populate('reviewer', 'name avatar')
      .populate('booking', 'bookingDate duration')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CareseekerReview.countDocuments(filterQuery);

    // Calculate statistics
    const stats = await CareseekerReview.aggregate([
      { $match: { caregiver: caregiver._id, isVisible: true, status: 'active' } },
      {
        $group: {
          _id: null,
          avgProfessionalism: { $avg: '$ratings.professionalism' },
          avgAttitude: { $avg: '$ratings.attitude' },
          avgPunctuality: { $avg: '$ratings.punctuality' },
          avgCareQuality: { $avg: '$ratings.careQuality' },
          avgCommunication: { $avg: '$ratings.communication' },
          totalReviews: { $sum: 1 },
          wouldUseAgainCount: {
            $sum: {
              $cond: [
                { $in: ['$wouldUseAgain', ['definitely', 'probably']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const reviewStats = stats[0] || {
      avgProfessionalism: 0,
      avgAttitude: 0,
      avgPunctuality: 0,
      avgCareQuality: 0,
      avgCommunication: 0,
      totalReviews: 0,
      wouldUseAgainCount: 0
    };

    const overallAverage = stats[0] ? 
      ((reviewStats.avgProfessionalism + reviewStats.avgAttitude + 
        reviewStats.avgPunctuality + reviewStats.avgCareQuality + 
        reviewStats.avgCommunication) / 5).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          ...reviewStats,
          overallAverage,
          wouldUseAgainRate: reviewStats.totalReviews > 0 ? 
            ((reviewStats.wouldUseAgainCount / reviewStats.totalReviews) * 100).toFixed(1) : 0
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

// @desc    Get reviews received (for caregivers to see reviews about them)
// @route   GET /api/careseeker-reviews/received
// @access  Private (Caregiver)
exports.getReceivedReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    if (req.user.role !== ROLES.CAREGIVER) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ caregiver mới có thể xem reviews nhận được'
      });
    }

    const reviews = await CareseekerReview.find({ caregiver: req.user._id })
      .populate('reviewer', 'name avatar')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CareseekerReview.countDocuments({ caregiver: req.user._id });

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

// @desc    Get a single review detail
// @route   GET /api/careseeker-reviews/:id
// @access  Public
exports.getReviewDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await CareseekerReview.findById(id)
      .populate('reviewer', 'name avatar')
      .populate('caregiver', 'name avatar')
      .populate('caregiverProfile', 'specializations experience hourlyRate')
      .populate('booking', 'bookingDate bookingTime duration workLocation');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    // Chỉ hiển thị review visible hoặc nếu là chủ sở hữu/admin
    const isOwner = req.user && review.reviewer.toString() === req.user._id.toString();
    const isCaregiver = req.user && review.caregiver._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === ROLES.ADMIN;

    if (!review.isVisible && !isOwner && !isCaregiver && !isAdmin) {
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

// @desc    Update a review
// @route   PUT /api/careseeker-reviews/:id
// @access  Private (Careseeker - own review only)
exports.updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      ratings,
      overallSatisfaction,
      strengths,
      improvements,
      wouldUseAgain,
      additionalNotes
    } = req.body;

    const review = await CareseekerReview.findById(id);

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
    if (overallSatisfaction) review.overallSatisfaction = overallSatisfaction;
    if (strengths !== undefined) review.strengths = strengths;
    if (improvements !== undefined) review.improvements = improvements;
    if (wouldUseAgain) review.wouldUseAgain = wouldUseAgain;
    if (additionalNotes !== undefined) review.additionalNotes = additionalNotes;

    await review.save();
    await review.populate([
      { path: 'caregiver', select: 'name email avatar' },
      { path: 'caregiverProfile', select: 'specializations experience hourlyRate' },
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

// @desc    Admin toggle review visibility
// @route   PUT /api/careseeker-reviews/:id/toggle-visibility
// @access  Private (Admin only)
exports.toggleReviewVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await CareseekerReview.findById(id);

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
