const mongoose = require('mongoose');

const careseekerReviewSchema = new mongoose.Schema(
  {
    // Careseeker đang đánh giá
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required']
    },
    // Caregiver được đánh giá
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver is required']
    },
    // Caregiver profile
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: [true, 'Caregiver profile is required']
    },
    // Booking liên quan
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required']
    },
    
    // Star Ratings (1-5 sao)
    ratings: {
      // Chuyên môn kỹ năng
      professionalism: {
        type: Number,
        required: [true, 'Professionalism rating is required'],
        min: 1,
        max: 5
      },
      // Thái độ phục vụ
      attitude: {
        type: Number,
        required: [true, 'Attitude rating is required'],
        min: 1,
        max: 5
      },
      // Đúng giờ
      punctuality: {
        type: Number,
        required: [true, 'Punctuality rating is required'],
        min: 1,
        max: 5
      },
      // Chất lượng chăm sóc
      careQuality: {
        type: Number,
        required: [true, 'Care quality rating is required'],
        min: 1,
        max: 5
      },
      // Giao tiếp
      communication: {
        type: Number,
        required: [true, 'Communication rating is required'],
        min: 1,
        max: 5
      }
    },
    
    // Mức độ hài lòng chung
    overallSatisfaction: {
      type: String,
      enum: ['very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied'],
      required: [true, 'Overall satisfaction is required']
    },
    
    // Điểm mạnh (có thể chọn nhiều)
    strengths: [{
      type: String,
      enum: [
        'professional_skills',
        'friendly_attitude',
        'patient',
        'careful',
        'good_communication',
        'punctual',
        'flexible',
        'experienced',
        'other'
      ]
    }],
    
    // Điểm cần cải thiện (có thể chọn nhiều)
    improvements: [{
      type: String,
      enum: [
        'technical_skills',
        'communication',
        'punctuality',
        'attitude',
        'attention_to_detail',
        'flexibility',
        'other'
      ]
    }],
    
    // Có muốn sử dụng lại dịch vụ không
    wouldUseAgain: {
      type: String,
      enum: ['definitely', 'probably', 'maybe', 'probably_not', 'definitely_not'],
      required: [true, 'Would use again is required']
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
    }
  },
  {
    timestamps: true
  }
);

// Indexes
careseekerReviewSchema.index({ reviewer: 1, booking: 1 }, { unique: true }); // Một booking chỉ được review 1 lần
careseekerReviewSchema.index({ caregiver: 1, isVisible: 1 });
careseekerReviewSchema.index({ caregiverProfile: 1 });
careseekerReviewSchema.index({ createdAt: -1 });

// Virtual: Tính điểm trung bình
careseekerReviewSchema.virtual('averageRating').get(function() {
  const { professionalism, attitude, punctuality, careQuality, communication } = this.ratings;
  return ((professionalism + attitude + punctuality + careQuality + communication) / 5).toFixed(1);
});

// Ensure virtuals are included in JSON
careseekerReviewSchema.set('toJSON', { virtuals: true });
careseekerReviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CareseekerReview', careseekerReviewSchema);
