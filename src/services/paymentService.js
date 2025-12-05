const QRCode = require('qrcode');
const crypto = require('crypto-js');

// Generate VietQR code
const generateVietQR = async (bookingId, amount, bankInfo) => {
  try {
    // Format số tiền (VND)
    const formattedAmount = Math.round(amount);
    
    // Tạo nội dung chuyển khoản
    const transferContent = `ELDERLYCARE ${bookingId}`;
    
    // VietQR format: https://vietqr.io/
    // Bank ID: VCB (Vietcombank), TCB (Techcombank), MB (MBBank), etc.
    const vietQRData = {
      accountNo: bankInfo.accountNumber || '1234567890',
      accountName: bankInfo.accountName || 'CONG TY ELDERLY CARE',
      acqId: bankInfo.bankCode || '970436', // Vietcombank code
      amount: formattedAmount,
      addInfo: transferContent,
      format: 'text',
      template: 'compact'
    };

    // VietQR API URL
    const qrUrl = `https://img.vietqr.io/image/${vietQRData.acqId}-${vietQRData.accountNo}-${vietQRData.template}.png?amount=${vietQRData.amount}&addInfo=${encodeURIComponent(vietQRData.addInfo)}&accountName=${encodeURIComponent(vietQRData.accountName)}`;
    
    return {
      qrCodeUrl: qrUrl,
      bankInfo: {
        bankName: bankInfo.bankName || 'Vietcombank',
        accountNumber: bankInfo.accountNumber || '1234567890',
        accountName: bankInfo.accountName || 'CONG TY ELDERLY CARE',
        transferContent: transferContent
      },
      amount: formattedAmount
    };
  } catch (error) {
    throw new Error('Failed to generate VietQR: ' + error.message);
  }
};

// Generate MoMo QR code
const generateMoMoQR = async (bookingId, amount, momoInfo) => {
  try {
    const phoneNumber = momoInfo.phoneNumber || '0123456789';
    const name = momoInfo.name || 'Elderly Care Service';
    const note = `ELDERLYCARE ${bookingId}`;
    
    // MoMo deep link format
    const momoDeepLink = `https://nhantien.momo.vn/${phoneNumber}?amount=${amount}&note=${encodeURIComponent(note)}`;
    
    // Generate QR code từ deep link
    const qrCodeDataUrl = await QRCode.toDataURL(momoDeepLink, {
      width: 300,
      margin: 2,
      color: {
        dark: '#A50064', // MoMo brand color
        light: '#FFFFFF'
      }
    });
    
    return {
      qrCodeUrl: qrCodeDataUrl,
      deepLink: momoDeepLink,
      momoInfo: {
        phoneNumber: phoneNumber,
        name: name,
        note: note
      },
      amount: amount
    };
  } catch (error) {
    throw new Error('Failed to generate MoMo QR: ' + error.message);
  }
};

// VNPay payment URL generation
const createVNPayPaymentUrl = (bookingId, amount, ipAddr, returnUrl) => {
  try {
    const vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    const vnpTmnCode = process.env.VNPAY_TMN_CODE || 'YOUR_TMN_CODE';
    const vnpHashSecret = process.env.VNPAY_HASH_SECRET || 'YOUR_HASH_SECRET';
    
    const date = new Date();
    const createDate = formatDate(date);
    const orderId = `${bookingId}_${Date.now()}`;
    
    let vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpTmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toan dich vu cham soc nguoi gia - Booking ${bookingId}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay requires amount * 100
      vnp_ReturnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/callback`,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate
    };
    
    // Sort params
    const sortedParams = sortObject(vnpParams);
    
    // Create query string
    const signData = new URLSearchParams(sortedParams).toString();
    
    // Create signature
    const hmac = crypto.HmacSHA512(signData, vnpHashSecret);
    const signed = hmac.toString(crypto.enc.Hex);
    
    sortedParams.vnp_SecureHash = signed;
    
    const paymentUrl = vnpUrl + '?' + new URLSearchParams(sortedParams).toString();
    
    return paymentUrl;
  } catch (error) {
    throw new Error('Failed to create VNPay URL: ' + error.message);
  }
};

// Helper functions
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const sortObject = (obj) => {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
};

module.exports = {
  generateVietQR,
  generateMoMoQR,
  createVNPayPaymentUrl
};
