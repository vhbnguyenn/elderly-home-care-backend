const CaregiverProfile = require('../models/CaregiverProfile');
const User = require('../models/User');
const { createCaregiverProfileSchema } = require('../utils/validation');
const { ROLES } = require('../constants');

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

module.exports = {
  createProfile,
  getMyProfile,
  updateProfile,
  getAllProfiles,
  getProfileForAdmin,
  updateProfileStatus
};
