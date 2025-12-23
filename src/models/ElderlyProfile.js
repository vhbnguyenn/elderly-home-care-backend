const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    required: true,
    trim: true
  },
  allergies: {
    type: String,
    trim: true
  }
});

const selfCareActivitySchema = new mongoose.Schema({
  activity: {
    type: String,
    enum: ['Ăn uống', 'Tắm rửa', 'Di chuyển', 'Mặc đồ'],
    required: true
  },
  needHelp: {
    type: Boolean,
    default: false
  }
});

const elderlyProfileSchema = new mongoose.Schema(
  {
    careseeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Careseeker is required']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: 0
    },
    gender: {
      type: String,
      enum: ['Nam', 'Nữ'],
      required: [true, 'Gender is required']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    // Toạ độ [lat, lon] để tính khoảng cách (optional)
    locationCoordinates: {
      type: [Number],
      default: undefined
    },
    phone: {
      type: String,
      trim: true
    },
    // Avatar người già
    avatar: {
      type: String,
      trim: true
    },
    // Nhóm máu
    bloodType: {
      type: String,
      enum: ['A', 'B', 'AB', 'O', 'Không rõ'],
      default: 'Không rõ'
    },
    // Bệnh nền
    medicalConditions: [{
      type: String,
      trim: true
    }],
    // Thuốc đang sử dụng
    medications: [medicationSchema],
    // Dị ứng
    allergies: {
      type: String,
      trim: true
    },
    // Mức độ tự lập
    selfCareActivities: [selfCareActivitySchema],
    // Môi trường sống
    livingEnvironment: {
      type: {
        type: String,
        enum: ['Căn hộ chung cư', 'Nhà riêng', 'Viện dưỡng lão', 'Khác']
      },
      hasFamily: {
        type: Boolean,
        default: false
      },
      familyNote: {
        type: String,
        trim: true
      }
    },
    // Sở thích & Ưa thích
    preferences: {
      hobbies: [{
        type: String,
        trim: true
      }],
      favoriteFoods: [{
        type: String,
        trim: true
      }],
      dietaryRestrictions: {
        type: String,
        trim: true
      }
    },
    // Liên hệ khẩn cấp
    emergencyContact: {
      name: {
        type: String,
        trim: true
      },
      relationship: {
        type: String,
        trim: true
      },
      phone: {
        type: String,
        trim: true
      }
    },
    // Ghi chú đặc biệt
    specialNotes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Index
elderlyProfileSchema.index({ careseeker: 1 });

module.exports = mongoose.model('ElderlyProfile', elderlyProfileSchema);
