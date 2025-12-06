const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: true
    },
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
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
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
