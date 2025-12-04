const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  type: {
    type: String,
    enum: ['earning', 'platform_fee', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

const walletSchema = new mongoose.Schema({
  caregiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Số dư khả dụng (sau khi trừ phí)
  availableBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Tổng doanh thu (gross - chưa trừ phí)
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  // Tổng phí nền tảng đã trừ
  totalPlatformFees: {
    type: Number,
    default: 0,
    min: 0
  },
  // Số tiền đang chờ xử lý (trong 24h)
  pendingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Lịch sử giao dịch
  transactions: [transactionSchema],
  // Thông tin cuối cùng cập nhật
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh transactions
walletSchema.index({ 'transactions.booking': 1 });

module.exports = mongoose.model('Wallet', walletSchema);
