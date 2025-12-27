const axios = require('axios');
const CaregiverProfile = require('../models/CaregiverProfile');
const CaregiverSkill = require('../models/CaregiverSkill');
const ElderlyProfile = require('../models/ElderlyProfile');
const Package = require('../models/Package');
const { rerankCandidates } = require('./groqMatchingService');

/**
 * Geocode địa chỉ sử dụng Nominatim (OpenStreetMap)
 * @param {string} address - Địa chỉ cần geocode
 * @returns {Promise<Array|null>} - [latitude, longitude] hoặc null nếu fail
 */
const geocodeAddress = async (address) => {
  try {
    const url = 'https://nominatim.openstreetmap.org/search';
    const params = {
      q: address,
      format: 'json',
      addressdetails: 0,
      limit: 1,
    };
    const headers = {
      'User-Agent': 'elderly-home-care-backend/1.0',
    };
    
    const res = await axios.get(url, { params, headers, timeout: 10000 });
    const first = Array.isArray(res.data) ? res.data[0] : null;
    
    if (!first || !first.lat || !first.lon) return null;
    return [parseFloat(first.lat), parseFloat(first.lon)];
  } catch (error) {
    return null;
  }
};

/**
 * Tính khoảng cách giữa 2 điểm sử dụng công thức Haversine
 * @param {number} lat1 - Latitude điểm 1
 * @param {number} lon1 - Longitude điểm 1
 * @param {number} lat2 - Latitude điểm 2
 * @param {number} lon2 - Longitude điểm 2
 * @returns {number} - Khoảng cách tính bằng km
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Tính điểm matching cho caregiver dựa trên nhiều tiêu chí
 * @param {Object} caregiver - Caregiver profile
 * @param {Object} criteria - Tiêu chí tìm kiếm
 * @param {Object} weights - Trọng số các tiêu chí
 * @returns {Object} - Điểm số và breakdown chi tiết
 */
const calculateMatchScore = (caregiver, criteria, weights) => {
  const {
    resolvedLocation,
    finalRequiredSkills = [],
    finalRequiredCerts = [],
    finalPreferredCerts = [],
    finalHealthConditions = [],
    maxDistance = 7,
  } = criteria;

  const cgSkills = caregiver.skills || [];
  const certNames = caregiver.certificates?.map(c => c.name?.toLowerCase()) || [];
  
  let distanceKm = null;
  
  // Calculate distance nếu có coordinates
  if (
    resolvedLocation?.coordinates?.length === 2 &&
    Array.isArray(caregiver.locationCoordinates) &&
    caregiver.locationCoordinates.length === 2
  ) {
    distanceKm = calculateDistance(
      resolvedLocation.coordinates[0],
      resolvedLocation.coordinates[1],
      caregiver.locationCoordinates[0],
      caregiver.locationCoordinates[1]
    );
  }

  // Geographic score
  let geographicScore = weights.geographic;
  if (distanceKm !== null) {
    if (distanceKm <= 1) {
      geographicScore = weights.geographic;
    } else if (distanceKm <= maxDistance) {
      const ratio = 1 - (distanceKm - 1) / (maxDistance - 1 || 1);
      geographicScore = Math.max(0, ratio * weights.geographic);
    } else {
      geographicScore = 0;
    }
  }

  // Skills score
  let skillsScore = weights.skills;
  if (finalRequiredSkills.length > 0) {
    const matched = finalRequiredSkills.filter((s) =>
      cgSkills.map((x) => x?.toLowerCase()).includes(s?.toLowerCase())
    ).length;
    const pct = matched / finalRequiredSkills.length;
    skillsScore = Math.min(weights.skills, pct * weights.skills);
  }

  // Health conditions score
  let healthScore = weights.health;
  if (finalHealthConditions?.length) {
    const matchedHealth = finalHealthConditions.filter((cond) =>
      cgSkills.map((x) => x?.toLowerCase()).includes(cond?.toLowerCase())
    ).length;
    const pct = matchedHealth / finalHealthConditions.length;
    healthScore = pct === 0 ? weights.health * 0.5 : Math.min(weights.health, pct * weights.health);
  }

  // Certificates score
  let certScore = 0;
  if (finalRequiredCerts.length > 0) {
    const allHave = finalRequiredCerts.every((r) =>
      certNames.includes(r?.toLowerCase())
    );
    certScore += allHave ? weights.certificates * 0.7 : 0;
  }
  if (finalPreferredCerts.length > 0) {
    const prefMatched = finalPreferredCerts.filter((r) =>
      certNames.includes(r?.toLowerCase())
    ).length;
    certScore += Math.min(weights.certificates * 0.3, prefMatched * 2);
  }
  certScore = Math.min(weights.certificates, certScore);

  // Personality & Availability (neutral scores for now)
  const personalityScore = weights.personality;
  const availabilityScore = weights.availability;
  
  // Previous booking & rating (not implemented yet)
  const previousScore = 0;
  const ratingScore = 0;

  const baseScore =
    geographicScore +
    skillsScore +
    healthScore +
    personalityScore +
    availabilityScore +
    certScore +
    previousScore +
    ratingScore;

  return {
    baseScore,
    distanceKm,
    breakdown: {
      geographic: geographicScore,
      skills: skillsScore,
      health: healthScore,
      personality: personalityScore,
      availability: availabilityScore,
      certificates: certScore,
      previousBooking: previousScore,
      rating: ratingScore,
    },
  };
};

/**
 * Tìm kiếm caregivers phù hợp với tiêu chí
 * @param {Object} searchCriteria - Tiêu chí tìm kiếm từ request
 * @returns {Promise<Object>} - Danh sách caregivers đã được match và rank
 */
const searchAndMatchCaregivers = async (searchCriteria) => {
  const {
    elderlyId,
    location,
    packageId,
    skills = [],
    requiredCertificates = [],
    preferredCertificates = [],
    preferredGender = null,
    minExperience = 0,
    maxDistance = 7,
    override = {},
  } = searchCriteria;

  // Geocode location nếu chưa có coordinates
  let resolvedLocation = { ...location };
  if (
    (!resolvedLocation.coordinates ||
      !Array.isArray(resolvedLocation.coordinates) ||
      resolvedLocation.coordinates.length !== 2) &&
    resolvedLocation.address
  ) {
    const coords = await geocodeAddress(resolvedLocation.address);
    if (coords) {
      resolvedLocation.coordinates = coords;
    }
  }

  // Load elderly profile nếu có
  let elderlyProfile = null;
  if (elderlyId) {
    elderlyProfile = await ElderlyProfile.findById(elderlyId).lean();
  }

  // Load package nếu có
  let packageData = null;
  if (packageId) {
    packageData = await Package.findById(packageId).lean();
  }

  // Merge requirements
  const packageRequiredSkills = packageData?.requiredSkills || [];
  const packageRequiredCerts = packageData?.requiredCertificates || [];
  const packageOptionalCerts = packageData?.optionalCertificates || [];

  const finalRequiredSkills = Array.from(
    new Set([...skills, ...packageRequiredSkills])
  );
  const finalRequiredCerts = Array.from(
    new Set([...requiredCertificates, ...packageRequiredCerts])
  );
  const finalPreferredCerts = Array.from(
    new Set([...preferredCertificates, ...packageOptionalCerts])
  );

  const finalHealthConditions =
    override.healthConditions ?? elderlyProfile?.medicalConditions ?? [];
  const finalPersonality =
    override.personality ?? elderlyProfile?.personalityType ?? null;
  const finalSpecialNeeds =
    override.specialNeeds ?? elderlyProfile?.specialNeeds ?? null;

  // Filter caregivers
  const filterQuery = { profileStatus: 'approved' };
  if (preferredGender) {
    filterQuery.gender = preferredGender === 'female' ? 'Nữ' : 'Nam';
  }
  if (minExperience > 0) {
    filterQuery.yearsOfExperience = { $gte: minExperience };
  }

  const caregivers = await CaregiverProfile.find(filterQuery)
    .populate('user', 'name email avatar')
    .lean();

  if (!caregivers || caregivers.length === 0) {
    return {
      total: 0,
      returned: 0,
      matches: [],
      suggestions: {
        relaxDistance: true,
        removeFilters: finalRequiredSkills.length ? ['skills'] : [],
        alternativePackages: [],
        message: 'Không tìm thấy caregiver. Thử giảm bớt yêu cầu.',
      },
    };
  }

  // Load skills cho caregivers
  const caregiverIds = caregivers.map((c) => c.user?._id || c.user);
  const skillsByCaregiver = await CaregiverSkill.find({
    userId: { $in: caregiverIds },
  })
    .select('userId skillName')
    .lean();

  const skillsMap = caregiverIds.reduce((acc, id) => {
    acc[id.toString()] = [];
    return acc;
  }, {});
  
  skillsByCaregiver.forEach((s) => {
    const key = s.userId?.toString();
    if (key && skillsMap[key]) skillsMap[key].push(s.skillName);
  });

  // Weights cho scoring
  const weights = {
    geographic: 30,
    skills: 30,
    health: 20,
    personality: 15,
    availability: 10,
    certificates: 15,
    previous: 10,
    rating: 5,
  };
  const maxBase = 145;

  const criteria = {
    resolvedLocation,
    finalRequiredSkills,
    finalRequiredCerts,
    finalPreferredCerts,
    finalHealthConditions,
    maxDistance,
  };

  // Score và filter candidates
  const baseCandidates = caregivers
    .map((cg) => {
      const id = cg.user?._id?.toString() || cg.user?.toString();
      const cgSkills = skillsMap[id] || [];
      const certNames = cg.certificates?.map((c) => c.name?.toLowerCase()) || [];

      const scoreResult = calculateMatchScore(
        { ...cg, skills: cgSkills },
        criteria,
        weights
      );

      // Apply hard filters
      if (
        finalRequiredSkills.length > 0 &&
        finalRequiredSkills.some(
          (s) => !cgSkills.map((x) => x?.toLowerCase()).includes(s?.toLowerCase())
        )
      ) {
        return null;
      }

      if (
        finalRequiredCerts.length > 0 &&
        finalRequiredCerts.some((r) => !certNames.includes(r?.toLowerCase()))
      ) {
        return null;
      }

      if (scoreResult.distanceKm !== null && scoreResult.distanceKm > maxDistance) {
        return null;
      }

      return {
        caregiverId: id,
        name: cg.user?.name || cg.fullName || 'Caregiver',
        gender: cg.gender,
        experienceYears: cg.yearsOfExperience || 0,
        address: cg.permanentAddress,
        distance: scoreResult.distanceKm,
        skills: cgSkills,
        certificates: certNames,
        baseScore: scoreResult.baseScore,
        breakdown: scoreResult.breakdown,
      };
    })
    .filter(Boolean);

  if (!baseCandidates.length) {
    return {
      total: 0,
      returned: 0,
      matches: [],
      suggestions: {
        relaxDistance: true,
        removeFilters: finalRequiredSkills.length ? ['skills'] : [],
        alternativePackages: [],
        message: 'Không tìm thấy caregiver sau khi áp filters bắt buộc.',
      },
    };
  }

  // Sort và lấy top candidates
  const sortedBase = baseCandidates.sort((a, b) => b.baseScore - a.baseScore);
  const topForRerank = sortedBase.slice(0, 15);

  // Prepare context cho AI reranking
  const careseekerContext = {
    location: resolvedLocation,
    healthConditions: finalHealthConditions,
    personality: finalPersonality,
    specialNeeds: finalSpecialNeeds,
    requiredSkills: finalRequiredSkills,
    requiredCertificates: finalRequiredCerts,
    preferredCertificates: finalPreferredCerts,
    preferredGender,
    minExperience,
    maxDistance,
  };

  // AI Reranking với Groq
  let reranked = null;
  try {
    const normalized = topForRerank.map((c) => ({
      ...c,
      baseScore: Math.min(100, Math.round((c.baseScore / maxBase) * 100)),
    }));

    const llmResult = await rerankCandidates(careseekerContext, normalized);
    const llmMap = llmResult.reduce((acc, r) => {
      acc[r.caregiverId] = r;
      return acc;
    }, {});

    reranked = topForRerank.map((c) => {
      const llm = llmMap[c.caregiverId];
      const baseNormalized = Math.min(100, Math.round((c.baseScore / maxBase) * 100));
      
      if (!llm) {
        return {
          ...c,
          finalScore: baseNormalized,
          delta: 0,
          reasoning: 'Fallback to base score (LLM missing entry).',
          strengths: [],
          concerns: [],
          recommendation: baseNormalized >= 70 ? 'HIGHLY_RECOMMENDED' : 'RECOMMENDED',
        };
      }
      
      const finalScore = Math.min(100, Math.max(0, llm.adjustedScore || llm.finalScore || baseNormalized));
      
      return {
        ...c,
        finalScore,
        delta: llm.delta ?? finalScore - baseNormalized,
        reasoning: llm.reasoning || 'LLM rerank applied',
        strengths: llm.strengths || [],
        concerns: llm.concerns || [],
        recommendation: llm.recommendation || (finalScore >= 70 ? 'HIGHLY_RECOMMENDED' : 'RECOMMENDED'),
        baseScoreNormalized: baseNormalized,
      };
    });
  } catch (err) {
    console.error('❌ Groq rerank failed:', err.message);
    // Fallback to base scores
    reranked = topForRerank.map((c) => ({
      ...c,
      finalScore: Math.min(100, Math.round((c.baseScore / maxBase) * 100)),
      delta: 0,
      reasoning: 'Fallback base score (Groq rerank failed).',
      strengths: [],
      concerns: [],
      recommendation: c.baseScore >= 100 ? 'HIGHLY_RECOMMENDED' : 'RECOMMENDED',
    }));
  }

  // Sort theo final score và return top 10
  const finalSorted = reranked.sort((a, b) => b.finalScore - a.finalScore);
  const returned = finalSorted.slice(0, 10);

  return {
    total: finalSorted.length,
    returned: returned.length,
    matches: returned.map((m) => ({
      caregiverId: m.caregiverId,
      name: m.name,
      gender: m.gender,
      experienceYears: m.experienceYears,
      location: {
        distance: m.distance,
        distanceText: m.distance ? `${m.distance.toFixed(1)} km` : null,
        address: m.address,
      },
      match: {
        score: Math.round(m.finalScore),
        baseScore: Math.round(Math.min(100, (m.baseScore / maxBase) * 100)),
        delta: Math.round(m.delta),
        level: m.finalScore >= 70 ? 'HIGH' : m.finalScore >= 55 ? 'MEDIUM' : 'LOW',
        breakdown: m.breakdown,
        reasoning: m.reasoning,
        strengths: m.strengths || [],
        concerns: m.concerns || [],
        recommendation: m.recommendation,
      },
      highlights: {
        skills: m.skills?.slice(0, 5) || [],
        certificates: m.certificates?.slice(0, 5) || [],
        specializations: [],
      },
    })),
    suggestions:
      returned.length < 5
        ? {
            relaxDistance: true,
            removeFilters: finalRequiredSkills.length ? ['skills'] : [],
            alternativePackages: [],
            message: 'Kết quả ít, thử giảm yêu cầu hoặc mở rộng khoảng cách.',
          }
        : {},
  };
};

module.exports = {
  geocodeAddress,
  calculateDistance,
  calculateMatchScore,
  searchAndMatchCaregivers,
};




