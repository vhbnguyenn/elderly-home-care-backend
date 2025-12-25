const axios = require('axios');
const CaregiverProfile = require('../models/CaregiverProfile');
const User = require('../models/User');
const CaregiverSkill = require('../models/CaregiverSkill');
const CaregiverAvailability = require('../models/CaregiverAvailability');
const ElderlyProfile = require('../models/ElderlyProfile');
const Package = require('../models/Package');
const Certificate = require('../models/Certificate');
const { rerankCandidates } = require('../services/groqMatchingService');
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
    console.log('🚀 createProfile called - User ID:', req.user?._id || 'NULL');
    console.log('📋 Request body keys:', Object.keys(req.body));
    
    // Kiểm tra user đã đăng nhập
    if (!req.user || !req.user._id) {
      console.log('❌ No user in request!');
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tạo hồ sơ'
      });
    }

    // Kiểm tra đã có profile chưa
    const existingProfile = await CaregiverProfile.findOne({ user: req.user._id });
    if (existingProfile) {
      console.log('⚠️ Profile already exists for user:', req.user._id);
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có hồ sơ rồi. Vui lòng cập nhật thay vì tạo mới.'
      });
    }

    // Parse certificates nếu là string (từ form-data)
    let bodyData = { ...req.body };
    let certificatesData = [];
    
    if (typeof req.body.certificates === 'string') {
      try {
        certificatesData = JSON.parse(req.body.certificates);
        console.log('✅ Parsed certificates from string:', certificatesData);
      } catch (e) {
        console.log('❌ Failed to parse certificates:', e.message);
      }
    } else if (Array.isArray(req.body.certificates)) {
      certificatesData = req.body.certificates;
      console.log('✅ Certificates from array:', certificatesData);
    } else {
      console.log('⚠️ No certificates in request body');
    }

    // Tạo profile data
    const profileData = {
      user: req.user._id,
      ...bodyData
    };

    // Xử lý files nếu có upload
    if (req.files) {
      const { idCardFrontImage, idCardBackImage, universityDegreeImage, profileImage, certificateImages } = req.files;

      if (idCardFrontImage) {
        profileData.idCardFrontImage = idCardFrontImage[0].path;
      }
      if (idCardBackImage) {
        profileData.idCardBackImage = idCardBackImage[0].path;
      }
      if (universityDegreeImage) {
        profileData.universityDegreeImage = universityDegreeImage[0].path;
      }
      if (profileImage) {
        profileData.profileImage = profileImage[0].path; // Cloudinary URL - Avatar của caregiver
      }
      
      // Map certificate images với certificates data
      if (certificateImages && Array.isArray(certificatesData)) {
        certificatesData = certificatesData.map((cert, index) => ({
          ...cert,
          certificateImage: certificateImages[index] ? certificateImages[index].path : null
        }));
      }
    }
    
    // Lưu certificates vào CaregiverProfile (embedded)
    if (certificatesData && certificatesData.length > 0) {
      profileData.certificates = certificatesData;
    }

    // Geocode địa chỉ caregiver (ưu tiên tạm trú, fallback thường trú)
    try {
      const cgAddress = profileData.temporaryAddress || profileData.permanentAddress;
      if (cgAddress) {
        const coords = await geocodeAddress(cgAddress);
        if (coords) {
          profileData.locationCoordinates = coords;
        }
      }
    } catch (geoErr) {
      console.warn('Geocode caregiver address failed:', geoErr.message);
    }

    // Tạo profile (bỏ validation và strict mode)
    console.log('💾 Creating profile with user:', req.user._id);
    let profile;
    try {
      profile = await CaregiverProfile.create(profileData);
      console.log('✅ Profile created:', profile._id);
    } catch (createError) {
      console.log('❌ Error creating profile:', createError.message);
      throw createError;
    }

    // Tạo certificates riêng trong bảng Certificate nếu có
    if (certificatesData && Array.isArray(certificatesData) && certificatesData.length > 0) {
      const certificatesToCreate = certificatesData.map(cert => ({
        caregiver: req.user._id,
        caregiverProfile: profile._id,
        name: cert.name,
        issueDate: cert.issueDate,
        expirationDate: cert.expirationDate,
        issuingOrganization: cert.issuingOrganization,
        certificateType: cert.certificateType,
        certificateImage: cert.certificateImage,
        status: 'pending'
      }));
      
      await Certificate.insertMany(certificatesToCreate, { 
        runValidators: false,
        strict: false 
      });
    }

    // Query lại để populate user info
    const populatedProfile = await CaregiverProfile.findById(profile._id)
      .populate('user', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Tạo hồ sơ thành công',
      data: populatedProfile
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

    // Lấy certificates từ bảng Certificate
    let certificates = [];
    if (profile) {
      certificates = await Certificate.find({ 
        caregiverProfile: profile._id 
      }).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: profile ? {
        ...profile.toObject(),
        certificates // Thêm certificates từ bảng riêng
      } : null
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
        message: 'Không tìm thấy hồ sơ'
      });
    }

    const updateFields = { ...req.body };

    // Xử lý files nếu có upload
    if (req.files) {
      if (req.files.profileImage) {
        updateFields.profileImage = req.files.profileImage[0].path; // Cloudinary URL - Avatar của caregiver
      }
      if (req.files.idCardFrontImage) {
        updateFields.idCardFrontImage = req.files.idCardFrontImage[0].path;
      }
      if (req.files.idCardBackImage) {
        updateFields.idCardBackImage = req.files.idCardBackImage[0].path;
      }
      if (req.files.universityDegreeImage) {
        updateFields.universityDegreeImage = req.files.universityDegreeImage[0].path;
      }
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
      { new: true, runValidators: false }
    ).populate('user', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công',
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

    // Lấy certificates từ bảng Certificate
    let certificates = [];
    if (profile) {
      certificates = await Certificate.find({ 
        caregiverProfile: profile._id 
      }).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: profile ? {
        ...profile.toObject(),
        certificates // Thêm certificates từ bảng riêng
      } : null
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
    const { page = 1, limit = 10 } = req.query;

    const profiles = await CaregiverProfile.find({})
      .populate('user', 'name email')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const count = await CaregiverProfile.countDocuments({});

    // Lấy certificates cho tất cả profiles
    const profileIds = profiles.map(p => p._id);
    const allCertificates = await Certificate.find({ 
      caregiverProfile: { $in: profileIds } 
    }).sort({ createdAt: -1 });

    // Map certificates vào từng profile
    const profilesWithCerts = profiles.map(profile => {
      const certs = allCertificates.filter(
        cert => cert.caregiverProfile.toString() === profile._id.toString()
      );
      return {
        ...profile.toObject(),
        certificates: certs
      };
    });

    res.status(200).json({
      success: true,
      data: profilesWithCerts,
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

    const updateData = {};
    if (status !== undefined) {
      updateData.profileStatus = status;
    }
    if (rejectionReason !== undefined) {
      updateData.rejectionReason = rejectionReason;
    }

    const profile = await CaregiverProfile.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    ).populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái hồ sơ thành công',
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
      location, // { address, coordinates?, district? }
      packageId,
      skills = [],
      requiredCertificates = [],
      preferredCertificates = [],
      preferredGender = null,
      minExperience = 0,
      maxDistance = 7, // km
      override = {}, // { healthConditions, personality, specialNeeds }
    } = req.body || {};

    // Geocode địa chỉ careseeker nếu chưa có coordinates
    let resolvedLocation = location ? { ...location } : null;
    if (
      resolvedLocation &&
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

    // Lấy certificates cho caregivers từ bảng Certificate
    const caregiverProfileIds = caregivers.map((c) => c._id);
    const certificatesByCaregiver = await Certificate.find({
      caregiverProfile: { $in: caregiverProfileIds },
      status: 'approved' // Chỉ lấy certificates đã duyệt
    })
      .select('caregiverProfile name certificateType')
      .lean();

    const certificatesMap = caregiverProfileIds.reduce((acc, id) => {
      acc[id.toString()] = [];
      return acc;
    }, {});
    certificatesByCaregiver.forEach((cert) => {
      const key = cert.caregiverProfile?.toString();
      if (key && certificatesMap[key]) certificatesMap[key].push(cert.name);
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
        const cgCertNames = (certificatesMap[cg._id?.toString()] || []).map(c => c?.toLowerCase());
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

        if (
          finalRequiredCerts.length > 0 &&
          finalRequiredCerts.some((r) => !cgCertNames.includes(r?.toLowerCase()))
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
            cgCertNames.includes(r?.toLowerCase())
          );
          certScore += allHave ? weights.certificates * 0.7 : 0;
        }
        if (finalPreferredCerts.length > 0) {
          const prefMatched = finalPreferredCerts.filter((r) =>
            cgCertNames.includes(r?.toLowerCase())
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
      message: caregivers.length > 0 ? 'Tìm kiếm caregiver thành công' : 'Không tìm thấy caregiver phù hợp',
      count: caregivers.length,
      data: caregivers,
      searchType: 'manual',
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
      .populate('user', 'name email phone')
      .select('-idCardNumber -idCardFrontImage -idCardBackImage -temporaryAddress -permanentAddress');

    if (!caregiver) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver',
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
      limit = 20
    } = req.query;

    const caregivers = await CaregiverProfile.find({})
      .select('-idCardNumber -idCardFrontImage -idCardBackImage -temporaryAddress -permanentAddress')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const count = await CaregiverProfile.countDocuments({});

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
