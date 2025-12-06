const mongoose = require('mongoose');

const caregiverReviewSchema = new mongoose.Schema(
  {
    // Caregiver đang đánh giá
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required']
    },
    // Careseeker được đánh giá
    careseeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Careseeker is required']
    },
    // Elderly profile được chăm sóc
    elderlyProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElderlyProfile',
      required: [true, 'Elderly profile is required']
    },
    // Booking liên quan
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required']
    },
    
    // Star Ratings (1-5 sao)
    ratings: {
      // Mức độ hợp tác
      cooperation: {
        type: Number,
        required: [true, 'Cooperation rating is required'],
        min: 1,
        max: 5
      },
      // Chất lượng giao tiếp
      communication: {
        type: Number,
        required: [true, 'Communication rating is required'],
        min: 1,
        max: 5
      },
      // Thái độ tôn trọng
      respect: {
        type: Number,
        required: [true, 'Respect rating is required'],
        min: 1,
        max: 5
      },
      // Tính sẵn sàng
      readiness: {
        type: Number,
        required: [true, 'Readiness rating is required'],
        min: 1,
        max: 5
      },
      // Môi trường làm việc
      workingEnvironment: {
        type: Number,
        required: [true, 'Working environment rating is required'],
        min: 1,
        max: 5
      }
    },
    
    // Sự hỗ trợ từ gia đình
    familySupport: {
      type: String,
      enum: ['very_supportive', 'supportive', 'neutral', 'minimal', 'none'],
      required: [true, 'Family support is required']
    },
    
    // Các vấn đề cần lưu ý
    issues: [{
      type: String,
      enum: [
        'late_payment',
        'schedule_changes',
        'unrealistic_expectations',
        'communication_difficulties',
        'safety_concerns',
        'hygiene_issues',
        'other'
      ]
    }],
    
    // Mức độ giới thiệu
    recommendation: {
      type: String,
      enum: ['highly_recommend', 'recommend', 'neutral', 'not_recommend'],
      required: [true, 'Recommendation is required']
    },
    
    // Ghi chú bổ sung
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Additional notes cannot exceed 1000 characters']
    },
    
    // Trạng thái
    status: {
      type: String,
      enum: ['active', 'hidden', 'flagged'],
      default: 'active'
    },
    
    // Admin có thể ẩn review nếu vi phạm
    isVisible: {
      type: Boolean,
      default: true
    },
    
    // Careseeker có thể phản hồi
    careseekerResponse: {
      text: {
        type: String,
        trim: true,
        maxlength: [500, 'Response cannot exceed 500 characters']
      },
      respondedAt: {
        type: Date
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
caregiverReviewSchema.index({ reviewer: 1, booking: 1 }, { unique: true }); // Một booking chỉ được review 1 lần
caregiverReviewSchema.index({ careseeker: 1, isVisible: 1 });
caregiverReviewSchema.index({ elderlyProfile: 1 });
caregiverReviewSchema.index({ createdAt: -1 });

// Virtual: Tính điểm trung bình
caregiverReviewSchema.virtual('averageRating').get(function() {
  const { cooperation, communication, respect, readiness, workingEnvironment } = this.ratings;
  return ((cooperation + communication + respect + readiness + workingEnvironment) / 5).toFixed(1);
});

// Ensure virtuals are included in JSON
caregiverReviewSchema.set('toJSON', { virtuals: true });
caregiverReviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CaregiverReview', caregiverReviewSchema);
