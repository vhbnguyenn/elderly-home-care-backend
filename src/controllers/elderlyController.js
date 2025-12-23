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

    // Xử lý avatar nếu có upload
    if (req.file) {
      profileData.avatar = req.file.path; // Cloudinary URL
    }

    const profile = await ElderlyProfile.create(profileData);

    res.status(201).json({
      success: true,
      message: 'Tạo hồ sơ người già thành công',
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
        message: 'Không tìm thấy hồ sơ người già'
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
        message: 'Không tìm thấy hồ sơ người già'
      });
    }

    const updateData = { ...req.body };

    // Xử lý avatar nếu có upload
    if (req.file) {
      updateData.avatar = req.file.path; // Cloudinary URL
    }

    profile = await ElderlyProfile.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ người già thành công',
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
        message: 'Không tìm thấy hồ sơ người già'
      });
    }

    await profile.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa hồ sơ người già thành công'
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
  deleteElderlyProfile,
};
