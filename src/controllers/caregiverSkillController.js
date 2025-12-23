const CaregiverSkill = require('../models/CaregiverSkill');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

// Add a new skill for caregiver
exports.addSkill = async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    // Chỉ caregiver mới tạo được skill cho chính mình
    // Tự động lấy caregiverId từ token (req.user._id)
    const caregiverId = req.user._id;

    // Create skill
    const skill = await CaregiverSkill.create({
      caregiver: caregiverId,
      name,
      description,
      icon: icon || 'medication',
      isDisplayedOnProfile: true // Mặc định hiển thị khi mới thêm
    }, {
      runValidators: false,
      strict: false
    });

    res.status(201).json({
      success: true,
      message: 'Thêm kỹ năng thành công',
      data: skill
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all skills of a caregiver (PUBLIC API - for profile display)
 * 
 * NOTE: API này dùng cho CARESEEKER xem profile của caregiver
 * - Public: Không cần authentication
 * - Mặc định: Chỉ hiển thị skills có isDisplayedOnProfile: true (cho careseeker thấy)
 * - Query displayedOnly=false: Lấy tất cả skills (cả ẩn và hiện) - ít dùng
 */
exports.getSkillsByCaregiver = async (req, res) => {
  try {
    const { caregiverId } = req.params;

    // Mặc định: Chỉ lấy skills được hiển thị trên profile (cho careseeker thấy)
    const skills = await CaregiverSkill.getDisplayedSkills(caregiverId);

    res.status(200).json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get my skills (PRIVATE API - for caregiver to manage their skills)
 * 
 * NOTE: API này dùng cho CAREGIVER xem và quản lý skills của chính mình
 * - Private: Cần authentication + role CAREGIVER
 * - Luôn trả về: TẤT CẢ skills (cả ẩn và hiện) - để caregiver quản lý
 * - Không có filter displayedOnly: Vì caregiver cần thấy tất cả để quản lý
 */
exports.getMySkills = async (req, res) => {
  try {
    // Luôn lấy TẤT CẢ skills (cả ẩn và hiện) để caregiver quản lý
    const skills = await CaregiverSkill.getSkillsByCaregiver(req.user._id);

    res.status(200).json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update a skill (Caregiver only - chỉ có thể sửa skill của chính mình)
exports.updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, isDisplayedOnProfile } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (isDisplayedOnProfile !== undefined) updateData.isDisplayedOnProfile = isDisplayedOnProfile;

    const skill = await CaregiverSkill.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: false }
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật kỹ năng thành công',
      data: skill || null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle skill display on profile (Caregiver only - chỉ có thể toggle skill của chính mình)
exports.toggleSkillDisplay = async (req, res) => {
  try {
    const { id } = req.params;

    const skill = await CaregiverSkill.findById(id);

    // Toggle display status
    if (skill) {
      skill.isDisplayedOnProfile = !skill.isDisplayedOnProfile;
      await skill.save({ runValidators: false });
    }

    res.status(200).json({
      success: true,
      message: skill ? `${skill.isDisplayedOnProfile ? 'Hiển thị' : 'Ẩn'} kỹ năng thành công` : 'Toggle thành công',
      data: skill || null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a skill (Caregiver only - chỉ có thể xóa skill của chính mình)
exports.deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete
    await CaregiverSkill.findByIdAndUpdate(
      id,
      { isActive: false },
      { runValidators: false }
    );

    res.status(200).json({
      success: true,
      message: 'Xóa kỹ năng thành công'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
