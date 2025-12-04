const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Không bắt buộc vì là gói chung của hệ thống
    },
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: false // Không bắt buộc vì là gói chung của hệ thống
    },
    packageName: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive']
    },
    packageType: {
      type: String,
      enum: ['basic', 'professional', 'premium'],
      required: [true, 'Package type is required']
    },
    duration: {
      type: Number, // Thời gian (giờ/ngày)
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1']
    },
    paymentCycle: {
      type: String,
      enum: ['hourly', 'daily', 'monthly', 'shift'], // Thêm 'shift' = theo ca
      required: [true, 'Payment cycle is required']
    },
    services: [{
      type: String,
      trim: true
    }],
    customServices: [{
      type: String,
      trim: true
    }],
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isPopular: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index để tìm kiếm nhanh
packageSchema.index({ caregiver: 1, isActive: 1 });
packageSchema.index({ packageType: 1, isActive: 1 });

module.exports = mongoose.model('Package', packageSchema);
