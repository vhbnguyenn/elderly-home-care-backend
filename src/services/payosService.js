const axios = require('axios');
const crypto = require('crypto');

// PayOS API Configuration
const PAYOS_API_URL = process.env.PAYOS_API_URL || 'https://api-merchant.payos.vn';

// Payment API credentials (Thu tiền - Payment Collection)
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

// Payout API credentials (Chi tiền - Disbursement) - KEYS RIÊNG!
// Nếu không set, sẽ fallback về payment keys (cho sandbox testing)
const PAYOS_PAYOUT_CLIENT_ID = process.env.PAYOS_PAYOUT_CLIENT_ID || process.env.PAYOS_CLIENT_ID;
const PAYOS_PAYOUT_API_KEY = process.env.PAYOS_PAYOUT_API_KEY || process.env.PAYOS_API_KEY;
const PAYOS_PAYOUT_CHECKSUM_KEY = process.env.PAYOS_PAYOUT_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM_KEY;

/**
 * Tạo chữ ký (signature) cho PayOS request
 * @param {Object} data - Data payload
 * @param {string} checksumKey - Checksum key (payment or payout)
 */
const createSignature = (data, checksumKey = PAYOS_CHECKSUM_KEY) => {
  const sortedData = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  
  const dataString = JSON.stringify(sortedData);
  return crypto
    .createHmac('sha256', checksumKey)
    .update(dataString)
    .digest('hex');
};

/**
 * Tạo payment link cho careseeker nạp tiền vào ví
 * @param {Object} paymentData - { amount, userId, description }
 * @returns {Promise<Object>} - Payment URL và thông tin
 */
const createDepositPayment = async (paymentData) => {
  try {
    const { amount, userId, description } = paymentData;

    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
      throw new Error('PayOS credentials not configured. Please check .env file.');
    }

    // Tạo order code unique
    const orderCode = `DEPOSIT_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Prepare request payload
    const payload = {
      orderCode: orderCode,
      amount: Math.round(amount),
      description: description || `Nạp tiền vào ví ${userId}`,
      cancelUrl: `${process.env.FRONTEND_URL}/wallet/deposit/cancel?orderCode=${orderCode}`,
      returnUrl: `${process.env.FRONTEND_URL}/wallet/deposit/success?orderCode=${orderCode}`
    };

    // Create signature
    const signature = createSignature(payload);

    // Call PayOS API
    const response = await axios.post(
      `${PAYOS_API_URL}/v2/payment-requests`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY,
          'x-signature': signature
        },
        timeout: 30000
      }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ PayOS deposit payment created:', response.data);
    } else {
      console.log('✅ PayOS deposit payment created for order:', orderCode);
    }

    return {
      success: true,
      orderCode: orderCode,
      transactionId: response.data?.data?.id || response.data?.paymentLinkId,
      paymentUrl: response.data?.data?.checkoutUrl || response.data?.checkoutUrl,
      qrCode: response.data?.data?.qrCode,
      payosResponse: response.data
    };

  } catch (error) {
    console.error('❌ PayOS deposit error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      payosResponse: error.response?.data || null
    };
  }
};

/**
 * Tạo payment link cho booking
 * @param {Object} paymentData - { amount, bookingId, userId, description }
 * @returns {Promise<Object>} - Payment URL và thông tin
 */
const createBookingPayment = async (paymentData) => {
  try {
    const { amount, bookingId, userId, description } = paymentData;

    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
      throw new Error('PayOS credentials not configured. Please check .env file.');
    }

    // Tạo order code unique
    const orderCode = `BOOKING_${bookingId}_${Date.now()}`;

    // Prepare request payload
    const payload = {
      orderCode: orderCode,
      amount: Math.round(amount),
      description: description || `Thanh toán booking ${bookingId}`,
      cancelUrl: `${process.env.FRONTEND_URL}/bookings/${bookingId}/payment/cancel`,
      returnUrl: `${process.env.FRONTEND_URL}/bookings/${bookingId}/payment/success`
    };

    // Create signature
    const signature = createSignature(payload);

    // Call PayOS API
    const response = await axios.post(
      `${PAYOS_API_URL}/v2/payment-requests`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY,
          'x-signature': signature
        },
        timeout: 30000
      }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ PayOS booking payment created:', response.data);
    } else {
      console.log('✅ PayOS booking payment created for order:', orderCode);
    }

    return {
      success: true,
      orderCode: orderCode,
      transactionId: response.data?.data?.id || response.data?.paymentLinkId,
      paymentUrl: response.data?.data?.checkoutUrl || response.data?.checkoutUrl,
      qrCode: response.data?.data?.qrCode,
      payosResponse: response.data
    };

  } catch (error) {
    console.error('❌ PayOS booking payment error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      payosResponse: error.response?.data || null
    };
  }
};

/**
 * Rút tiền về tài khoản ngân hàng qua PayOS Payout API
 * 
 * @param {Object} withdrawalData - Thông tin rút tiền
 * @returns {Promise<Object>} - Kết quả từ PayOS
 */
const processWithdrawal = async (withdrawalData) => {
  try {
    const { amount, bankAccount, withdrawalId, description, type = 'admin' } = withdrawalData;

    // Kiểm tra Payout API credentials (KEYS RIÊNG cho chi tiền)
    if (!PAYOS_PAYOUT_CLIENT_ID || !PAYOS_PAYOUT_API_KEY || !PAYOS_PAYOUT_CHECKSUM_KEY) {
      throw new Error('PayOS Payout API credentials not configured. Please check PAYOS_PAYOUT_* keys in .env file.');
    }

    // Tạo order code unique
    const prefix = type === 'admin' ? 'ADMIN_WD' : 'CG_WD';
    const orderCode = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Prepare payout request payload
    const payload = {
      orderCode: orderCode,
      amount: Math.round(amount),
      description: description || `${type} withdrawal ${withdrawalId}`,
      accountNumber: bankAccount.accountNumber,
      accountName: bankAccount.accountName,
      bankCode: bankAccount.bankCode, // Bank code (VCB, TCB, MB...)
      // Optional: transferType (IMPS, NEFT, RTGS)
    };

    // Create signature (dùng PAYOUT checksum key - key riêng!)
    const signature = createSignature(payload, PAYOS_PAYOUT_CHECKSUM_KEY);

    // Call PayOS Payout API (dùng PAYOUT credentials - keys riêng!)
    const response = await axios.post(
      `${PAYOS_API_URL}/v2/payouts`, // Payout endpoint
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': PAYOS_PAYOUT_CLIENT_ID,    // ← Dùng Payout Client ID
          'x-api-key': PAYOS_PAYOUT_API_KEY,        // ← Dùng Payout API Key
          'x-signature': signature                   // ← Signature tạo từ Payout Checksum Key
        },
        timeout: 30000
      }
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ PayOS withdrawal initiated:', response.data);
    } else {
      console.log('✅ PayOS withdrawal initiated for order:', orderCode, 'Amount:', amount);
    }

    return {
      success: true,
      orderCode: orderCode,
      transactionId: response.data?.data?.id || response.data?.payoutId,
      status: response.data?.data?.status || 'processing',
      message: 'Withdrawal request sent to PayOS. Processing time: 1-3 business days.',
      payosResponse: response.data
    };

  } catch (error) {
    console.error('❌ PayOS withdrawal error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      payosResponse: error.response?.data || null
    };
  }
};

/**
 * Kiểm tra trạng thái giao dịch từ PayOS
 */
const checkTransactionStatus = async (orderCode) => {
  try {
    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY) {
      throw new Error('PayOS credentials not configured');
    }

    const response = await axios.get(
      `${PAYOS_API_URL}/v2/payment-requests/${orderCode}`,
      {
        headers: {
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      status: response.data?.data?.status,
      data: response.data
    };

  } catch (error) {
    console.error('PayOS check status error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify webhook signature từ PayOS
 */
const verifyWebhookSignature = (webhookData, signature) => {
  try {
    const calculatedSignature = createSignature(webhookData);
    return calculatedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
};

module.exports = {
  createDepositPayment,
  createBookingPayment,
  processWithdrawal,
  checkTransactionStatus,
  verifyWebhookSignature
};
