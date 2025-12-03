const aiService = require('../services/aiService');
const CaregiverProfile = require('../models/CaregiverProfile');

exports.chatbot = async (req, res, next) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const response = await aiService.chatbot(message, conversationHistory || []);

    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.recommendCaregiver = async (req, res, next) => {
  try {
    const { elderlyProfile } = req.body;

    if (!elderlyProfile) {
      return res.status(400).json({
        success: false,
        message: 'Elderly profile is required',
      });
    }

    // Get available caregivers
    const caregivers = await CaregiverProfile.find({
      status: 'approved',
      isAvailable: true,
    }).select('fullName yearsOfExperience specializations languages rating');

    if (caregivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No available caregivers found',
      });
    }

    const recommendations = await aiService.recommendCaregiver(
      elderlyProfile,
      caregivers.map((c) => c.toObject())
    );

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

exports.generateCareplan = async (req, res, next) => {
  try {
    const { elderlyProfile } = req.body;

    if (!elderlyProfile) {
      return res.status(400).json({
        success: false,
        message: 'Elderly profile is required',
      });
    }

    const careplan = await aiService.generateCareplan(elderlyProfile);

    res.json({
      success: true,
      data: careplan,
    });
  } catch (error) {
    next(error);
  }
};

exports.analyzeHealthConcerns = async (req, res, next) => {
  try {
    const { symptoms } = req.body;

    if (!symptoms) {
      return res.status(400).json({
        success: false,
        message: 'Symptoms description is required',
      });
    }

    const analysis = await aiService.analyzeHealthConcerns(symptoms);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
};
