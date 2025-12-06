const mongoose = require('mongoose');

const systemFeedbackSchema = new mongoose.Schema(
  {
    // Người gửi feedback
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    
    // Loại feedback
    feedbackType: {
      type: String,
      enum: [
        'bug_report',           // Báo lỗi
        'feature_request',      // Đề xuất tính năng mới
        'improvement',          // Cải thiện tính năng hiện tại
        'user_experience',      // Trải nghiệm người dùng
        'performance',          // Hiệu suất hệ thống
        'complaint',            // Khiếu nại
        'compliment',           // Khen ngợi
        'other'                 // Khác
      ],
      required: [true, 'Feedback type is required']
    },
    
    // Danh mục liên quan
    category: {
      type: String,
      enum: [
        'booking',              // Đặt lịch
        'payment',              // Thanh toán
        'chat',                 // Chat/Tin nhắn
        'video_call',           // Video call
        'profile',              // Hồ sơ
        'search',               // Tìm kiếm
        'notification',         // Thông báo
        'review',               // Đánh giá
        'general',              // Chung
        'other'                 // Khác
      ],
      required: [true, 'Category is required']
    },
    
    // Mức độ ưu tiên (từ góc nhìn người dùng)
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    
    // Tiêu đề feedback
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    
    // Nội dung chi tiết
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    
    // Ảnh đính kèm (screenshots)
    attachments: [{
      url: {
        type: String,
        trim: true
      },
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
        default: 'image'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Thông tin thiết bị/môi trường
    deviceInfo: {
      platform: {
        type: String,
        enum: ['ios', 'android', 'web', 'other']
      },
      appVersion: {
        type: String
      },
      osVersion: {
        type: String
      },
      deviceModel: {
        type: String
      }
    },
    
    // Đánh giá mức độ hài lòng chung
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    
    // Trạng thái xử lý
    status: {
      type: String,
      enum: [
        'pending',       // Chờ xử lý
        'reviewing',     // Đang xem xét
        'in_progress',   // Đang xử lý
        'resolved',      // Đã giải quyết
        'closed',        // Đã đóng
        'rejected'       // Từ chối
      ],
      default: 'pending'
    },
    
    // Admin response
    adminResponse: {
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      message: {
        type: String,
        trim: true,
        maxlength: [1000, 'Response message cannot exceed 1000 characters']
      },
      respondedAt: {
        type: Date
      }
    },
    
    // Ghi chú nội bộ (chỉ admin thấy)
    internalNotes: [{
      note: {
        type: String,
        trim: true
      },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // User có hài lòng với cách xử lý không
    userSatisfactionWithResolution: {
      type: String,
      enum: ['satisfied', 'neutral', 'dissatisfied']
    },
    
    // Tags để dễ tìm kiếm
    tags: [String],
    
    // Số lần user follow up
    followUpCount: {
      type: Number,
      default: 0
    },
    
    // Ngày giải quyết
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
systemFeedbackSchema.index({ user: 1, createdAt: -1 });
systemFeedbackSchema.index({ feedbackType: 1, status: 1 });
systemFeedbackSchema.index({ category: 1, status: 1 });
systemFeedbackSchema.index({ priority: 1, status: 1 });
systemFeedbackSchema.index({ status: 1, createdAt: -1 });
systemFeedbackSchema.index({ tags: 1 });

// Pre-save middleware để cập nhật resolvedAt
systemFeedbackSchema.pre('save', function(next) {
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'closed')) {
    if (!this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
  next();
});

module.exports = mongoose.model('SystemFeedback', systemFeedbackSchema);
