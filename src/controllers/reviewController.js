const Booking = require('../models/Booking');

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
