const Booking = require('../models/Booking');
const CaregiverReview = require('../models/CaregiverReview');
const CareseekerReview = require('../models/CareseekerReview');
const User = require('../models/User');
const { ROLES } = require('../constants');

// @desc    Get reviews for a caregiver
// @route   GET /api/reviews/caregiver/:caregiverId
// @access  Public
exports.getCaregiverReviews = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;
    const { rating, packageType, sortBy = '-createdAt', page = 1, limit = 10 } = req.query;

    // Build filter query
    const filterQuery = {
      caregiver: caregiverId,
      status: 'completed',
      'review.rating': { $exists: true },
    };

    if (rating) {
      filterQuery['review.rating'] = Number(rating);
    }

    if (packageType) {
      filterQuery.packageType = packageType;
    }

    // Get reviews from completed bookings
    const reviews = await Booking.find(filterQuery)
      .populate('careseeker', 'name')
      .populate('elderlyProfile', 'fullName age')
      .select('review packageType createdAt updatedAt')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(filterQuery);

    // Calculate average rating
    const ratingStats = await Booking.aggregate([
      { $match: { caregiver: caregiverId, 'review.rating': { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$review.rating' },
          totalReviews: { $sum: 1 },
          ratings: {
            $push: '$review.rating',
          },
        },
      },
    ]);

    // Count ratings by star
    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    if (ratingStats.length > 0) {
      ratingStats[0].ratings.forEach((r) => {
        ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          averageRating: ratingStats[0]?.avgRating?.toFixed(1) || 0,
          totalReviews: ratingStats[0]?.totalReviews || 0,
          ratingDistribution,
        },
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews (Admin) - cả caregiver và careseeker reviews
// @route   GET /api/reviews/admin/all
// @access  Private (Admin only)
exports.getAllReviews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      type,
      status,
      isVisible,
      search
    } = req.query;

    let caregiverFilter = {};
    let careseekerFilter = {};
    
    if (status) {
      caregiverFilter.status = status;
      careseekerFilter.status = status;
    }
    if (isVisible !== undefined) {
      caregiverFilter.isVisible = isVisible === 'true';
      careseekerFilter.isVisible = isVisible === 'true';
    }
    
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      
      if (userIds.length === 0) {
        caregiverFilter._id = { $in: [] };
        careseekerFilter._id = { $in: [] };
      } else {
        caregiverFilter.$or = [
          { reviewer: { $in: userIds } },
          { careseeker: { $in: userIds } }
        ];
        careseekerFilter.$or = [
          { reviewer: { $in: userIds } },
          { caregiver: { $in: userIds } }
        ];
      }
    }

    // Lấy reviews dựa trên type
    let caregiverReviews = [];
    let careseekerReviews = [];
    let totalCount = 0;

    if (!type || type === 'caregiver') {
      caregiverReviews = await CaregiverReview.find(caregiverFilter)
        .populate('reviewer', 'name email avatar role')
        .populate('careseeker', 'name email avatar role')
        .populate('elderlyProfile', 'fullName age gender')
        .populate('booking', 'bookingDate bookingTime duration workLocation')
        .sort(sortBy)
        .lean();
    }

    if (!type || type === 'careseeker') {
      careseekerReviews = await CareseekerReview.find(careseekerFilter)
        .populate('reviewer', 'name email avatar role')
        .populate('caregiver', 'name email avatar role')
        .populate('caregiverProfile', 'specializations experience hourlyRate')
        .populate('booking', 'bookingDate bookingTime duration workLocation')
        .sort(sortBy)
        .lean();
    }

    // Gộp và sắp xếp lại
    const allReviews = [
      ...caregiverReviews.map(r => ({ ...r, reviewType: 'caregiver' })),
      ...careseekerReviews.map(r => ({ ...r, reviewType: 'careseeker' }))
    ].sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortBy.startsWith('-') ? dateB - dateA : dateA - dateB;
    });

    totalCount = allReviews.length;
    const paginatedReviews = allReviews.slice((page - 1) * limit, page * limit);

    // Statistics
    const caregiverStats = await CaregiverReview.aggregate([
      { $match: caregiverFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgCooperation: { $avg: '$ratings.cooperation' },
          avgCommunication: { $avg: '$ratings.communication' }
        }
      }
    ]);

    const careseekerStats = await CareseekerReview.aggregate([
      { $match: careseekerFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgProfessionalism: { $avg: '$ratings.professionalism' },
          avgCareQuality: { $avg: '$ratings.careQuality' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        reviews: paginatedReviews,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / limit),
          total: totalCount
        },
        statistics: {
          caregiverReviews: caregiverStats[0]?.total || 0,
          careseekerReviews: careseekerStats[0]?.total || 0,
          totalReviews: (caregiverStats[0]?.total || 0) + (careseekerStats[0]?.total || 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get review detail (Admin) - tự động detect loại review
// @route   GET /api/reviews/admin/:id
// @access  Private (Admin only)
exports.getReviewDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Thử tìm trong caregiver reviews trước
    let review = await CaregiverReview.findById(id)
      .populate('reviewer', 'name email avatar role')
      .populate('careseeker', 'name email avatar role')
      .populate('elderlyProfile', 'fullName age gender')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .lean();

    let reviewType = 'caregiver';

    // Nếu không tìm thấy, thử tìm trong careseeker reviews
    if (!review) {
      review = await CareseekerReview.findById(id)
        .populate('reviewer', 'name email avatar role')
        .populate('caregiver', 'name email avatar role')
        .populate('caregiverProfile', 'specializations experience hourlyRate')
        .populate('booking', 'bookingDate bookingTime duration workLocation')
        .lean();
      reviewType = 'careseeker';
    }

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy review'
      });
    }

    res.json({
      success: true,
      data: {
        ...review,
        reviewType
      }
    });
  } catch (error) {
    next(error);
  }
};
