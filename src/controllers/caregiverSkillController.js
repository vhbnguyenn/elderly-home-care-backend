const CaregiverSkill = require('../models/CaregiverSkill');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');

// Predefined skills list
const PREDEFINED_SKILLS = [
  { name: 'Quản lý thuốc', description: 'Nhắc nhở và hỗ trợ uống thuốc', icon: 'medication' },
  { name: 'Đo sinh hiệu', description: 'Đo huyết áp, nhiệt độ, nhịp tim', icon: 'vital-signs' },
  { name: 'Sơ cấp cứu', description: 'Xử lý tình huống khẩn cấp', icon: 'emergency' },
  { name: 'Dinh dưỡng', description: 'Chuẩn bị bữa ăn lành mạnh', icon: 'nutrition' },
  { name: 'Vận động', description: 'Hỗ trợ tập luyện và vật lý trị liệu', icon: 'exercise' },
  { name: 'Alzheimer Care', description: 'Chăm sóc người mất trí nhớ', icon: 'cognitive' },
  { name: 'Vệ sinh cá nhân', description: 'Hỗ trợ tắm rửa và vệ sinh', icon: 'bathing' },
  { name: 'Chăm sóc vết thương', description: 'Băng bó và chăm sóc vết thương', icon: 'wound-care' },
  { name: 'Hỗ trợ giao tiếp', description: 'Trò chuyện và động viên tinh thần', icon: 'communication' },
  { name: 'Sơ cứu', description: 'Kỹ năng sơ cứu cơ bản', icon: 'first-aid' },
  { name: 'Khám sức khỏe', description: 'Theo dõi và ghi nhận sức khỏe', icon: 'stethoscope' },
  { name: 'Tiêm thuốc', description: 'Tiêm insulin và thuốc theo chỉ định', icon: 'injection' },
  { name: 'Hỗ trợ y tế', description: 'Hỗ trợ các thủ thuật y tế cơ bản', icon: 'medical-bag' },
  { name: 'Theo dõi nhiệt độ', description: 'Đo và theo dõi nhiệt độ cơ thể', icon: 'thermometer' },
  { name: 'Theo dõi tim mạch', description: 'Kiểm tra nhịp tim và huyết áp', icon: 'heartbeat' },
  { name: 'Chăm sóc tận tâm', description: 'Quan tâm và chăm sóc chu đáo', icon: 'compassion' },
  { name: 'Liệu pháp thiên nhiên', description: 'Sử dụng thảo mộc và liệu pháp tự nhiên', icon: 'plant' },
  { name: 'Chăm sóc hoa', description: 'Làm vườn và hoạt động ngoài trời', icon: 'flower' }
];

// Get predefined skills list
exports.getPredefinedSkills = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      count: PREDEFINED_SKILLS.length,
      data: PREDEFINED_SKILLS
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Add a new skill for caregiver
exports.addSkill = async (req, res) => {
  try {
    const { name, description, icon, isCustom } = req.body;
    const caregiverId = req.user.role === ROLES.CAREGIVER ? req.user.userId : req.body.caregiverId;

    // Verify caregiver exists
    const caregiver = await User.findById(caregiverId);
    if (!caregiver || caregiver.role !== ROLES.CAREGIVER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver'
      });
    }

    // Check if caregiver is adding their own skill or admin
    if (req.user.role === ROLES.CAREGIVER && caregiverId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể thêm kỹ năng cho chính mình'
      });
    }

    // Create skill
    const skill = await CaregiverSkill.create({
      caregiver: caregiverId,
      name,
      description,
      icon: isCustom ? 'custom' : icon,
      isCustom: isCustom || false,
      isDisplayedOnProfile: true // Mặc định hiển thị khi mới thêm
    });

    res.status(201).json({
      success: true,
      message: 'Thêm kỹ năng thành công',
      data: skill
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Kỹ năng này đã tồn tại'
      });
    }
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all skills of a caregiver (for profile display)
exports.getSkillsByCaregiver = async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const { displayedOnly } = req.query;

    let skills;
    if (displayedOnly === 'true') {
      // Chỉ lấy skills được hiển thị trên profile
      skills = await CaregiverSkill.getDisplayedSkills(caregiverId);
    } else {
      // Lấy tất cả skills
      skills = await CaregiverSkill.getSkillsByCaregiver(caregiverId);
    }

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

// Get my skills (for logged-in caregiver)
exports.getMySkills = async (req, res) => {
  try {
    if (req.user.role !== ROLES.CAREGIVER) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ caregiver mới có thể xem kỹ năng của mình'
      });
    }

    const skills = await CaregiverSkill.getSkillsByCaregiver(req.user.userId);

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

// Update a skill
exports.updateSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, isDisplayedOnProfile } = req.body;

    const skill = await CaregiverSkill.findById(id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỹ năng'
      });
    }

    // Check ownership
    if (req.user.role === ROLES.CAREGIVER && skill.caregiver.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể cập nhật kỹ năng của chính mình'
      });
    }

    // Update fields
    if (name !== undefined) skill.name = name;
    if (description !== undefined) skill.description = description;
    if (icon !== undefined) skill.icon = icon;
    if (isDisplayedOnProfile !== undefined) skill.isDisplayedOnProfile = isDisplayedOnProfile;

    await skill.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật kỹ năng thành công',
      data: skill
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle skill display on profile
exports.toggleSkillDisplay = async (req, res) => {
  try {
    const { id } = req.params;

    const skill = await CaregiverSkill.findById(id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỹ năng'
      });
    }

    // Check ownership
    if (req.user.role === ROLES.CAREGIVER && skill.caregiver.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể cập nhật kỹ năng của chính mình'
      });
    }

    // Toggle display status
    skill.isDisplayedOnProfile = !skill.isDisplayedOnProfile;
    await skill.save();

    res.status(200).json({
      success: true,
      message: `${skill.isDisplayedOnProfile ? 'Hiển thị' : 'Ẩn'} kỹ năng thành công`,
      data: skill
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a skill
exports.deleteSkill = async (req, res) => {
  try {
    const { id } = req.params;

    const skill = await CaregiverSkill.findById(id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỹ năng'
      });
    }

    // Check ownership
    if (req.user.role === ROLES.CAREGIVER && skill.caregiver.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể xóa kỹ năng của chính mình'
      });
    }

    // Soft delete
    skill.isActive = false;
    await skill.save();

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

// Batch add skills (for UI where user selects multiple skills at once)
exports.batchAddSkills = async (req, res) => {
  try {
    const { skills } = req.body; // Array of { name, description, icon }
    const caregiverId = req.user.role === ROLES.CAREGIVER ? req.user.userId : req.body.caregiverId;

    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách kỹ năng không hợp lệ'
      });
    }

    // Verify caregiver exists
    const caregiver = await User.findById(caregiverId);
    if (!caregiver || caregiver.role !== ROLES.CAREGIVER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver'
      });
    }

    // Check ownership
    if (req.user.role === ROLES.CAREGIVER && caregiverId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể thêm kỹ năng cho chính mình'
      });
    }

    // Add caregiver ID to each skill
    const skillsToCreate = skills.map(skill => ({
      ...skill,
      caregiver: caregiverId,
      isCustom: skill.isCustom || false,
      icon: skill.isCustom ? 'custom' : skill.icon,
      isDisplayedOnProfile: true // Mặc định hiển thị
    }));

    // Insert many (will skip duplicates due to unique index)
    const createdSkills = [];
    const errors = [];

    for (const skillData of skillsToCreate) {
      try {
        const skill = await CaregiverSkill.create(skillData);
        createdSkills.push(skill);
      } catch (error) {
        if (error.code === 11000) {
          errors.push({
            name: skillData.name,
            error: 'Kỹ năng đã tồn tại'
          });
        } else {
          errors.push({
            name: skillData.name,
            error: error.message
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Đã thêm ${createdSkills.length}/${skills.length} kỹ năng`,
      data: {
        created: createdSkills,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get skill statistics for admin
exports.getSkillStatistics = async (req, res) => {
  try {
    const stats = await CaregiverSkill.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 },
          icon: { $first: '$icon' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalCaregivers = await User.countDocuments({ role: ROLES.CAREGIVER });
    const caregiversWithSkills = await CaregiverSkill.distinct('caregiver').then(ids => ids.length);

    res.status(200).json({
      success: true,
      data: {
        skillDistribution: stats,
        totalCaregivers,
        caregiversWithSkills,
        caregiversWithoutSkills: totalCaregivers - caregiversWithSkills
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
