const mongoose = require('mongoose');

const adminWithdrawalSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [10000, 'Minimum withdrawal amount is 10,000 VND']
    },
    bankAccount: {
      bankName: String,
      bankCode: String,
      accountNumber: String,
      accountName: String
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    payosTransactionId: {
      type: String,
      trim: true
    },
    payosOrderCode: {
      type: String,
      trim: true
    },
    payosResponse: {
      type: mongoose.Schema.Types.Mixed
    },
    note: {
      type: String,
      trim: true
    },
    failureReason: {
      type: String,
      trim: true
    },
    processedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

adminWithdrawalSchema.index({ admin: 1, createdAt: -1 });
adminWithdrawalSchema.index({ status: 1 });
adminWithdrawalSchema.index({ payosOrderCode: 1 });

module.exports = mongoose.model('AdminWithdrawal', adminWithdrawalSchema);
