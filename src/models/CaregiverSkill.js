const mongoose = require('mongoose');

const caregiverSkillSchema = new mongoose.Schema({
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Tên kỹ năng là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    enum: [
      'medication', 'vital-signs', 'emergency', 'nutrition', 'exercise',
      'cognitive', 'bathing', 'wound-care', 'communication', 'first-aid',
      'stethoscope', 'injection', 'medical-bag', 'thermometer', 'heartbeat',
      'compassion', 'plant', 'flower', 'custom'
    ],
    default: 'medication'
  },
  isCustom: {
    type: Boolean,
    default: false,
    description: 'Kỹ năng tự tạo hay chọn từ danh sách có sẵn'
  },
  isDisplayedOnProfile: {
    type: Boolean,
    default: true,
    description: 'Hiển thị kỹ năng này trên profile hay không'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
caregiverSkillSchema.index({ caregiver: 1 });
caregiverSkillSchema.index({ caregiver: 1, isActive: 1 });
caregiverSkillSchema.index({ caregiver: 1, isDisplayedOnProfile: 1 });

// Prevent duplicate skills for same caregiver
caregiverSkillSchema.index({ caregiver: 1, name: 1 }, { unique: true });

// Static method to get skills by caregiver
caregiverSkillSchema.statics.getSkillsByCaregiver = async function(caregiverId) {
  return this.find({ caregiver: caregiverId, isActive: true })
    .sort({ createdAt: -1 });
};

// Static method to get displayed skills for profile
caregiverSkillSchema.statics.getDisplayedSkills = async function(caregiverId) {
  return this.find({ 
    caregiver: caregiverId, 
    isActive: true,
    isDisplayedOnProfile: true 
  }).sort({ createdAt: -1 });
};

// Static method to count active skills
caregiverSkillSchema.statics.countActiveSkills = async function(caregiverId) {
  return this.countDocuments({ caregiver: caregiverId, isActive: true });
};

const CaregiverSkill = mongoose.model('CaregiverSkill', caregiverSkillSchema);

module.exports = CaregiverSkill;
