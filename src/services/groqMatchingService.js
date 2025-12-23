/**
 * GROQ AI MATCHING SERVICE
 * ========================
 * 
 * Sử dụng Groq API (LLaMA model) để match caregivers với careseekers
 * Không cần training, chỉ cần API key
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Model dùng trên Groq
const GROQ_MODEL = 'llama-3.1-8b-instant';

/**
 * Get top caregiver matches using Groq AI
 */
async function getTopMatches(careseekerData, caregivers) {
  try {
    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    // Build prompt for Groq
    const prompt = buildMatchingPrompt(careseekerData, caregivers);

    // Call Groq API
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI system for matching caregivers with elderly care seekers. Analyze caregiver profiles and careseeker needs to provide the best matches with detailed reasoning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Low temperature for consistent results
        max_tokens: 2000,
        response_format: { type: 'json_object' } // Force JSON response
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Parse response
    const aiResponse = response.data.choices[0].message.content;
    const matchResults = JSON.parse(aiResponse);

    // Return top matches with caregiver details
    return matchResults.matches.map(match => {
      const caregiver = caregivers.find(c => c._id.toString() === match.caregiverId);
      return {
        caregiver: caregiver || match.caregiverId,
        matchScore: match.score,
        reasons: match.reasons,
        aiAnalysis: match.analysis
      };
    });

  } catch (error) {
    console.error('Groq API Error:', error.message);
    
    // Handle specific errors
    if (error.response) {
      console.error('API Response Error:', error.response.data);
      throw new Error(`Groq API Error: ${error.response.data.error?.message || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Groq API timeout. Please try again.');
    } else {
      throw new Error(`Groq matching failed: ${error.message}`);
    }
  }
}

/**
 * Build detailed prompt for Groq AI
 */
function buildMatchingPrompt(careseekerData, caregivers) {
  const {
    age,
    location,
    packageType,
    packagePrice,
    packageServices,
    packageDuration,
    preferences = {}
  } = careseekerData;

  // Build careseeker info section
  const careseekerInfo = `
CARESEEKER PROFILE:
-------------------
- Age: ${age} years old
- Location: ${location.address || 'Not specified'}
- Coordinates: (${location.coordinates?.[0] || 0}, ${location.coordinates?.[1] || 0})

SERVICE PACKAGE:
- Type: ${packageType}
- Price: ${packagePrice} VND
- Duration: ${packageDuration} hours
- Services needed: ${packageServices?.join(', ') || 'Not specified'}

PREFERENCES:
- Gender preference: ${preferences.gender || 'No preference'}
- Min experience: ${preferences.experienceYears || 0} years
- Language: ${preferences.language || 'Vietnamese'}
- Special requirements: ${preferences.specialRequirements || 'None'}
`;

  // Build caregivers info section (ưu tiên dữ liệu thật từ profile và skills)
  const caregiversInfo = caregivers.map((c, idx) => {
    const displayName = c.name || c.profile?.fullName || c.profile?.permanentAddress || `Caregiver ${idx + 1}`;
    const yearsExp = c.profile?.yearsOfExperience ?? 'N/A';
    const address = c.profile?.permanentAddress || c.profile?.temporaryAddress || 'N/A';
    const gender = c.profile?.gender || 'N/A';
    const education = c.profile?.education || 'N/A';
    const certificatesCount = Array.isArray(c.profile?.certificates) ? c.profile.certificates.length : 0;
    const skillsList = c.skills?.map(s => s.skillName).join(', ') || 'None';
    const availability = c.availability?.isAvailable ? 'Yes' : 'No';
    return `
CAREGIVER ${idx + 1}:
ID: ${c._id}
- Name: ${displayName}
- Age: ${c.profile?.dateOfBirth ? '' : 'N/A'}
- Gender: ${gender}
- Experience (years): ${yearsExp}
- Education: ${education}
- Address: ${address}
- Skills: ${skillsList}
- Certificates: ${certificatesCount}
- Average Rating: ${c.profile?.averageRating || 0}/5
- Total Reviews: ${c.profile?.totalReviews || 0}
- Is Available: ${availability}
`;
  }).join('\n');

  // Build full prompt
  const prompt = `
${careseekerInfo}

AVAILABLE CAREGIVERS:
=====================
${caregiversInfo}

TASK:
=====
Analyze all caregivers and select the TOP 5 BEST MATCHES for this careseeker.

Consider these factors:
1. Skills match with required services (MOST IMPORTANT)
2. Experience level vs preferences
3. Location proximity (closer is better)
4. Gender preference
5. Availability
6. Ratings and reviews
7. Price appropriateness for package type

For each match, provide:
- Caregiver ID (USE EXACT ID FROM LIST ABOVE, DO NOT INVENT)
- Match score (0-100)
- Top 3-5 specific reasons why this is a good match
- Brief analysis (1-2 sentences)

IMPORTANT: 
- Use ONLY the caregivers provided above. DO NOT create new caregiver IDs.
- Return EXACTLY 5 matches (or less if fewer caregivers available)
- Sort by match score (highest first)
- Be specific in reasons (mention actual skills, experience, etc.)
- Consider distance/location seriously
- If there are fewer than 5 caregivers provided, return as many as available (do not invent).

Return response in this EXACT JSON format:
{
  "matches": [
    {
      "caregiverId": "caregiver_id_here_from_list",
      "score": 95,
      "reasons": [
        "Has all required skills: nursing, medication management",
        "10 years experience exceeds 5 year requirement",
        "Located only 2km away from careseeker"
      ],
      "analysis": "Excellent match with extensive experience and perfect skill alignment."
    }
  ]
}
`;

  return prompt;
}

/**
 * Calculate distance between two coordinates (km)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Rerank danh sách caregivers (đã có baseScore) với Groq.
 * Groq chỉ được phép điều chỉnh ±10 và không được bịa caregiverId.
 */
async function rerankCandidates(careseekerContext, candidates) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not found in environment variables');
  }

  // Giữ top tối đa 15 để gửi lên LLM
  const limitedCandidates = candidates.slice(0, 15);

  const prompt = buildRerankPrompt(careseekerContext, limitedCandidates);

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Bạn là hệ thống AI reranker, nhiệm vụ là sắp xếp lại danh sách caregivers có sẵn. KHÔNG được tạo caregiver mới, KHÔNG đổi caregiverId. Chỉ điều chỉnh điểm trong khoảng ±10 quanh baseScore.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    if (!parsed?.matches) throw new Error('Invalid Groq rerank response');

    return parsed.matches.map((m) => ({
      caregiverId: m.caregiverId,
      adjustedScore: m.finalScore,
      baseScore: m.baseScore,
      delta: m.delta,
      reasoning: m.reasoning,
      strengths: m.strengths || [],
      concerns: m.concerns || [],
      recommendation: m.recommendation || 'RECOMMENDED'
    }));
  } catch (error) {
    console.error('Groq Rerank Error:', error.message);
    if (error.response) {
      console.error('API Response Error:', error.response.data);
    }
    throw error;
  }
}

function buildRerankPrompt(careseekerContext, candidates) {
  const {
    location,
    healthConditions = [],
    personality,
    specialNeeds,
    requiredSkills = [],
    requiredCertificates = [],
    preferredCertificates = [],
    preferredGender,
    minExperience,
    maxDistance
  } = careseekerContext || {};

  const careseekerBlock = `
CARESEEKER CONTEXT
- Location: ${location?.address || 'N/A'}
- Coordinates: ${location?.coordinates || 'N/A'}
- Max distance (km): ${maxDistance ?? 'N/A'}
- Required skills: ${requiredSkills.join(', ') || 'none'}
- Required certificates: ${requiredCertificates.join(', ') || 'none'}
- Preferred certificates: ${preferredCertificates.join(', ') || 'none'}
- Preferred gender: ${preferredGender || 'none'}
- Min experience: ${minExperience ?? 0}
- Health conditions: ${healthConditions.join(', ') || 'none'}
- Personality: ${personality || 'none'}
- Special needs: ${specialNeeds || 'none'}
`;

  const candidatesBlock = candidates
    .map((c, idx) => {
      return `
CAREGIVER ${idx + 1}
- caregiverId: ${c.caregiverId}
- name: ${c.name || 'N/A'}
- gender: ${c.gender || 'N/A'}
- experienceYears: ${c.experienceYears ?? 'N/A'}
- address: ${c.address || 'N/A'}
- distanceKm: ${c.distance ?? 'unknown'}
- skills: ${(c.skills || []).join(', ') || 'none'}
- certificates: ${(c.certificates || []).join(', ') || 'none'}
- rating: ${c.rating ?? 'N/A'}
- baseScore: ${c.baseScore}
- breakdown: ${JSON.stringify(c.breakdown || {})}
`;
    })
    .join('\n');

  return `
${careseekerBlock}

CANDIDATES (đã có baseScore, KHÔNG được thêm/bớt):
${candidatesBlock}

NHIỆM VỤ:
- Rerank các caregivers trên.
- Điều chỉnh điểm mỗi caregiver trong khoảng ±10 quanh baseScore để phản ánh mức phù hợp tổng thể (tối đa finalScore 100, tối thiểu 0).
- KHÔNG tạo caregiver mới, KHÔNG đổi caregiverId.
- Nêu lý do ngắn gọn, strengths/concerns nếu có.
- Nếu thông tin thiếu (ví dụ không có distance), giữ điểm gần baseScore.

TRẢ VỀ JSON CHUẨN:
{
  "matches": [
    {
      "caregiverId": "string (must match input)",
      "baseScore": 80,
      "delta": 5,
      "finalScore": 85,
      "reasoning": "ngắn gọn",
      "strengths": ["..."],
      "concerns": ["..."],
      "recommendation": "HIGHLY_RECOMMENDED | RECOMMENDED | CONSIDER"
    }
  ]
}
`;
}

module.exports = {
  getTopMatches,
  rerankCandidates
};

