const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Certificate name is required'],
    trim: true
  },
  issueDate: {
    type: Date,
    required: [true, 'Issue date is required']
  },
  issuingOrganization: {
    type: String,
    required: [true, 'Issuing organization is required'],
    trim: true
  },
  certificateType: {
    type: String,
    enum: ['chăm sóc người già', 'y tá', 'điều dưỡng', 'sơ cứu', 'dinh dưỡng', 'vật lí trị liệu', 'khác'],
    required: [true, 'Certificate type is required']
  },
  certificateImage: {
    type: String, // URL của ảnh
    required: [true, 'Certificate image is required']
  }
}, { _id: true });

const caregiverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    // Thông tin cá nhân
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['Nam', 'Nữ'],
      required: [true, 'Gender is required']
    },
    permanentAddress: {
      type: String,
      required: [true, 'Permanent address is required'],
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
      required: [true, 'ID card number is required'],
      trim: true,
      unique: true
    },
    idCardFrontImage: {
      type: String, // URL
      required: [true, 'ID card front image is required']
    },
    idCardBackImage: {
      type: String, // URL
      required: [true, 'ID card back image is required']
    },
    
    // Thông tin nghề nghiệp
    yearsOfExperience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: 0
    },
    workHistory: {
      type: String,
      required: [true, 'Work history is required'],
      trim: true
    },
    education: {
      type: String,
      enum: ['trung học cơ sở', 'trung học phổ thông', 'đại học', 'sau đại học'],
      required: [true, 'Education level is required']
    },
    universityDegreeImage: {
      type: String, // URL - Chỉ required nếu education là 'đại học' hoặc 'sau đại học'
      default: null
    },
    certificates: [certificateSchema],
    
    // Hồ sơ bổ sung
    profileImage: {
      type: String, // URL
      required: [true, 'Profile image is required']
    },
    bio: {
      type: String,
      required: [true, 'Bio is required'],
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    
    // Cam kết
    agreeToEthics: {
      type: Boolean,
      required: [true, 'Must agree to ethics'],
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Must agree to professional ethics'
      }
    },
    agreeToTerms: {
      type: Boolean,
      required: [true, 'Must agree to terms'],
      validate: {
        validator: function(v) {
          return v === true;
        },
        message: 'Must agree to terms and conditions'
      }
    },
    
    // Trạng thái
    profileStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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

// Validate universityDegreeImage required nếu education là đại học hoặc sau đại học
caregiverProfileSchema.pre('save', function(next) {
  if ((this.education === 'đại học' || this.education === 'sau đại học') && !this.universityDegreeImage) {
    next(new Error('University degree image is required for university education level'));
  }
  next();
});

module.exports = mongoose.model('CaregiverProfile', caregiverProfileSchema);
