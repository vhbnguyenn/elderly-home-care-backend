const Booking = require('../models/Booking');
const { generateVietQR, generateMoMoQR, createVNPayPaymentUrl } = require('../services/paymentService');
const { addPendingAmount } = require('./walletController');
const { ROLES } = require('../constants');

// @desc    Generate payment QR code khi hoàn thành booking
// @route   POST /api/payments/generate-qr/:bookingId
// @access  Private (Careseeker, Caregiver or Admin)
const generatePaymentQR = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { paymentMethod } = req.body; // 'vietqr', 'momo', 'vnpay'

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền - caregiver hoặc careseeker của booking này hoặc admin
    const isCaregiver = booking.caregiver.toString() === req.user._id.toString();
    const isCareseeker = booking.careseeker.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isCaregiver && !isCareseeker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Kiểm tra booking đã completed chưa
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be completed before generating payment QR'
      });
    }

    // Kiểm tra đã thanh toán chưa
    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been paid'
      });
    }

    let paymentData;

    // Generate QR code theo phương thức
    if (paymentMethod === 'vietqr' || paymentMethod === 'bank_transfer') {
      paymentData = await generateVietQR(
        booking._id.toString(),
        booking.totalPrice,
        {
          bankName: process.env.BANK_NAME || 'Vietcombank',
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
          accountName: process.env.BANK_ACCOUNT_NAME || 'CONG TY ELDERLY CARE',
          bankCode: process.env.BANK_CODE || '970436'
        }
      );
      
      booking.payment.qrCode = paymentData.qrCodeUrl;
      booking.payment.method = 'bank_transfer';
      booking.payment.bankInfo = paymentData.bankInfo;
      
    } else if (paymentMethod === 'momo') {
      paymentData = await generateMoMoQR(
        booking._id.toString(),
        booking.totalPrice,
        {
          phoneNumber: process.env.MOMO_PHONE || '0123456789',
          name: process.env.MOMO_NAME || 'Elderly Care Service'
        }
      );
      
      booking.payment.qrCode = paymentData.qrCodeUrl;
      booking.payment.method = 'momo';
      
    } else if (paymentMethod === 'vnpay') {
      const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
      const vnpayUrl = createVNPayPaymentUrl(
        booking._id.toString(),
        booking.totalPrice,
        ipAddr,
        `${process.env.FRONTEND_URL}/payment/callback`
      );
      
      booking.payment.method = 'vnpay';
      
      paymentData = {
        paymentUrl: vnpayUrl,
        method: 'vnpay'
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Use: vietqr, momo, or vnpay'
      });
    }

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment QR generated successfully',
      data: {
        bookingId: booking._id,
        amount: booking.totalPrice,
        paymentMethod: paymentMethod,
        ...paymentData
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Xác nhận thanh toán thủ công
// @route   POST /api/payments/confirm/:bookingId
// @access  Private (Careseeker or Admin)
const confirmPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { transactionId, paymentMethod } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền - careseeker, caregiver hoặc admin
    const isCaregiver = booking.caregiver.toString() === req.user._id.toString();
    const isCareseeker = booking.careseeker.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isCaregiver && !isCareseeker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Update payment status
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    booking.payment.transactionId = transactionId;
    if (paymentMethod) {
      booking.payment.method = paymentMethod;
    }

    await booking.save();

    // Thêm vào pending amount (sẽ được xử lý sau 24h)
    await addPendingAmount(bookingId);

    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully. Funds will be available to caregiver in 24 hours.',
      data: booking
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Xử lý callback từ VNPay
// @route   GET /api/payments/vnpay/callback
// @access  Public
const handleVNPayCallback = async (req, res, next) => {
  try {
    const vnpParams = req.query;
    const secureHash = vnpParams.vnp_SecureHash;
    
    delete vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHashType;
    
    // Verify signature
    const crypto = require('crypto-js');
    const vnpHashSecret = process.env.VNPAY_HASH_SECRET || 'YOUR_HASH_SECRET';
    
    const sortedParams = Object.keys(vnpParams)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnpParams[key];
        return obj;
      }, {});
    
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.HmacSHA512(signData, vnpHashSecret);
    const signed = hmac.toString(crypto.enc.Hex);
    
    if (secureHash === signed) {
      const bookingIdMatch = vnpParams.vnp_TxnRef.match(/^(.+?)_/);
      const bookingId = bookingIdMatch ? bookingIdMatch[1] : vnpParams.vnp_TxnRef;
      
      const booking = await Booking.findById(bookingId);
      
      if (booking && vnpParams.vnp_ResponseCode === '00') {
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        booking.payment.transactionId = vnpParams.vnp_TransactionNo;
        booking.payment.method = 'vnpay';
        await booking.save();
        
        res.redirect(`${process.env.FRONTEND_URL}/payment/success?bookingId=${bookingId}`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL}/payment/failed?bookingId=${bookingId}`);
      }
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=invalid_signature`);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thông tin thanh toán của booking
// @route   GET /api/payments/:bookingId
// @access  Private
const getPaymentInfo = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .select('payment totalPrice status')
      .populate('careseeker', 'name email')
      .populate('caregiver', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền
    if (
      booking.careseeker._id.toString() !== req.user._id.toString() &&
      booking.caregiver._id.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        totalPrice: booking.totalPrice,
        payment: booking.payment,
        bookingStatus: booking.status
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  generatePaymentQR,
  confirmPayment,
  handleVNPayCallback,
  getPaymentInfo
};
