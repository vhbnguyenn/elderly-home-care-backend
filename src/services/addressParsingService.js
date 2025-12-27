/**
 * ADDRESS PARSING SERVICE
 * =======================
 *
 * Sử dụng Groq API để parse và suggest địa chỉ tiếng Việt
 * Tương tự như Grab, giúp tự động suggest địa chỉ khi người dùng nhập
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Sử dụng model nhanh và hiệu quả cho parsing
const GROQ_MODEL = 'llama-3.1-8b-instant';

/**
 * Parse Vietnamese address text using Groq AI
 * @param {string} text - Raw address text input
 * @returns {object} Parsed address components
 */
async function parseAddress(text) {
  try {
    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    // Build prompt for address parsing
    const prompt = buildAddressParsingPrompt(text);

    // Call Groq API
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI system for parsing Vietnamese addresses. You understand Vietnamese geography, administrative divisions, and address formats. Always respond with structured JSON data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 1000,
        response_format: { type: 'json_object' } // Force JSON response
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000 // 20 second timeout
      }
    );

    // Parse response
    const aiResponse = response.data.choices[0].message.content;
    console.log('📍 Groq AI Address Parsing Response:', aiResponse);

    const parsedResult = JSON.parse(aiResponse);

    // Validate and normalize response
    return normalizeParsedAddress(parsedResult, text);

  } catch (error) {
    console.error('Address parsing API Error:', error.message);

    // Handle specific errors
    if (error.response) {
      console.error('API Response Error:', error.response.data);
      throw new Error(`Groq API Error: ${error.response.data.error?.message || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Address parsing timeout. Please try again.');
    } else {
      throw new Error(`Address parsing failed: ${error.message}`);
    }
  }
}

/**
 * Get address suggestions based on partial input
 * @param {string} text - Partial address text
 * @param {number} maxSuggestions - Maximum number of suggestions
 * @returns {array} Array of address suggestions
 */
async function getAddressSuggestions(text, maxSuggestions = 5) {
  try {
    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    // Build prompt for suggestions
    const prompt = buildAddressSuggestionsPrompt(text, maxSuggestions);

    // Call Groq API
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI system for Vietnamese address autocomplete. Provide helpful, accurate address suggestions based on partial input. Focus on common Vietnamese locations and addresses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Slightly higher temperature for creative suggestions
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000 // 25 second timeout for suggestions
      }
    );

    // Parse response
    const aiResponse = response.data.choices[0].message.content;
    console.log('💡 Groq AI Address Suggestions Response:', aiResponse);

    const suggestionsResult = JSON.parse(aiResponse);

    // Validate and normalize suggestions
    return normalizeAddressSuggestions(suggestionsResult, text);

  } catch (error) {
    console.error('Address suggestions API Error:', error.message);

    // Handle specific errors
    if (error.response) {
      console.error('API Response Error:', error.response.data);
      throw new Error(`Groq API Error: ${error.response.data.error?.message || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Address suggestions timeout. Please try again.');
    } else {
      throw new Error(`Address suggestions failed: ${error.message}`);
    }
  }
}

/**
 * Build prompt for address parsing
 */
function buildAddressParsingPrompt(text) {
  return `
ANALYZE THIS VIETNAMESE ADDRESS TEXT:
"${text}"

TASK:
Parse the address into structured components following Vietnamese administrative divisions.

VIETNAMESE ADDRESS FORMAT RULES:
- Addresses typically follow: [House Number] [Street/Road] [Ward/Phường] [District/Quận] [City/Province/Tỉnh]
- Common abbreviations:
  * Phường = Ward (Urban)
  * Xã = Commune (Rural)
  * Quận = District (Urban)
  * Huyện = District (Rural)
  * Thị xã = Town
  * Thành phố = City
  * Tỉnh = Province

EXTRACTION RULES:
1. Extract house number/street number if present
2. Extract street/road name
3. Extract ward/phường/xã
4. Extract district/quận/huyện
5. Extract city/province/thành phố/tỉnh
6. Extract any landmarks or notable buildings
7. Extract postal code if present (Vietnam postal codes are 5-6 digits)

Be flexible with:
- Typos and variations (e.g., "Tp.HCM" = "Thành phố Hồ Chí Minh")
- Missing components (leave as null)
- Order variations (Vietnamese addresses can be written in different orders)
- Abbreviations and full names

Return response in this EXACT JSON format:
{
  "parsed": {
    "houseNumber": "123" | null,
    "street": "Đường Nguyễn Huệ" | null,
    "ward": "Phường Bến Nghé" | null,
    "district": "Quận 1" | null,
    "city": "Thành phố Hồ Chí Minh" | null,
    "province": "Thành phố Hồ Chí Minh" | null,
    "postalCode": "70000" | null,
    "landmarks": ["Landmark 1", "Landmark 2"] | [],
    "fullAddress": "Normalized full address string",
    "confidence": 0.0-1.0
  },
  "alternatives": [
    {
      "houseNumber": "...",
      "street": "...",
      "ward": "...",
      "district": "...",
      "city": "...",
      "province": "...",
      "fullAddress": "...",
      "confidence": 0.8
    }
  ]
}
`;
}

/**
 * Build prompt for address suggestions
 */
function buildAddressSuggestionsPrompt(text, maxSuggestions) {
  return `
GENERATE VIETNAMESE ADDRESS SUGGESTIONS for partial input:
"${text}"

CONTEXT:
- User is typing an address in Vietnam
- Provide realistic, commonly used addresses
- Focus on major cities: Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ
- Include both urban (phường/quận) and rural (xã/huyện) addresses

SUGGESTION RULES:
1. Complete the partial address with logical extensions
2. Provide ${maxSuggestions} relevant suggestions
3. Include full, properly formatted addresses
4. Consider common Vietnamese locations and streets
5. If input looks like a street, suggest wards/districts
6. If input looks like a ward/district, suggest cities
7. Include popular landmarks and commercial areas

EXAMPLES:
Input: "Nguyen Hue"
Suggestions:
- "Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
- "Đường Nguyễn Huệ, Phường Lê Lợi, Thành phố Vinh, Nghệ An"
- "Đường Nguyễn Huệ, Phường Đồng Tâm, Thành phố Phan Thiết, Bình Thuận"

Input: "Quan 1"
Suggestions:
- "Quận 1, Thành phố Hồ Chí Minh"
- "Quận 1, Thành phố Hà Nội"
- "Quận 1, Thành phố Hải Phòng"

Return response in this EXACT JSON format:
{
  "suggestions": [
    {
      "text": "Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh",
      "parsed": {
        "street": "Đường Nguyễn Huệ",
        "ward": "Phường Bến Nghé",
        "district": "Quận 1",
        "city": "Thành phố Hồ Chí Minh"
      },
      "relevance": 0.95
    },
    {
      "text": "Đường Nguyễn Huệ, Phường Lê Lợi, Thành phố Vinh, Nghệ An",
      "parsed": {
        "street": "Đường Nguyễn Huệ",
        "ward": "Phường Lê Lợi",
        "city": "Thành phố Vinh",
        "province": "Nghệ An"
      },
      "relevance": 0.85
    }
  ]
}
`;
}

/**
 * Normalize parsed address response
 */
function normalizeParsedAddress(result, originalText) {
  const parsed = result.parsed || {};

  // Ensure required fields exist
  const normalized = {
    houseNumber: parsed.houseNumber || null,
    street: parsed.street || null,
    ward: parsed.ward || null,
    district: parsed.district || null,
    city: parsed.city || null,
    province: parsed.province || null,
    postalCode: parsed.postalCode || null,
    landmarks: Array.isArray(parsed.landmarks) ? parsed.landmarks : [],
    fullAddress: parsed.fullAddress || originalText,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
  };

  // Add alternatives if provided
  const alternatives = Array.isArray(result.alternatives) ? result.alternatives : [];

  return {
    ...normalized,
    alternatives: alternatives.slice(0, 3) // Limit to 3 alternatives
  };
}

/**
 * Normalize address suggestions response
 */
function normalizeAddressSuggestions(result, query) {
  const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];

  // Ensure each suggestion has required fields
  return suggestions.slice(0, 10).map(suggestion => ({
    text: suggestion.text || '',
    parsed: {
      houseNumber: suggestion.parsed?.houseNumber || null,
      street: suggestion.parsed?.street || null,
      ward: suggestion.parsed?.ward || null,
      district: suggestion.parsed?.district || null,
      city: suggestion.parsed?.city || null,
      province: suggestion.parsed?.province || null,
      postalCode: suggestion.parsed?.postalCode || null
    },
    relevance: typeof suggestion.relevance === 'number' ? suggestion.relevance : 0.5
  }));
}

module.exports = {
  parseAddress,
  getAddressSuggestions
};
