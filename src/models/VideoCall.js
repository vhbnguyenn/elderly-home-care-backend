const mongoose = require('mongoose');

const videoCallSchema = new mongoose.Schema(
  {
    // Người gọi
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caller is required']
    },
    
    // Người nhận
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required']
    },
    
    // Booking liên quan (optional - có thể gọi ngoài booking)
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    
    // Loại cuộc gọi
    callType: {
      type: String,
      enum: ['video', 'audio'],
      default: 'video'
    },
    
    // Trạng thái
    status: {
      type: String,
      enum: [
        'ringing',      // Đang đổ chuông
        'ongoing',      // Đang trong cuộc gọi
        'ended',        // Kết thúc bình thường
        'missed',       // Nhỡ cuộc gọi
        'rejected',     // Từ chối
        'failed'        // Lỗi kỹ thuật
      ],
      default: 'ringing'
    },
    
    // Thời gian bắt đầu đổ chuông
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    
    // Thời gian bắt đầu cuộc gọi (khi accept)
    startTime: {
      type: Date
    },
    
    // Thời gian kết thúc
    endTime: {
      type: Date
    },
    
    // Thời lượng cuộc gọi (giây)
    duration: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Người kết thúc cuộc gọi
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Lý do reject/fail
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [200, 'Rejection reason cannot exceed 200 characters']
    },
    
    // WebRTC signaling data (cho mobile exchange)
    signalingData: {
      offer: {
        type: mongoose.Schema.Types.Mixed
      },
      answer: {
        type: mongoose.Schema.Types.Mixed
      },
      iceCandidates: [{
        candidate: mongoose.Schema.Types.Mixed,
        from: {
          type: String,
          enum: ['caller', 'receiver']
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }]
    },
    
    // Thông tin thiết bị
    deviceInfo: {
      caller: {
        platform: String,    // ios, android, web
        deviceModel: String,
        osVersion: String,
        appVersion: String
      },
      receiver: {
        platform: String,
        deviceModel: String,
        osVersion: String,
        appVersion: String
      }
    },
    
    // Connection quality metrics
    qualityMetrics: {
      callerNetwork: {
        type: String,
        enum: ['wifi', '4g', '5g', '3g', 'unknown']
      },
      receiverNetwork: {
        type: String,
        enum: ['wifi', '4g', '5g', '3g', 'unknown']
      },
      avgBitrate: Number,      // kbps
      packetLoss: Number,      // percentage
      latency: Number          // ms
    }
  },
  {
    timestamps: true
  }
);

// Index cho query nhanh
videoCallSchema.index({ caller: 1, createdAt: -1 });
videoCallSchema.index({ receiver: 1, createdAt: -1 });
videoCallSchema.index({ booking: 1 });
videoCallSchema.index({ status: 1 });
videoCallSchema.index({ createdAt: -1 });

// Virtual: Tính duration từ startTime và endTime nếu chưa set
videoCallSchema.pre('save', function(next) {
  if (this.status === 'ended' && this.startTime && this.endTime && !this.duration) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Method: Mark as missed sau 30 giây không accept
videoCallSchema.methods.markAsMissed = async function() {
  this.status = 'missed';
  this.endTime = new Date();
  return this.save();
};

// Static: Get call history
videoCallSchema.statics.getHistory = function(userId, options = {}) {
  const { page = 1, limit = 20, callType, status } = options;
  
  const query = {
    $or: [
      { caller: userId },
      { receiver: userId }
    ]
  };
  
  if (callType) query.callType = callType;
  if (status) query.status = status;
  
  return this.find(query)
    .populate('caller', 'name avatar role')
    .populate('receiver', 'name avatar role')
    .populate('booking', 'bookingDate')
    .sort('-createdAt')
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static: Get statistics
videoCallSchema.statics.getStatistics = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { caller: userId },
          { receiver: userId }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        completedCalls: {
          $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
        },
        missedCalls: {
          $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] }
        },
        rejectedCalls: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        totalDuration: { $sum: '$duration' },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);
  
  return stats[0] || {
    totalCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    rejectedCalls: 0,
    totalDuration: 0,
    avgDuration: 0
  };
};

module.exports = mongoose.model('VideoCall', videoCallSchema);
