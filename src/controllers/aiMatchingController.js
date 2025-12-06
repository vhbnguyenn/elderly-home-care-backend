const aiMatchingService = require('../services/aiMatchingService');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * AI Matching Controller
 * Handles caregiver matching requests
 */

/**
 * @desc    Find matching caregivers using AI
 * @route   POST /api/ai-matching/find-caregivers
 * @access  Private (Careseeker only)
 */
exports.findMatchingCaregivers = asyncHandler(async (req, res) => {
  const careseekerId = req.user._id;

  const {
    requiredSkills = [],
    preferredSkills = [],
    careLevel = 1,
    timeSlots = [],
    maxDistance = 50,
    budgetPerHour = null,
    minRating = 0,
    minExperience = 0,
    genderPreference = null,
    ageRange = null,
    healthConditions = [],
    topN = 10,
    useLearning = true
  } = req.body;

  // Validate care level
  if (careLevel < 1 || careLevel > 3) {
    return res.status(400).json({
      success: false,
      message: 'Care level must be between 1 and 3'
    });
  }

  // Validate time slots format
  if (timeSlots.length > 0) {
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const isValidTimeSlots = timeSlots.every(slot => 
      validDays.includes(slot.day?.toLowerCase()) &&
      slot.startTime &&
      slot.endTime &&
      /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.startTime) &&
      /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.endTime)
    );

    if (!isValidTimeSlots) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time slots format. Expected: [{day: "monday", startTime: "08:00", endTime: "12:00"}]'
      });
    }
  }

  // Find matching caregivers
  const matchedCaregivers = await aiMatchingService.findMatchingCaregivers({
    careseekerId,
    requiredSkills,
    preferredSkills,
    careLevel,
    timeSlots,
    maxDistance,
    budgetPerHour,
    minRating,
    minExperience,
    genderPreference,
    ageRange,
    healthConditions,
    topN,
    useLearning
  });

  res.status(200).json({
    success: true,
    count: matchedCaregivers.length,
    data: matchedCaregivers,
    meta: {
      careseekerId,
      learningEnabled: useLearning,
      requestedTopN: topN,
      filters: {
        careLevel,
        requiredSkills: requiredSkills.length,
        preferredSkills: preferredSkills.length,
        timeSlots: timeSlots.length,
        minRating,
        minExperience
      }
    }
  });
});

/**
 * @desc    Get quick matches (simplified version)
 * @route   GET /api/ai-matching/quick-match
 * @access  Private (Careseeker only)
 */
exports.getQuickMatches = asyncHandler(async (req, res) => {
  const careseekerId = req.user._id;

  // Quick match với minimal filters
  const matchedCaregivers = await aiMatchingService.findMatchingCaregivers({
    careseekerId,
    topN: 5,
    useLearning: true
  });

  res.status(200).json({
    success: true,
    count: matchedCaregivers.length,
    data: matchedCaregivers
  });
});

/**
 * @desc    Get recommended caregivers based on user history
 * @route   GET /api/ai-matching/recommendations
 * @access  Private (Careseeker only)
 */
exports.getRecommendations = asyncHandler(async (req, res) => {
  const careseekerId = req.user._id;
  const { limit = 10 } = req.query;

  const recommendations = await aiMatchingService.findMatchingCaregivers({
    careseekerId,
    topN: parseInt(limit),
    useLearning: true // Bật learning để sử dụng user preference
  });

  res.status(200).json({
    success: true,
    message: 'Personalized recommendations based on your booking history',
    count: recommendations.length,
    data: recommendations
  });
});

/**
 * @desc    Get matching statistics
 * @route   GET /api/ai-matching/stats
 * @access  Private (Admin only)
 */
exports.getMatchingStats = asyncHandler(async (req, res) => {
  const CaregiverProfile = require('../models/CaregiverProfile');
  const Booking = require('../models/Booking');

  const [totalCaregivers, approvedCaregivers, totalBookings] = await Promise.all([
    CaregiverProfile.countDocuments(),
    CaregiverProfile.countDocuments({ profileStatus: 'approved' }),
    Booking.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCaregivers,
      approvedCaregivers,
      pendingApproval: totalCaregivers - approvedCaregivers,
      totalBookings,
      matchingAlgorithm: {
        version: '2.0',
        features: [
          'Semantic skill matching',
          'User preference learning',
          'Dynamic weight adjustment',
          'Bayesian rating system',
          'Real-time availability check'
        ]
      }
    }
  });
});

/**
 * @desc    Test semantic similarity
 * @route   POST /api/ai-matching/test-similarity
 * @access  Private (Admin only)
 */
exports.testSemanticSimilarity = asyncHandler(async (req, res) => {
  const { skill1, skill2 } = req.body;

  if (!skill1 || !skill2) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both skill1 and skill2'
    });
  }

  const similarity = aiMatchingService.calculateSemanticSimilarity(skill1, skill2);

  res.status(200).json({
    success: true,
    data: {
      skill1,
      skill2,
      similarity: Math.round(similarity * 100) / 100,
      percentage: Math.round(similarity * 100) + '%',
      isMatch: similarity >= 0.75,
      threshold: 0.75
    }
  });
});

/**
 * @desc    Clear similarity cache
 * @route   DELETE /api/ai-matching/cache
 * @access  Private (Admin only)
 */
exports.clearCache = asyncHandler(async (req, res) => {
  const NodeCache = require('node-cache');
  const cache = new NodeCache();
  
  const keys = cache.keys();
  cache.flushAll();

  res.status(200).json({
    success: true,
    message: `Cleared ${keys.length} cached similarity scores`
  });
});
