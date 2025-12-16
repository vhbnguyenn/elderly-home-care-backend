const Wallet = require('../models/Wallet');
const Booking = require('../models/Booking');
const AdminWithdrawal = require('../models/AdminWithdrawal');
const AdminBankAccount = require('../models/AdminBankAccount');
const {
  createDepositPayment,
  createBookingPayment,
  processWithdrawal,
  checkTransactionStatus,
  verifyWebhookSignature
} = require('../services/payosService');

const PLATFORM_FEE_PERCENTAGE = 15;

// ============ CARESEEKER: NẠP TIỀN VÀO VÍ ============

// @desc    Tạo link thanh toán để nạp tiền vào ví (Careseeker)
// @route   POST /api/payments/deposit
// @access  Private (Careseeker)
const createDeposit = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền nạp tối thiểu là 10,000 VND'
      });
    }

    if (amount > 50000000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền nạp tối đa là 50,000,000 VND'
      });
    }

    // Tạo payment link với PayOS
    const paymentResult = await createDepositPayment({
      amount,
      userId: req.user._id,
      description: `Nạp ${amount.toLocaleString()}đ vào ví`
    });

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo link thanh toán: ' + paymentResult.error
      });
    }

    // Tìm hoặc tạo ví cho user
    let wallet = await Wallet.findOne({ caregiver: req.user._id });
    if (!wallet) {
      wallet = new Wallet({ caregiver: req.user._id });
    }

    // Lưu transaction pending
    wallet.transactions.push({
      type: 'deposit',
      amount: amount,
      description: `Nạp tiền qua PayOS`,
      status: 'pending',
      payosOrderCode: paymentResult.orderCode,
      payosTransactionId: paymentResult.transactionId
    });

    await wallet.save();

    res.status(200).json({
      success: true,
      message: 'Link thanh toán đã được tạo',
      data: {
        orderCode: paymentResult.orderCode,
        paymentUrl: paymentResult.paymentUrl,
        qrCode: paymentResult.qrCode,
        amount: amount,
        expiresIn: '15 phút'
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Callback sau khi thanh toán deposit thành công (từ PayOS webhook)
// @route   POST /api/payments/deposit/callback
// @access  Public (Webhook)
const depositCallback = async (req, res, next) => {
  try {
    const { orderCode, status, transactionId } = req.body;

    // Verify signature từ PayOS
    const signature = req.headers['x-payos-signature'];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Tìm transaction trong ví
    const wallet = await Wallet.findOne({
      'transactions.payosOrderCode': orderCode
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = wallet.transactions.find(
      t => t.payosOrderCode === orderCode
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Cập nhật transaction
    if (status === 'PAID' || status === 'paid') {
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      transaction.payosTransactionId = transactionId;
      
      // Cộng tiền vào ví
      wallet.availableBalance += transaction.amount;
      wallet.lastUpdated = new Date();
      
      await wallet.save();

      console.log(`✅ Deposit completed: ${transaction.amount}đ for user ${wallet.caregiver}`);
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      transaction.status = 'failed';
      transaction.processedAt = new Date();
      await wallet.save();

      console.log(`❌ Deposit failed for order ${orderCode}`);
    }

    res.status(200).json({
      success: true,
      message: 'Callback processed'
    });

  } catch (error) {
    next(error);
  }
};

// ============ BOOKING: THANH TOÁN ============

// @desc    Tạo link thanh toán cho booking
// @route   POST /api/payments/booking/:bookingId
// @access  Private (Careseeker)
const createBookingPaymentLink = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền
    if (booking.careseeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Kiểm tra đã thanh toán chưa
    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking đã được thanh toán'
      });
    }

    // Tạo payment link với PayOS
    const paymentResult = await createBookingPayment({
      amount: booking.totalPrice,
      bookingId: booking._id,
      userId: req.user._id,
      description: `Thanh toán booking ${booking._id}`
    });

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo link thanh toán: ' + paymentResult.error
      });
    }

    // Cập nhật booking với payment info
    booking.payment.method = 'payos';
    booking.payment.transactionId = paymentResult.transactionId;
    booking.payment.qrCode = paymentResult.qrCode;

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Link thanh toán đã được tạo',
      data: {
        bookingId: booking._id,
        orderCode: paymentResult.orderCode,
        paymentUrl: paymentResult.paymentUrl,
        qrCode: paymentResult.qrCode,
        amount: booking.totalPrice,
        expiresIn: '15 phút'
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Callback sau khi thanh toán booking thành công
// @route   POST /api/payments/booking/callback
// @access  Public (Webhook)
const bookingPaymentCallback = async (req, res, next) => {
  try {
    const { orderCode, status, transactionId } = req.body;

    // Verify signature
    const signature = req.headers['x-payos-signature'];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // Extract booking ID from orderCode (BOOKING_{bookingId}_{timestamp})
    const bookingId = orderCode.split('_')[1];

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Cập nhật payment status
    if (status === 'PAID' || status === 'paid') {
      booking.payment.status = 'paid';
      booking.payment.paidAt = new Date();
      booking.payment.transactionId = transactionId;
      
      await booking.save();

      console.log(`✅ Booking ${bookingId} payment completed`);
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      booking.payment.status = 'failed';
      await booking.save();

      console.log(`❌ Booking ${bookingId} payment failed`);
    }

    res.status(200).json({
      success: true,
      message: 'Callback processed'
    });

  } catch (error) {
    next(error);
  }
};

// ============ CAREGIVER: RÚT TIỀN ============

// @desc    Lấy thông tin tài khoản ngân hàng caregiver
// @route   GET /api/payments/caregiver/bank-account
// @access  Private (Caregiver)
const getCaregiverBankAccount = async (req, res, next) => {
  try {
    const CaregiverProfile = require('../models/CaregiverProfile');
    
    const profile = await CaregiverProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bankAccount: profile.bankAccount || null
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật thông tin tài khoản ngân hàng caregiver
// @route   PUT /api/payments/caregiver/bank-account
// @access  Private (Caregiver)
const updateCaregiverBankAccount = async (req, res, next) => {
  try {
    const { bankName, bankCode, accountNumber, accountName } = req.body;

    if (!bankName || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin tài khoản ngân hàng'
      });
    }

    const CaregiverProfile = require('../models/CaregiverProfile');
    
    const profile = await CaregiverProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver profile not found'
      });
    }

    profile.bankAccount = {
      bankName,
      bankCode,
      accountNumber,
      accountName
    };

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật tài khoản ngân hàng thành công',
      data: {
        bankAccount: profile.bankAccount
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Caregiver rút tiền về ngân hàng
// @route   POST /api/payments/caregiver/withdraw
// @access  Private (Caregiver)
const caregiverWithdraw = async (req, res, next) => {
  try {
    const { amount, note } = req.body;

    if (!amount || amount < 50000) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền rút tối thiểu là 50,000 VND'
      });
    }

    // Kiểm tra tài khoản ngân hàng
    const CaregiverProfile = require('../models/CaregiverProfile');
    const profile = await CaregiverProfile.findOne({ user: req.user._id });

    if (!profile || !profile.bankAccount) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cập nhật thông tin tài khoản ngân hàng trước khi rút tiền'
      });
    }

    // Kiểm tra số dư
    let wallet = await Wallet.findOne({ caregiver: req.user._id });
    
    if (!wallet || wallet.availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Số dư không đủ. Số dư khả dụng: ${wallet?.availableBalance.toLocaleString() || 0} VND`
      });
    }

    // Tạo transaction pending
    wallet.transactions.push({
      type: 'withdrawal',
      amount: -amount,
      description: note || 'Rút tiền về ngân hàng',
      status: 'processing'
    });

    await wallet.save();

    const withdrawalId = wallet.transactions[wallet.transactions.length - 1]._id;

    // Xử lý rút tiền qua PayOS
    const transferResult = await processWithdrawal({
      amount,
      bankAccount: profile.bankAccount,
      withdrawalId,
      description: note || `Caregiver withdrawal ${req.user._id}`,
      type: 'caregiver'
    });

    // Cập nhật transaction
    const transaction = wallet.transactions.id(withdrawalId);

    if (transferResult.success) {
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      transaction.payosOrderCode = transferResult.orderCode;
      transaction.payosTransactionId = transferResult.transactionId;
      
      // Trừ tiền từ ví
      wallet.availableBalance -= amount;
      wallet.lastUpdated = new Date();
    } else {
      transaction.status = 'failed';
      transaction.processedAt = new Date();
    }

    await wallet.save();

    res.status(200).json({
      success: transferResult.success,
      message: transferResult.success 
        ? 'Rút tiền thành công' 
        : 'Rút tiền thất bại: ' + transferResult.error,
      data: {
        withdrawalId,
        amount,
        status: transaction.status,
        bankAccount: {
          bankName: profile.bankAccount.bankName,
          accountNumber: profile.bankAccount.accountNumber,
          accountName: profile.bankAccount.accountName
        },
        processedAt: transaction.processedAt
      }
    });

  } catch (error) {
    next(error);
  }
};

// ============ KIỂM TRA TRẠNG THÁI ============

// @desc    Kiểm tra trạng thái transaction
// @route   GET /api/payments/status/:orderCode
// @access  Private
const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderCode } = req.params;

    const statusResult = await checkTransactionStatus(orderCode);

    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể kiểm tra trạng thái: ' + statusResult.error
      });
    }

    res.status(200).json({
      success: true,
      data: {
        orderCode,
        status: statusResult.status,
        details: statusResult.data
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Deposit
  createDeposit,
  depositCallback,
  
  // Booking Payment
  createBookingPaymentLink,
  bookingPaymentCallback,
  
  // Caregiver Withdrawal
  getCaregiverBankAccount,
  updateCaregiverBankAccount,
  caregiverWithdraw,
  
  // Status Check
  getPaymentStatus
};
