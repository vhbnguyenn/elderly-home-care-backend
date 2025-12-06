const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    // Người khiếu nại
    complainant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Complainant is required']
    },
    
    // Người bị khiếu nại
    respondent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Respondent is required']
    },
    
    // Booking liên quan
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required']
    },
    
    // Loại khiếu nại
    disputeType: {
      type: String,
      enum: [
        'service_quality',        // Chất lượng dịch vụ
        'payment_issue',          // Vấn đề thanh toán
        'no_show',                // Không xuất hiện
        'late_arrival',           // Đến muộn
        'early_departure',        // Về sớm
        'unprofessional_behavior', // Hành vi không chuyên nghiệp
        'safety_concern',         // Vấn đề an toàn
        'breach_of_agreement',    // Vi phạm thỏa thuận
        'harassment',             // Quấy rối
        'theft_or_damage',        // Trộm cắp/làm hư hỏng
        'other'                   // Khác
      ],
      required: [true, 'Dispute type is required']
    },
    
    // Mức độ nghiêm trọng
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: [true, 'Severity is required']
    },
    
    // Tiêu đề khiếu nại
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    
    // Mô tả chi tiết
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters']
    },
    
    // Bằng chứng
    evidence: [{
      type: {
        type: String,
        enum: ['image', 'video', 'document', 'audio'],
        required: true
      },
      url: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Yêu cầu bồi thường/giải quyết
    requestedResolution: {
      type: String,
      enum: [
        'refund',              // Hoàn tiền
        'partial_refund',      // Hoàn một phần
        'compensation',        // Bồi thường
        'apology',             // Xin lỗi
        'account_warning',     // Cảnh cáo tài khoản
        'account_suspension',  // Tạm khóa tài khoản
        'other'                // Khác
      ],
      required: [true, 'Requested resolution is required']
    },
    
    // Số tiền yêu cầu (nếu có)
    requestedAmount: {
      type: Number,
      min: 0
    },
    
    // Thông tin tài khoản để hoàn tiền (chỉ cho careseeker khiếu nại + yêu cầu refund)
    refundBankInfo: {
      accountName: {
        type: String,
        trim: true,
        maxlength: [100, 'Account name cannot exceed 100 characters']
      },
      accountNumber: {
        type: String,
        trim: true,
        maxlength: [50, 'Account number cannot exceed 50 characters']
      },
      bankName: {
        type: String,
        trim: true,
        maxlength: [100, 'Bank name cannot exceed 100 characters']
      },
      bankBranch: {
        type: String,
        trim: true,
        maxlength: [100, 'Bank branch cannot exceed 100 characters']
      }
    },
    
    // Phản hồi từ người bị khiếu nại
    respondentResponse: {
      message: {
        type: String,
        trim: true,
        maxlength: [2000, 'Response message cannot exceed 2000 characters']
      },
      evidence: [{
        type: {
          type: String,
          enum: ['image', 'video', 'document', 'audio']
        },
        url: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }],
      respondedAt: {
        type: Date
      }
    },
    
    // Trạng thái
    status: {
      type: String,
      enum: [
        'pending',           // Chờ xử lý
        'under_review',      // Đang xem xét
        'awaiting_response', // Chờ phản hồi từ respondent
        'investigating',     // Đang điều tra
        'mediation',         // Đang hòa giải
        'refund_approved',   // Đã chấp thuận hoàn tiền
        'refund_processing', // Đang xử lý hoàn tiền
        'refund_completed',  // Đã hoàn tiền xong
        'resolved',          // Đã giải quyết
        'rejected',          // Từ chối
        'withdrawn',         // Rút khiếu nại
        'escalated'          // Leo thang
      ],
      default: 'pending'
    },
    
    // Admin xử lý
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Quyết định của admin
    adminDecision: {
      decision: {
        type: String,
        enum: [
          'favor_complainant',     // Chấp nhận khiếu nại
          'favor_respondent',      // Bác bỏ khiếu nại
          'partial_favor',         // Chấp nhận một phần
          'no_fault',              // Không có lỗi
          'mutual_fault'           // Cả hai có lỗi
        ]
      },
      resolution: {
        type: String,
        trim: true,
        maxlength: [2000, 'Resolution cannot exceed 2000 characters']
      },
      refundAmount: {
        type: Number,
        min: 0
      },
      compensationAmount: {
        type: Number,
        min: 0
      },
      actions: [{
        type: String,
        enum: [
          'warning_issued',
          'account_suspended',
          'refund_processed',
          'compensation_paid',
          'no_action',
          'other'
        ]
      }],
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      decidedAt: {
        type: Date
      },
      notes: {
        type: String,
        trim: true
      }
    },
    
    // Timeline/History
    timeline: [{
      action: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      performedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
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
    
    // Đánh giá của người khiếu nại về cách giải quyết
    complainantSatisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: {
        type: String,
        trim: true,
        maxlength: [500, 'Feedback cannot exceed 500 characters']
      },
      ratedAt: {
        type: Date
      }
    },
    
    // Đánh giá của người bị khiếu nại về cách giải quyết
    respondentSatisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: {
        type: String,
        trim: true,
        maxlength: [500, 'Feedback cannot exceed 500 characters']
      },
      ratedAt: {
        type: Date
      }
    },
    
    // Ngày đóng case
    closedAt: {
      type: Date
    },
    
    // Priority cho admin
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    
    // Deadline xử lý
    deadline: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
disputeSchema.index({ complainant: 1, createdAt: -1 });
disputeSchema.index({ respondent: 1, createdAt: -1 });
disputeSchema.index({ booking: 1 });
disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ priority: 1, status: 1 });
disputeSchema.index({ assignedTo: 1, status: 1 });
disputeSchema.index({ disputeType: 1, status: 1 });

// Pre-save middleware để update closedAt
disputeSchema.pre('save', function(next) {
  if (this.isModified('status') && ['resolved', 'rejected', 'withdrawn', 'refund_completed'].includes(this.status)) {
    if (!this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

// Method để thêm timeline entry
disputeSchema.methods.addTimelineEntry = function(action, description, userId) {
  this.timeline.push({
    action,
    description,
    performedBy: userId,
    performedAt: new Date()
  });
};

module.exports = mongoose.model('Dispute', disputeSchema);
