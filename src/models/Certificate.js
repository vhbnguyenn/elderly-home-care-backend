const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile'
    },
    name: {
      type: String,
      trim: true
    },
    issueDate: {
      type: Date
    },
    expirationDate: {
      type: Date // Ngày hết hạn (optional)
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
    },
    status: {
      type: String,
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
certificateSchema.index({ caregiver: 1, status: 1 });
certificateSchema.index({ caregiverProfile: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
