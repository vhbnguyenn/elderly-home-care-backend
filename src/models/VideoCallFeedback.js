const mongoose = require('mongoose');

const videoCallFeedbackSchema = new mongoose.Schema(
  {
    // Người gửi feedback
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required']
    },
    // Người nhận cuộc gọi (đối phương)
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required']
    },
    // Booking liên quan (optional - có thể gọi video không liên quan booking)
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    // Chat session liên quan
    chatSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat'
    },
    
    // Thông tin cuộc gọi
    callInfo: {
      // Thời lượng cuộc gọi (giây)
      duration: {
        type: Number,
        min: 0
      },
      // Thời gian bắt đầu
      startTime: {
        type: Date
      },
      // Thời gian kết thúc
      endTime: {
        type: Date
      }
    },
    
    // Đánh giá chất lượng video
    videoQuality: {
      type: Number,
      required: [true, 'Video quality rating is required'],
      min: 1,
      max: 5,
      description: 'Chất lượng hình ảnh video (1-5 sao)'
    },
    
    // Đánh giá chất lượng âm thanh
    audioQuality: {
      type: Number,
      required: [true, 'Audio quality rating is required'],
      min: 1,
      max: 5,
      description: 'Chất lượng âm thanh (1-5 sao)'
    },
    
    // Độ ổn định kết nối
    connectionStability: {
      type: Number,
      required: [true, 'Connection stability rating is required'],
      min: 1,
      max: 5,
      description: 'Độ ổn định kết nối (1-5 sao)'
    },
    
    // Các vấn đề gặp phải (có thể chọn nhiều)
    issues: [{
      type: String,
      enum: [
        'video_lag',           // Video bị giật/lag
        'audio_delay',         // Âm thanh bị delay
        'disconnected',        // Bị ngắt kết nối
        'poor_video_quality',  // Chất lượng video kém
        'poor_audio_quality',  // Chất lượng audio kém
        'echo',                // Tiếng vọng
        'background_noise',    // Tiếng ồn nền
        'frozen_screen',       // Màn hình bị đơ
        'no_video',            // Không có video
        'no_audio',            // Không có âm thanh
        'other'                // Khác
      ]
    }],
    
    // Đánh giá tổng thể
    overallExperience: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor', 'very_poor'],
      required: [true, 'Overall experience is required']
    },
    
    // Ghi chú bổ sung
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Additional notes cannot exceed 500 characters']
    },
    
    // Có muốn sử dụng lại tính năng video call không
    wouldUseAgain: {
      type: Boolean,
      default: true
    },
    
    // Trạng thái
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
videoCallFeedbackSchema.index({ reviewer: 1, createdAt: -1 });
videoCallFeedbackSchema.index({ receiver: 1, createdAt: -1 });
videoCallFeedbackSchema.index({ booking: 1 });
videoCallFeedbackSchema.index({ chatSession: 1 });

// Virtual: Tính điểm trung bình
videoCallFeedbackSchema.virtual('averageRating').get(function() {
  return ((this.videoQuality + this.audioQuality + this.connectionStability) / 3).toFixed(1);
});

// Ensure virtuals are included in JSON
videoCallFeedbackSchema.set('toJSON', { virtuals: true });
videoCallFeedbackSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('VideoCallFeedback', videoCallFeedbackSchema);
