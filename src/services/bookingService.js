const Booking = require('../models/Booking');

/**
 * Calculate booking pricing
 * @param {Object} packageData - Package information
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} - Pricing breakdown
 */
const calculateBookingPrice = (packageData, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate days difference
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const basePrice = packageData.price * diffDays;
  const platformFee = basePrice * 0.1; // 10% platform fee
  const totalPrice = basePrice + platformFee;
  
  return {
    basePrice,
    platformFee,
    totalPrice,
    days: diffDays
  };
};

/**
 * Validate booking dates
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Object} - { valid: boolean, error?: string }
 */
const validateBookingDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  if (start < now) {
    return { valid: false, error: 'Ngày bắt đầu không được là quá khứ' };
  }
  
  if (end <= start) {
    return { valid: false, error: 'Ngày kết thúc phải sau ngày bắt đầu' };
  }
  
  return { valid: true };
};

/**
 * Check if caregiver is available for the booking period
 * @param {string} caregiverId - Caregiver ID
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<boolean>}
 */
const checkCaregiverAvailability = async (caregiverId, startDate, endDate) => {
  // Check for overlapping bookings
  const overlappingBookings = await Booking.find({
    caregiver: caregiverId,
    bookingStatus: { $in: ['pending', 'confirmed', 'in_progress'] },
    $or: [
      {
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) }
      }
    ]
  });
  
  return overlappingBookings.length === 0;
};

/**
 * Send booking notification
 * @param {string} userId - User ID to notify
 * @param {Object} bookingData - Booking information
 * @param {Object} io - Socket.IO instance
 */
const sendBookingNotification = (userId, bookingData, io) => {
  if (io && userId) {
    io.to(userId.toString()).emit('new-booking', {
      bookingId: bookingData._id,
      careseeker: bookingData.careseeker?.name,
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      totalPrice: bookingData.totalPrice,
      message: 'Bạn có lịch hẹn mới!'
    });
  }
};

module.exports = {
  calculateBookingPrice,
  validateBookingDates,
  checkCaregiverAvailability,
  sendBookingNotification,
};




