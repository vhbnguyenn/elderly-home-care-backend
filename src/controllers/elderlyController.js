const ElderlyProfile = require('../models/ElderlyProfile');
const { ROLES } = require('../constants');

// @desc    Tạo hồ sơ người già
// @route   POST /api/elderly
// @access  Private (Careseeker only)
const createElderlyProfile = async (req, res, next) => {
  try {
    const profileData = {
      ...req.body,
      careseeker: req.user._id
    };

    const profile = await ElderlyProfile.create(profileData);

    res.status(201).json({
      success: true,
      message: 'Elderly profile created successfully',
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách hồ sơ người già của careseeker
// @route   GET /api/elderly
// @access  Private (Careseeker only)
const getMyElderlyProfiles = async (req, res, next) => {
  try {
    const profiles = await ElderlyProfile.find({ careseeker: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: profiles
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết hồ sơ người già
// @route   GET /api/elderly/:id
// @access  Private (Careseeker hoặc Caregiver có booking)
const getElderlyProfileById = async (req, res, next) => {
  try {
    const profile = await ElderlyProfile.findById(req.params.id)
      .populate('careseeker', 'name email phone');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Elderly profile not found'
      });
    }

    // Kiểm tra quyền: chỉ careseeker sở hữu hoặc caregiver có booking mới xem được
    const isCareseeker = profile.careseeker._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isCareseeker && !isAdmin && req.user.role === ROLES.CAREGIVER) {
      // Nếu là caregiver, check xem có booking với elderly này không
      const Booking = require('../models/Booking');
      const hasBooking = await Booking.findOne({
        elderlyProfile: req.params.id,
        caregiver: req.user._id
      });

      if (!hasBooking) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this profile'
        });
      }
    } else if (!isCareseeker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this profile'
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

// @desc    Cập nhật hồ sơ người già
// @route   PUT /api/elderly/:id
// @access  Private (Careseeker only)
const updateElderlyProfile = async (req, res, next) => {
  try {
    let profile = await ElderlyProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Elderly profile not found'
      });
    }

    // Kiểm tra quyền
    if (profile.careseeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    profile = await ElderlyProfile.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Xóa hồ sơ người già
// @route   DELETE /api/elderly/:id
// @access  Private (Careseeker only)
const deleteElderlyProfile = async (req, res, next) => {
  try {
    const profile = await ElderlyProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Elderly profile not found'
      });
    }

    // Kiểm tra quyền
    if (profile.careseeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile'
      });
    }

    await profile.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createElderlyProfile,
  getMyElderlyProfiles,
  getElderlyProfileById,
  updateElderlyProfile,
  deleteElderlyProfile
};
