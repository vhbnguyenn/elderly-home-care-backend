const Wallet = require('../models/Wallet');
const Booking = require('../models/Booking');
const { ROLES } = require('../constants');

const PLATFORM_FEE_PERCENTAGE = 15; // 15% phí nền tảng

// @desc    Xử lý tự động cộng tiền sau 24h khi booking hoàn tất và đã thanh toán
// @note    Được gọi bởi cron job hoặc scheduler
const processCompletedBookings = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Tìm các booking đã completed, đã paid, và đã qua 24h
    const eligibleBookings = await Booking.find({
      status: 'completed',
      'payment.status': 'paid',
      'payment.paidAt': { $lte: twentyFourHoursAgo },
      'payment.transferredToCaregiver': { $ne: true } // Chưa chuyển tiền
    }).populate('caregiver');

    for (const booking of eligibleBookings) {
      const grossAmount = booking.totalPrice;
      const platformFee = Math.round(grossAmount * (PLATFORM_FEE_PERCENTAGE / 100));
      const netAmount = grossAmount - platformFee;

      // Tìm hoặc tạo ví cho caregiver
      let wallet = await Wallet.findOne({ caregiver: booking.caregiver._id });
      
      if (!wallet) {
        wallet = new Wallet({ caregiver: booking.caregiver._id });
      }

      // Thêm giao dịch thu nhập
      wallet.transactions.push({
        booking: booking._id,
        type: 'earning',
        amount: grossAmount,
        description: `Thu nhập từ booking ${booking._id}`,
        status: 'completed',
        processedAt: new Date()
      });

      // Thêm giao dịch phí nền tảng
      wallet.transactions.push({
        booking: booking._id,
        type: 'platform_fee',
        amount: -platformFee,
        description: `Phí nền tảng ${PLATFORM_FEE_PERCENTAGE}%`,
        status: 'completed',
        processedAt: new Date()
      });

      // Cập nhật số dư
      wallet.availableBalance += netAmount;
      wallet.totalEarnings += grossAmount;
      wallet.totalPlatformFees += platformFee;
      wallet.pendingAmount = Math.max(0, wallet.pendingAmount - grossAmount);
      wallet.lastUpdated = new Date();

      await wallet.save();

      // Đánh dấu booking đã chuyển tiền
      booking.payment.transferredToCaregiver = true;
      booking.payment.transferredAt = new Date();
      await booking.save();

      console.log(`✅ Processed payment for booking ${booking._id}: ${netAmount}đ to caregiver`);
    }

    console.log(`📊 Processed ${eligibleBookings.length} bookings`);
    return eligibleBookings.length;

  } catch (error) {
    console.error('❌ Error processing completed bookings:', error);
    throw error;
  }
};

// @desc    Cập nhật pending amount khi có booking mới hoàn thành
const addPendingAmount = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    
    if (!booking || booking.status !== 'completed' || booking.payment.status !== 'paid') {
      return;
    }

    let wallet = await Wallet.findOne({ caregiver: booking.caregiver });
    
    if (!wallet) {
      wallet = new Wallet({ caregiver: booking.caregiver });
    }

    wallet.pendingAmount += booking.totalPrice;
    wallet.lastUpdated = new Date();
    await wallet.save();

  } catch (error) {
    console.error('Error adding pending amount:', error);
    throw error;
  }
};

// @desc    Lấy thông tin ví của caregiver
// @route   GET /api/wallet/my-wallet
// @access  Private (Caregiver only)
const getMyWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ caregiver: req.user._id })
      .populate({
        path: 'transactions.booking',
        select: 'bookingDate totalPrice status careseeker',
        populate: {
          path: 'careseeker',
          select: 'name email'
        }
      });

    if (!wallet) {
      wallet = new Wallet({ caregiver: req.user._id });
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      data: {
        availableBalance: wallet.availableBalance,
        totalEarnings: wallet.totalEarnings,
        totalPlatformFees: wallet.totalPlatformFees,
        pendingAmount: wallet.pendingAmount,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
        lastUpdated: wallet.lastUpdated
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy lịch sử giao dịch
// @route   GET /api/wallet/transactions
// @access  Private (Caregiver only)
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    let wallet = await Wallet.findOne({ caregiver: req.user._id });

    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: {
          transactions: [],
          totalPages: 0,
          currentPage: 1,
          total: 0
        }
      });
    }

    let transactions = wallet.transactions;

    // Filter by type if provided
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Sort by newest first
    transactions.sort((a, b) => b.createdAt - a.createdAt);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Populate booking details
    await Wallet.populate(paginatedTransactions, {
      path: 'booking',
      select: 'bookingDate bookingTime totalPrice status careseeker',
      populate: {
        path: 'careseeker',
        select: 'name email'
      }
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        totalPages: Math.ceil(transactions.length / limit),
        currentPage: Number(page),
        total: transactions.length,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Xem tổng quan ví (Admin)
// @route   GET /api/wallet/overview
// @access  Private (Admin only)
const getWalletOverview = async (req, res, next) => {
  try {
    const wallets = await Wallet.find()
      .populate('caregiver', 'name email phone')
      .sort({ totalEarnings: -1 });

    const totalStats = {
      totalCaregivers: wallets.length,
      totalAvailableBalance: wallets.reduce((sum, w) => sum + w.availableBalance, 0),
      totalEarnings: wallets.reduce((sum, w) => sum + w.totalEarnings, 0),
      totalPlatformFees: wallets.reduce((sum, w) => sum + w.totalPlatformFees, 0),
      totalPendingAmount: wallets.reduce((sum, w) => sum + w.pendingAmount, 0)
    };

    res.status(200).json({
      success: true,
      data: {
        stats: totalStats,
        wallets: wallets,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  processCompletedBookings,
  addPendingAmount,
  getMyWallet,
  getTransactions,
  getWalletOverview
};
