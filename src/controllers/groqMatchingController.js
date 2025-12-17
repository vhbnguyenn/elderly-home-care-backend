/**
 * GROQ AI MATCHING CONTROLLER
 * ============================
 * 
 * Controller for Groq API-based caregiver matching
 * Uses LLaMA model via Groq for intelligent matching
 */

const groqMatchingService = require('../services/groqMatchingService');
const { asyncHandler } = require('../middlewares/errorHandler');
const User = require('../models/User');
const CaregiverSkill = require('../models/CaregiverSkill');
const CaregiverAvailability = require('../models/CaregiverAvailability');
const CaregiverProfile = require('../models/CaregiverProfile');
const Package = require('../models/Package');
const UserPreference = require('../models/UserPreference');

/**
 * @desc    Find matching caregivers using Groq AI
 * @route   POST /api/groq-matching/find-caregivers
 * @access  Private (Careseeker only)
 */
exports.findMatchingCaregivers = asyncHandler(async (req, res) => {
  const careseekerId = req.user._id;
  const {
    packageId,
    preferences = {},
    maxResults = 5
  } = req.body;

  // Validate package
  if (!packageId) {
    return res.status(400).json({
      success: false,
      message: 'Package ID is required'
    });
  }

  // Get package details
  const packageData = await Package.findById(packageId);
  if (!packageData) {
    return res.status(404).json({
      success: false,
      message: 'Package not found'
    });
  }

  // Get careseeker info
  const careseeker = await User.findById(careseekerId);
  if (!careseeker) {
    return res.status(404).json({
      success: false,
      message: 'Careseeker not found'
    });
  }

  // Get careseeker preferences (if saved)
  let savedPreferences = null;
  try {
    savedPreferences = await UserPreference.findOne({ userId: careseekerId });
  } catch (error) {
    // Preferences are optional
  }

  // Merge saved preferences with request preferences
  const finalPreferences = {
    ...savedPreferences?.toObject(),
    ...preferences
  };

  // Get all available caregivers
  const caregivers = await User.find({ role: 'caregiver', isActive: true }).lean();

  if (caregivers.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No caregivers available'
    });
  }

  // Get skills and availability for each caregiver
  const caregiversWithDetails = await Promise.all(
    caregivers.map(async (caregiver) => {
      // Get skills
      const skills = await CaregiverSkill.find({
        userId: caregiver._id
      }).lean();

      // Get availability
      const availability = await CaregiverAvailability.findOne({
        userId: caregiver._id
      }).lean();

      // Get caregiver profile
      const profile = await CaregiverProfile.findOne({
        user: caregiver._id
      }).lean();

      return {
        ...caregiver,
        profile,
        skills,
        availability
      };
    })
  );

  // Prepare data for Groq API
  const careseekerData = {
    age: careseeker.age || 65,
    location: {
      address: 'Not specified',
      coordinates: [0, 0]
    },
    packageType: packageData.packageType,
    packagePrice: packageData.price,
    packageServices: packageData.services,
    packageDuration: packageData.duration,
    preferences: finalPreferences
  };

  // Call Groq AI service
  console.log(`🤖 Calling Groq AI for matching (${caregiversWithDetails.length} caregivers)...`);
  
  const matches = await groqMatchingService.getTopMatches(
    careseekerData,
    caregiversWithDetails.slice(0, 20) // Limit to 20 to avoid token limits
  );

  // Return top matches
  const topMatches = matches.slice(0, maxResults);

  res.status(200).json({
    success: true,
    message: `Found ${topMatches.length} matching caregivers using Groq AI`,
    data: {
      matches: topMatches,
      totalCaregivers: caregiversWithDetails.length,
      packageInfo: {
        name: packageData.name,
        type: packageData.packageType,
        price: packageData.price,
        duration: packageData.duration
      }
    },
    meta: {
      aiProvider: 'Groq (LLaMA 3.1 8B instant)',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * @desc    Compare Groq AI vs Rule-based matching
 * @route   POST /api/groq-matching/compare
 * @access  Private (Careseeker only)
 */
exports.compareMatching = asyncHandler(async (req, res) => {
  const careseekerId = req.user._id;
  const { packageId } = req.body;

  if (!packageId) {
    return res.status(400).json({
      success: false,
      message: 'Package ID is required'
    });
  }

  // Get package and careseeker
  const [packageData, careseeker] = await Promise.all([
    Package.findById(packageId),
    User.findById(careseekerId)
  ]);

  if (!packageData || !careseeker) {
    return res.status(404).json({
      success: false,
      message: 'Package or careseeker not found'
    });
  }

  // Get caregivers
  const caregivers = await User.find({ role: 'caregiver', isActive: true }).lean();

  const caregiversWithDetails = await Promise.all(
    caregivers.map(async (caregiver) => {
      const skills = await CaregiverSkill.find({ userId: caregiver._id }).lean();
      const availability = await CaregiverAvailability.findOne({ userId: caregiver._id }).lean();
      const profile = await CaregiverProfile.findOne({ user: caregiver._id }).lean();
      return { ...caregiver, profile, skills, availability };
    })
  );

  // Prepare data
  const careseekerData = {
    age: careseeker.age || 65,
    location: {
      address: 'Not specified',
      coordinates: [0, 0]
    },
    packageType: packageData.packageType,
    packagePrice: packageData.price,
    packageServices: packageData.services,
    packageDuration: packageData.duration,
    preferences: {}
  };

  // Get Groq matches
  console.log('🤖 Getting Groq AI matches...');
  const startGroq = Date.now();
  const groqMatches = await groqMatchingService.getTopMatches(
    careseekerData,
    caregiversWithDetails.slice(0, 20)
  );
  const groqTime = Date.now() - startGroq;

  // Get rule-based matches (if available)
  let ruleMatches = [];
  let ruleTime = 0;
  try {
    const aiMatchingService = require('../services/aiMatchingService');
    const startRule = Date.now();
    ruleMatches = await aiMatchingService.findBestMatches(careseekerId, {
      requiredSkills: packageData.services || [],
      topN: 5
    });
    ruleTime = Date.now() - startRule;
  } catch (error) {
    console.error('Rule-based matching not available:', error.message);
  }

  res.status(200).json({
    success: true,
    message: 'Comparison complete',
    data: {
      groq: {
        matches: groqMatches.slice(0, 5),
        responseTime: groqTime,
        provider: 'Groq (LLaMA 3.1 70B)'
      },
      ruleBased: {
        matches: ruleMatches.slice(0, 5),
        responseTime: ruleTime,
        provider: 'Rule-based Algorithm'
      }
    }
  });
});

/**
 * @desc    Test Groq API connection
 * @route   GET /api/groq-matching/test
 * @access  Public
 */
exports.testGroqConnection = asyncHandler(async (req, res) => {
  // Check if API key exists
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'GROQ_API_KEY not configured in environment variables'
    });
  }

  try {
    // Lấy 1 caregiver thật từ DB (nếu không có, trả lỗi)
    const caregiver = await User.findOne({ role: 'caregiver', isActive: true }).lean();
    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'No caregivers found in database for test'
      });
    }

    const skills = await CaregiverSkill.find({ userId: caregiver._id }).lean();
    const availability = await CaregiverAvailability.findOne({ userId: caregiver._id }).lean();
    const profile = await CaregiverProfile.findOne({ user: caregiver._id }).lean();

    const testCaregiver = {
      ...caregiver,
      profile,
      skills,
      availability
    };

    // Test data đơn giản
    const testData = {
      age: 70,
      location: {
        address: 'Not specified',
        coordinates: [0, 0]
      },
      packageType: 'professional',
      packagePrice: 500000,
      packageServices: ['Chăm sóc cơ bản', 'Nấu ăn'],
      packageDuration: 4,
      preferences: {}
    };

    console.log('🧪 Testing Groq API connection with real caregiver from DB...');
    const result = await groqMatchingService.getTopMatches(testData, [testCaregiver]);
    
    res.status(200).json({
      success: true,
      message: 'Groq API is working correctly',
      data: {
        apiKey: '***' + process.env.GROQ_API_KEY.slice(-4),
        testResult: result,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Groq API test failed',
      error: error.message
    });
  }
});

module.exports = exports;

