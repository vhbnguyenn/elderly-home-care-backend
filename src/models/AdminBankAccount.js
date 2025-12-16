const mongoose = require('mongoose');

const adminBankAccountSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true
    },
    bankCode: {
      type: String,
      required: [true, 'Bank code is required'],
      trim: true
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true
    },
    accountName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AdminBankAccount', adminBankAccountSchema);
