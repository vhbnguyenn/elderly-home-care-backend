const axios = require('axios');
const CaregiverProfile = require('../models/CaregiverProfile');
const User = require('../models/User');
const CaregiverSkill = require('../models/CaregiverSkill');
const CaregiverAvailability = require('../models/CaregiverAvailability');
const ElderlyProfile = require('../models/ElderlyProfile');
const Package = require('../models/Package');
const { rerankCandidates } = require('../services/groqMatchingService');
const { createCaregiverProfileSchema } = require('../utils/validation');
const { ROLES } = require('../constants');

// Geocode địa chỉ (dùng Nominatim - không cần API key)
async function geocodeAddress(address) {
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
}

// @desc    Tạo hồ sơ caregiver
// @route   POST /api/caregiver/profile
// @access  Private (Caregiver only)
const createProfile = async (req, res, next) => {
  try {
    // Kiểm tra user đã có profile chưa
    const existingProfile = await CaregiverProfile.findOne({ user: req.user._id });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Profile already exists'
      });
    }

    // Parse certificates nếu là string (từ form-data)
    let bodyData = { ...req.body };
    if (typeof req.body.certificates === 'string') {
      try {
        bodyData.certificates = JSON.parse(req.body.certificates);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid certificates format. Must be valid JSON array'
        });
      }
    }

    // Validate request body
    const { error, value } = createCaregiverProfileSchema.validate(bodyData);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Kiểm tra files được upload
    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: 'Required images are missing'
      });
    }

    const { idCardFrontImage, idCardBackImage, universityDegreeImage, profileImage, certificateImages } = req.files;

    // Validate required images
    if (!idCardFrontImage || !idCardBackImage || !profileImage) {
      return res.status(400).json({
        success: false,
        message: 'ID card images (front & back) and profile image are required'
      });
    }

    // Validate university degree image nếu education là đại học hoặc sau đại học
    if ((value.education === 'đại học' || value.education === 'sau đại học') && !universityDegreeImage) {
      return res.status(400).json({
        success: false,
        message: 'University degree image is required for university education level'
      });
    }

    // Validate certificate images
    if (!certificateImages || certificateImages.length !== value.certificates.length) {
      return res.status(400).json({
        success: false,
        message: 'Each certificate must have an image'
      });
    }

    // Kiểm tra ID card number đã tồn tại chưa
    const existingIdCard = await CaregiverProfile.findOne({ idCardNumber: value.idCardNumber });
    if (existingIdCard) {
      return res.status(400).json({
        success: false,
        message: 'ID card number already exists'
      });
    }

    // Tạo profile data với URLs của các file đã upload
    const profileData = {
      user: req.user._id,
      phoneNumber: value.phoneNumber,
      dateOfBirth: value.dateOfBirth,
      gender: value.gender,
      permanentAddress: value.permanentAddress,
      temporaryAddress: value.temporaryAddress || '',
      idCardNumber: value.idCardNumber,
      idCardFrontImage: idCardFrontImage[0].path, // Cloudinary URL
      idCardBackImage: idCardBackImage[0].path, // Cloudinary URL
      yearsOfExperience: value.yearsOfExperience,
      workHistory: value.workHistory,
      education: value.education,
      universityDegreeImage: universityDegreeImage ? universityDegreeImage[0].path : null,
      profileImage: profileImage[0].path, // Cloudinary URL
      bio: value.bio,
      agreeToEthics: value.agreeToEthics,
      agreeToTerms: value.agreeToTerms,
      certificates: value.certificates.map((cert, index) => ({
        name: cert.name,
        issueDate: cert.issueDate,
        issuingOrganization: cert.issuingOrganization,
        certificateType: cert.certificateType,
        certificateImage: certificateImages[index].path // Cloudinary URL
      }))
    };

    // Geocode địa chỉ caregiver (ưu tiên tạm trú, fallback thường trú)
    try {
      const cgAddress = value.temporaryAddress || value.permanentAddress;
      if (cgAddress) {
        const coords = await geocodeAddress(cgAddress);
        if (coords) {
          profileData.locationCoordinates = coords;
        }
      }
    } catch (geoErr) {
      console.warn('Geocode caregiver address failed:', geoErr.message);
    }

    // Tạo profile
    const profile = await CaregiverProfile.create(profileData);

    // Populate user info
    await profile.populate('user', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy profile của caregiver hiện tại
// @route   GET /api/caregiver/profile
// @access  Private (Caregiver only)
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await CaregiverProfile.findOne({ user: req.user._id })
      .populate('user', 'name email role');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật profile
// @route   PUT /api/caregiver/profile
// @access  Private (Caregiver only)
const updateProfile = async (req, res, next) => {
  try {
    let profile = await CaregiverProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Không cho phép update nếu profile đang pending hoặc approved
    if (profile.profileStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update approved profile. Please contact admin.'
      });
    }

    // Chỉ cho phép update các field: phoneNumber, temporaryAddress, education, yearsOfExperience, workHistory, profileImage, bio
    const allowedFields = ['phoneNumber', 'temporaryAddress', 'education', 'yearsOfExperience', 'workHistory', 'bio'];
    const updateFields = {};

    // Validate và lấy các field được phép update
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    // Kiểm tra có field nào để update không
    if (Object.keys(updateFields).length === 0 && !req.files?.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Update profile image nếu có
    if (req.files?.profileImage) {
      updateFields.profileImage = req.files.profileImage[0].path; // Cloudinary URL
    }

    // Geocode nếu có địa chỉ tạm trú mới
    if (updateFields.temporaryAddress) {
      try {
        const coords = await geocodeAddress(updateFields.temporaryAddress);
        if (coords) {
          updateFields.locationCoordinates = coords;
        }
      } catch (geoErr) {
        console.warn('Geocode caregiver update failed:', geoErr.message);
      }
    }

    // Update profile
    profile = await CaregiverProfile.findByIdAndUpdate(
      profile._id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('user', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết profile để duyệt (cho admin)
// @route   GET /api/caregiver/profile/:id/admin
// @access  Private (Admin only)
const getProfileForAdmin = async (req, res, next) => {
  try {
    const profile = await CaregiverProfile.findById(req.params.id)
      .populate('user', 'name email phone createdAt');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tất cả profiles (cho admin)
// @route   GET /api/caregiver/profiles
// @access  Private (Admin only)
const getAllProfiles = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) {
      query.profileStatus = status;
    }

    const profiles = await CaregiverProfile.find(query)
      .populate('user', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await CaregiverProfile.countDocuments(query);

    res.status(200).json({
      success: true,
      data: profiles,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Approve/Reject profile (cho admin)
// @route   PUT /api/caregiver/profile/:id/status
// @access  Private (Admin only)
const updateProfileStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected'
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const profile = await CaregiverProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    profile.profileStatus = status;
    if (status === 'rejected') {
      profile.rejectionReason = rejectionReason;
    }

    await profile.save();
    await profile.populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: `Profile ${status} successfully`,
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Search caregivers với base scoring + Groq rerank (location bắt buộc)
// @route   POST /api/caregivers/search
// @access  Private (Careseeker)
const searchCaregivers = async (req, res, next) => {
  try {
    const {
      elderlyId,
      location, // { address, coordinates?, district? } - required
      packageId,
      skills = [],
      requiredCertificates = [],
      preferredCertificates = [],
      preferredGender = null,
      minExperience = 0,
      maxDistance = 7, // km
      override = {}, // { healthConditions, personality, specialNeeds }
    } = req.body || {};

    if (!location || !location.address) {
      return res.status(400).json({
        success: false,
        message: 'location.address is required',
      });
    }

    // Geocode địa chỉ careseeker nếu chưa có coordinates
    let resolvedLocation = { ...location };
    if (
      (!resolvedLocation.coordinates ||
        !Array.isArray(resolvedLocation.coordinates) ||
        resolvedLocation.coordinates.length !== 2) &&
      resolvedLocation.address
    ) {
      try {
        const coords = await geocodeAddress(resolvedLocation.address);
        if (coords) {
          resolvedLocation.coordinates = coords;
        }
      } catch (geoErr) {
        console.warn('Geocode careseeker location failed:', geoErr.message);
      }
    }

    // Elderly profile (health/personality/specialNeeds only)
    let elderlyProfile = null;
    if (elderlyId) {
      elderlyProfile = await ElderlyProfile.findById(elderlyId).lean();
      if (!elderlyProfile) {
        return res.status(404).json({
          success: false,
          message: 'Elderly profile not found',
        });
      }
    }

    // Package (nếu có) để lấy yêu cầu skill/cert (nếu schema có)
    let packageData = null;
    if (packageId) {
      packageData = await Package.findById(packageId).lean();
    }

    // Merge requirements
    const packageRequiredSkills = packageData?.requiredSkills || [];
    const packageRequiredCerts = packageData?.requiredCertificates || [];
    const packageOptionalCerts = packageData?.optionalCertificates || [];

    const finalRequiredSkills = Array.from(
      new Set([...(skills || []), ...packageRequiredSkills])
    );
    const finalRequiredCerts = Array.from(
      new Set([...(requiredCertificates || []), ...packageRequiredCerts])
    );
    const finalPreferredCerts = Array.from(
      new Set([...(preferredCertificates || []), ...packageOptionalCerts])
    );

    const finalHealthConditions =
      override.healthConditions ?? elderlyProfile?.medicalConditions ?? [];
    const finalPersonality =
      override.personality ?? elderlyProfile?.personalityType ?? null;
    const finalSpecialNeeds =
      override.specialNeeds ?? elderlyProfile?.specialNeeds ?? null;

    // Lọc caregivers: approved, gender/minExperience nếu có
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
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          returned: 0,
          matches: [],
          suggestions: {
            relaxDistance: true,
            removeFilters: finalRequiredSkills.length ? ['skills'] : [],
            alternativePackages: [],
            message: 'Không tìm thấy caregiver. Thử giảm bớt yêu cầu.',
          },
        },
      });
    }

    // Lấy skills cho caregivers
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

    // Hàm Haversine (nếu có tọa độ)
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
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

    // Filter + base scoring
    const baseCandidates = caregivers
      .map((cg) => {
        const id = cg.user?._id?.toString() || cg.user?.toString();
        const cgSkills = skillsMap[id] || [];
        const expYears = cg.yearsOfExperience || 0;

        // Distance (nếu có tọa độ)
        let distanceKm = null;
        if (
          resolvedLocation?.coordinates?.length === 2 &&
          Array.isArray(cg.locationCoordinates) &&
          cg.locationCoordinates.length === 2
        ) {
          distanceKm = haversineKm(
            resolvedLocation.coordinates[0],
            resolvedLocation.coordinates[1],
            cg.locationCoordinates[0],
            cg.locationCoordinates[1]
          );
        }

        // Filters bắt buộc
        if (
          finalRequiredSkills.length > 0 &&
          finalRequiredSkills.some(
            (s) => !cgSkills.map((x) => x?.toLowerCase()).includes(s?.toLowerCase())
          )
        ) {
          return null;
        }

        const certNames = cg.certificates?.map((c) => c.name?.toLowerCase()) || [];
        if (
          finalRequiredCerts.length > 0 &&
          finalRequiredCerts.some((r) => !certNames.includes(r?.toLowerCase()))
        ) {
          return null;
        }

        if (distanceKm !== null && distanceKm > maxDistance) {
          return null;
        }

        // Geographic score
        let geographicScore = weights.geographic;
        if (distanceKm !== null) {
          if (distanceKm <= 1) geographicScore = weights.geographic;
          else if (distanceKm <= maxDistance) {
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

        // Health score
        let healthScore = weights.health;
        if (finalHealthConditions?.length) {
          const matchedHealth = finalHealthConditions.filter((cond) =>
            cgSkills.map((x) => x?.toLowerCase()).includes(cond?.toLowerCase())
          ).length;
          const pct = matchedHealth / finalHealthConditions.length;
          healthScore = pct === 0 ? weights.health * 0.5 : Math.min(weights.health, pct * weights.health);
        }

        // Personality score (không có dữ liệu -> neutral)
        const personalityScore = weights.personality;

        // Availability (chưa kiểm tra chi tiết -> neutral cao)
        const availabilityScore = weights.availability;

        // Certificates bonus
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

        // Previous & rating (chưa có dữ liệu)
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
          caregiverId: id,
          name: cg.user?.name || cg.fullName || 'Caregiver',
          gender: cg.gender,
          experienceYears: expYears,
          address: cg.permanentAddress,
          distance: distanceKm,
          skills: cgSkills,
          certificates: certNames,
          baseScore,
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
      })
      .filter(Boolean);

    if (!baseCandidates.length) {
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          returned: 0,
          matches: [],
          suggestions: {
            relaxDistance: true,
            removeFilters: finalRequiredSkills.length ? ['skills'] : [],
            alternativePackages: [],
            message: 'Không tìm thấy caregiver sau khi áp filters bắt buộc.',
          },
        },
      });
    }

    const sortedBase = baseCandidates.sort((a, b) => b.baseScore - a.baseScore);
    const topForRerank = sortedBase.slice(0, 15);

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

    let reranked = null;
    try {
      // Normalize baseScore to 0-100 cho LLM, lưu delta ±10
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
      console.error('Groq rerank failed, fallback to base. Reason:', err.message);
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

    const finalSorted = reranked.sort((a, b) => b.finalScore - a.finalScore);
    const returned = finalSorted.slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
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
            level:
              m.finalScore >= 70 ? 'HIGH' : m.finalScore >= 55 ? 'MEDIUM' : 'LOW',
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
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get caregiver detail for booking
// @route   GET /api/caregivers/:caregiverId
// @access  Public
const getCaregiverDetail = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;

    const caregiver = await CaregiverProfile.findById(caregiverId)
      .populate('user', 'name email')
      .select('-__v -idCardNumber -idCardFrontImage -idCardBackImage');

    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found',
      });
    }

    // Only show approved profiles
    if (caregiver.profileStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Caregiver profile is not available',
      });
    }

    res.json({
      success: true,
      data: caregiver,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách caregivers (Public - cho careseeker browse)
// @route   GET /api/caregivers
// @access  Public
const getCaregiversList = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      education,
      minExperience,
      location,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Query chỉ lấy caregiver đã approved
    const query = { profileStatus: 'approved' };

    // Filter theo education
    if (education) {
      query.education = education;
    }

    // Filter theo kinh nghiệm tối thiểu
    if (minExperience) {
      query.yearsOfExperience = { $gte: Number(minExperience) };
    }

    // Filter theo location
    if (location) {
      query.$or = [
        { permanentAddress: { $regex: location, $options: 'i' } },
        { temporaryAddress: { $regex: location, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const caregivers = await CaregiverProfile.find(query)
      .populate('user', 'name email phone')
      .select('-idCardNumber -idCardFrontImage -idCardBackImage -universityDegreeImage')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await CaregiverProfile.countDocuments(query);

    res.status(200).json({
      success: true,
      data: caregivers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProfile,
  getMyProfile,
  updateProfile,
  getAllProfiles,
  getProfileForAdmin,
  updateProfileStatus,
  searchCaregivers,
  getCaregiverDetail,
  getCaregiversList,
};
