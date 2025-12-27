/**
 * ADDRESS PARSING CONTROLLER
 * ===========================
 *
 * Controller for parsing Vietnamese addresses using Groq AI
 * Provides address suggestions and parsing for frontend autocomplete
 */

const addressParsingService = require('../services/addressParsingService');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Parse Vietnamese address using Groq AI
 * @route   POST /api/parse-address
 * @access  Public (No authentication required for address parsing)
 */
exports.parseAddress = asyncHandler(async (req, res) => {
  const { text } = req.body;

  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Text is required and must be a non-empty string'
    });
  }

  if (text.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Text must be less than 500 characters'
    });
  }

  console.log(`📍 Parsing address: "${text}"`);

  try {
    // Call address parsing service
    const parsedAddress = await addressParsingService.parseAddress(text.trim());

    res.status(200).json({
      success: true,
      message: 'Address parsed successfully',
      data: {
        originalText: text,
        parsedAddress,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Address parsing error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to parse address',
      error: error.message
    });
  }
});

/**
 * @desc    Get address suggestions based on partial input
 * @route   POST /api/parse-address/suggestions
 * @access  Public
 */
exports.getAddressSuggestions = asyncHandler(async (req, res) => {
  const { text, maxSuggestions = 5 } = req.body;

  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Text is required and must be a non-empty string'
    });
  }

  if (text.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Text must be less than 200 characters'
    });
  }

  console.log(`💡 Getting address suggestions for: "${text}"`);

  try {
    // Call address suggestions service
    const suggestions = await addressParsingService.getAddressSuggestions(text.trim(), maxSuggestions);

    res.status(200).json({
      success: true,
      message: `Found ${suggestions.length} address suggestions`,
      data: {
        query: text,
        suggestions,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Address suggestions error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get address suggestions',
      error: error.message
    });
  }
});

module.exports = exports;
