const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  issueDate: {
    type: Date
  },
  expirationDate: {
    type: Date // Ngày hết hạn (optional - một số chứng chỉ không có ngày hết hạn)
  },
  issuingOrganization: {
    type: String,
    trim: true
  },
  certificateType: {
    type: String
  },
  certificateImage: {
    type: String // URL của ảnh
  }
}, { _id: true });

const caregiverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true
    },
    // Thông tin cá nhân
    phoneNumber: {
      type: String,
      trim: true
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String
    },
    permanentAddress: {
      type: String,
      trim: true
    },
    temporaryAddress: {
      type: String,
      trim: true
    },
    // Toạ độ [lat, lon] để tính khoảng cách (optional)
    locationCoordinates: {
      type: [Number],
      default: undefined
    },
    idCardNumber: {
      type: String,
      trim: true,
      unique: true
    },
    idCardFrontImage: {
      type: String // URL
    },
    idCardBackImage: {
      type: String // URL
    },
    
    // Thông tin nghề nghiệp
    yearsOfExperience: {
      type: Number
    },
    workHistory: {
      type: String,
      trim: true
    },
    education: {
      type: String
    },
    universityDegreeImage: {
      type: String, // URL
      default: null
    },
    certificates: [certificateSchema],
    
    // Hồ sơ bổ sung
    profileImage: {
      type: String // URL
    },
    bio: {
      type: String,
      trim: true
    },
    
    // Cam kết
    agreeToEthics: {
      type: Boolean
    },
    agreeToTerms: {
      type: Boolean
    },
    
    // Trạng thái
    profileStatus: {
      type: String,
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    
    // Thông tin tài khoản ngân hàng (để rút tiền)
    bankAccount: {
      bankName: {
        type: String,
        trim: true
      },
      bankCode: {
        type: String,
        trim: true
      },
      accountNumber: {
        type: String,
        trim: true
      },
      accountName: {
        type: String,
        trim: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Bỏ validation pre-save hook

module.exports = mongoose.model('CaregiverProfile', caregiverProfileSchema);
