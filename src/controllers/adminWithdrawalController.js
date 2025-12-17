const AdminBankAccount = require('../models/AdminBankAccount');
const AdminWithdrawal = require('../models/AdminWithdrawal');
const Wallet = require('../models/Wallet');
const { processWithdrawal, checkTransactionStatus } = require('../services/payosService');

// @desc    Thêm/Cập nhật tài khoản ngân hàng admin
// @route   POST /api/admin-withdrawal/bank-account
// @access  Private (Admin only)
const addOrUpdateBankAccount = async (req, res, next) => {
  try {
    const { bankName, bankCode, accountNumber, accountName } = req.body;

    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin tài khoản ngân hàng'
      });
    }

    let bankAccount = await AdminBankAccount.findOne({ admin: req.user._id });

    if (bankAccount) {
      // Update existing
      bankAccount.bankName = bankName;
      bankAccount.bankCode = bankCode;
      bankAccount.accountNumber = accountNumber;
      bankAccount.accountName = accountName;
      await bankAccount.save();
    } else {
      // Create new
      bankAccount = await AdminBankAccount.create({
        admin: req.user._id,
        bankName,
        bankCode,
        accountNumber,
        accountName
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản ngân hàng thành công',
      data: bankAccount
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thông tin tài khoản ngân hàng admin
// @route   GET /api/admin-withdrawal/bank-account
// @access  Private (Admin only)
const getBankAccount = async (req, res, next) => {
  try {
    const bankAccount = await AdminBankAccount.findOne({ admin: req.user._id });

    res.status(200).json({
      success: true,
      data: bankAccount
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Rút tiền về tài khoản ngân hàng admin qua PayOS
// @route   POST /api/admin-withdrawal/withdraw
// @access  Private (Admin only)
const withdrawToBank = async (req, res, next) => {
  try {
    const { amount, note } = req.body;

    if (!amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền rút tối thiểu là 10,000 VND'
      });
    }

    // Kiểm tra tài khoản ngân hàng đã được thiết lập chưa
    const bankAccount = await AdminBankAccount.findOne({ 
      admin: req.user._id,
      isActive: true 
    });

    if (!bankAccount) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng thiết lập tài khoản ngân hàng trước khi rút tiền'
      });
    }

    // Kiểm tra số dư có sẵn trong hệ thống
    const wallets = await Wallet.find({});
    const totalPlatformFees = wallets.reduce((sum, w) => sum + w.totalPlatformFees, 0);
    
    // Tính tổng đã rút trước đó
    const completedWithdrawals = await AdminWithdrawal.find({
      status: 'completed'
    });
    const totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    
    const availableBalance = totalPlatformFees - totalWithdrawn;
    
    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Số dư không đủ. Số dư khả dụng: ${availableBalance.toLocaleString()} VND`
      });
    }

    // Tạo withdrawal request
    const withdrawal = await AdminWithdrawal.create({
      admin: req.user._id,
      amount,
      bankAccount: {
        bankName: bankAccount.bankName,
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName
      },
      status: 'processing',
      note,
      processedAt: new Date()
    });

    // Xử lý chuyển tiền qua PayOS
    const transferResult = await processWithdrawal({
      amount,
      bankAccount: {
        bankName: bankAccount.bankName,
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName
      },
      withdrawalId: withdrawal._id,
      description: note || `Admin withdrawal ${withdrawal._id}`
    });

    if (transferResult.success) {
      withdrawal.status = 'completed';
      withdrawal.payosTransactionId = transferResult.transactionId;
      withdrawal.payosOrderCode = transferResult.orderCode;
      withdrawal.payosResponse = transferResult.payosResponse;
      withdrawal.completedAt = new Date();
    } else {
      withdrawal.status = 'failed';
      withdrawal.failureReason = transferResult.error;
      withdrawal.payosResponse = transferResult.payosResponse;
    }

    await withdrawal.save();

    res.status(200).json({
      success: transferResult.success,
      message: transferResult.success 
        ? 'Rút tiền thành công' 
        : 'Rút tiền thất bại: ' + transferResult.error,
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        payosOrderCode: withdrawal.payosOrderCode,
        paymentUrl: transferResult.paymentUrl, // URL để admin xác nhận nếu cần
        bankAccount: withdrawal.bankAccount,
        completedAt: withdrawal.completedAt
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy lịch sử rút tiền
// @route   GET /api/admin-withdrawal/history
// @access  Private (Admin only)
const getWithdrawalHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = { admin: req.user._id };
    if (status) {
      query.status = status;
    }

    const withdrawals = await AdminWithdrawal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await AdminWithdrawal.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        totalPages: Math.ceil(count / limit),
        currentPage: Number(page),
        total: count
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tổng quan số dư có thể rút
// @route   GET /api/admin-withdrawal/available-balance
// @access  Private (Admin only)
const getAvailableBalance = async (req, res, next) => {
  try {
    const wallets = await Wallet.find({});
    
    const totalPlatformFees = wallets.reduce((sum, w) => sum + w.totalPlatformFees, 0);
    const totalCaregiverBalance = wallets.reduce((sum, w) => sum + w.availableBalance, 0);
    const totalPending = wallets.reduce((sum, w) => sum + w.pendingAmount, 0);

    // Tính tổng đã rút
    const completedWithdrawals = await AdminWithdrawal.find({
      status: 'completed'
    });
    const totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    res.status(200).json({
      success: true,
      data: {
        availableBalance: totalPlatformFees - totalWithdrawn,
        totalPlatformFees,
        totalWithdrawn,
        totalCaregiverBalance,
        totalPending,
        summary: {
          message: 'Số dư khả dụng = Tổng phí nền tảng - Tổng đã rút'
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Kiểm tra trạng thái giao dịch
// @route   GET /api/admin-withdrawal/status/:orderCode
// @access  Private (Admin only)
const checkWithdrawalStatus = async (req, res, next) => {
  try {
    const { orderCode } = req.params;

    const withdrawal = await AdminWithdrawal.findOne({ 
      payosOrderCode: orderCode,
      admin: req.user._id 
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    // Check status from PayOS
    const statusResult = await checkTransactionStatus(orderCode);

    if (statusResult.success) {
      // Update local status if needed
      const payosStatus = statusResult.status;
      
      if (payosStatus === 'PAID' && withdrawal.status !== 'completed') {
        withdrawal.status = 'completed';
        withdrawal.completedAt = new Date();
        await withdrawal.save();
      } else if (payosStatus === 'CANCELLED' && withdrawal.status !== 'failed') {
        withdrawal.status = 'failed';
        withdrawal.failureReason = 'Cancelled by user or expired';
        await withdrawal.save();
      }
    }

    res.status(200).json({
      success: true,
      data: {
        withdrawal,
        payosStatus: statusResult.data
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrUpdateBankAccount,
  getBankAccount,
  withdrawToBank,
  getWithdrawalHistory,
  getAvailableBalance,
  checkWithdrawalStatus
};
