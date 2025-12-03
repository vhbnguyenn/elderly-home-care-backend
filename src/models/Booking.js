const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    careseeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Careseeker is required']
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver is required']
    },
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: [true, 'Caregiver profile is required']
    },
    elderlyProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElderlyProfile',
      required: [true, 'Elderly profile is required']
    },
    // Thông tin lịch hẹn
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required']
    },
    bookingTime: {
      type: String,
      required: [true, 'Booking time is required']
    },
    servicePackage: {
      type: String,
      enum: ['Gói cơ bản'],
      required: [true, 'Service package is required']
    },
    duration: {
      type: Number, // Số giờ
      required: [true, 'Duration is required'],
      min: 1
    },
    workLocation: {
      type: String,
      required: [true, 'Work location is required'],
      trim: true
    },
    // Dịch vụ
    services: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      selected: {
        type: Boolean,
        default: false
      }
    }],
    // Task List (Danh sách công việc cần làm)
    tasks: [{
      taskName: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      isCompleted: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
      },
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Index để tìm kiếm nhanh
bookingSchema.index({ careseeker: 1, status: 1 });
bookingSchema.index({ caregiver: 1, status: 1 });
bookingSchema.index({ bookingDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
