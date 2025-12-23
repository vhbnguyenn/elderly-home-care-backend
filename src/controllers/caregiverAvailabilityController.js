const CaregiverAvailability = require('../models/CaregiverAvailability');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { ROLES } = require('../constants');
const mongoose = require('mongoose');

// @desc    Create/Update availability schedule
// @route   POST /api/caregiver-availability
// @access  Private (Caregiver only)
exports.createAvailability = async (req, res, next) => {
  try {
    const {
      recurrenceType = 'weekly',
      daysOfWeek,
      timeSlots,
      isAllDay = false,
      isHalfDay = false,
      startDate,
      endDate,
      notes
    } = req.body;

    // Create availability
    const availability = await CaregiverAvailability.create({
      caregiver: req.user._id,
      recurrenceType,
      daysOfWeek: daysOfWeek || [],
      timeSlots: timeSlots || [],
      isAllDay,
      isHalfDay,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || ''
    }, { runValidators: false, strict: false });

    // Populate caregiver sau khi tạo
    const populatedAvailability = await CaregiverAvailability.findById(availability._id)
      .populate('caregiver', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Lịch rảnh đã được lưu thành công',
      data: populatedAvailability || availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my availability schedules
// @route   GET /api/caregiver-availability/my-schedules
// @access  Private (Caregiver only)
exports.getMySchedules = async (req, res, next) => {
  try {
    const schedules = await CaregiverAvailability.find({ caregiver: req.user._id })
      .sort('-createdAt');

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get availability by ID
// @route   GET /api/caregiver-availability/:id
// @access  Private
exports.getAvailabilityById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const availability = await CaregiverAvailability.findById(id)
      .populate('caregiver', 'name email avatar phone');

    res.json({
      success: true,
      data: availability || null
    });
  } catch (error) {
    // Nếu lỗi CastError (id không hợp lệ) → trả về null
    if (error.name === 'CastError') {
      return res.json({
        success: true,
        data: null
      });
    }
    next(error);
  }
};

// @desc    Get caregiver's schedule for date range (for careseeker to view)
// @route   GET /api/caregiver-availability/caregiver/:caregiverId
// @access  Private
exports.getCaregiverSchedule = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;
    const { startDate, endDate } = req.query;

    // Convert caregiverId to ObjectId nếu cần
    let caregiverObjectId = caregiverId;
    try {
      if (mongoose.Types.ObjectId.isValid(caregiverId)) {
        caregiverObjectId = new mongoose.Types.ObjectId(caregiverId);
      }
    } catch (e) {
      // Ignore conversion error
    }

    const caregiver = await User.findById(caregiverObjectId);

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Get all availability schedules (không filter isActive)
    const availabilities = await CaregiverAvailability.find({
      caregiver: caregiverObjectId
    }).sort('startDate');

    // Build availability slots for each day
    const availabilitySlots = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[currentDate.getDay()];
      const daySlots = [];

      availabilities.forEach(avail => {
        // Check if this availability applies to this date
        const availStartDate = avail.startDate ? new Date(avail.startDate) : null;
        const availEndDate = avail.endDate ? new Date(avail.endDate) : null;
        
        // Normalize dates to compare only date part (ignore time)
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const availStartDateOnly = availStartDate ? new Date(availStartDate.getFullYear(), availStartDate.getMonth(), availStartDate.getDate()) : null;
        const availEndDateOnly = availEndDate ? new Date(availEndDate.getFullYear(), availEndDate.getMonth(), availEndDate.getDate()) : null;
        
        // Check date range
        const inDateRange = !availStartDateOnly || (currentDateOnly >= availStartDateOnly && (!availEndDateOnly || currentDateOnly <= availEndDateOnly));
        
        // Check day of week match
        const dayMatches = avail.recurrenceType === 'daily' || 
                          !avail.daysOfWeek || 
                          avail.daysOfWeek.length === 0 || 
                          avail.daysOfWeek.includes(dayOfWeek);
        
        if (inDateRange && dayMatches) {
          // Check exceptions
          const hasException = avail.exceptions && avail.exceptions.some(exc => {
            if (!exc.date) return false;
            const excDate = new Date(exc.date);
            return excDate.toDateString() === currentDate.toDateString();
          });

          if (!hasException) {
            // isAllDay = true: rảnh cả ngày
            if (avail.isAllDay === true) {
              daySlots.push({
                startTime: '00:00',
                endTime: '23:59',
                isAllDay: true
              });
            }
            // Có timeSlots: thêm slots
            else if (avail.timeSlots && avail.timeSlots.length > 0) {
              avail.timeSlots.forEach(slot => {
                if (slot.startTime && slot.endTime) {
                  daySlots.push({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isAllDay: false
                  });
                }
              });
            }
            // isAllDay undefined/null và không có timeSlots: coi như rảnh cả ngày
            else if (avail.isAllDay === undefined || avail.isAllDay === null) {
              daySlots.push({
                startTime: '00:00',
                endTime: '23:59',
                isAllDay: true
              });
            }
          }
        }
      });

      if (daySlots.length > 0) {
        availabilitySlots.push({
          date: new Date(currentDate),
          slots: daySlots
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: {
        caregiver: caregiver ? {
          _id: caregiver._id,
          name: caregiver.name,
          avatar: caregiver.avatar
        } : null,
        availabilitySlots,
        dateRange: {
          start,
          end
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get calendar view (availability + bookings) for caregiver
// @route   GET /api/caregiver-availability/calendar
// @access  Private (Caregiver only - own calendar)
exports.getCalendar = async (req, res, next) => {
  try {
    // Caregiver xem calendar của chính mình
    const caregiverId = req.user._id.toString();
    const { startDate, endDate } = req.query;

    const caregiver = await User.findById(caregiverId);

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Get availability schedules
    const availabilities = await CaregiverAvailability.find({
      caregiver: caregiverId
    }).sort('startDate');

    // Get bookings in date range
    // Convert caregiverId to ObjectId nếu cần
    const caregiverObjectId = mongoose.Types.ObjectId.isValid(caregiverId) 
      ? new mongoose.Types.ObjectId(caregiverId) 
      : caregiverId;
    
    const bookings = await Booking.find({
      caregiver: caregiverObjectId
    })
      .populate('careseeker', 'name avatar phone')
      .populate('elderlyProfile', 'fullName age')
      .sort('bookingDate');

    // Build calendar events
    const events = [];

    // Add availability as events
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[currentDate.getDay()];

      availabilities.forEach(avail => {
        // Check if this availability applies to this date
        const availStartDate = avail.startDate ? new Date(avail.startDate) : null;
        const availEndDate = avail.endDate ? new Date(avail.endDate) : null;
        
        // Check date range - nếu không có startDate thì coi như áp dụng mọi ngày
        const inDateRange = !availStartDate || (currentDate >= availStartDate && (!availEndDate || currentDate <= availEndDate));
        
        // Check day of week match
        // Nếu recurrenceType là 'daily' hoặc không có daysOfWeek hoặc daysOfWeek empty → match mọi ngày
        const dayMatches = avail.recurrenceType === 'daily' || 
                          !avail.daysOfWeek || 
                          avail.daysOfWeek.length === 0 || 
                          avail.daysOfWeek.includes(dayOfWeek);
        
        if (inDateRange && dayMatches) {
          // Check exceptions
          const hasException = avail.exceptions && avail.exceptions.some(exc => {
            if (!exc.date) return false;
            const excDate = new Date(exc.date);
            return excDate.toDateString() === currentDate.toDateString();
          });

          if (!hasException) {
            // isAllDay = true: rảnh cả ngày
            if (avail.isAllDay === true) {
              events.push({
                type: 'availability',
                date: new Date(currentDate),
                startTime: '00:00',
                endTime: '23:59',
                isAllDay: true,
                status: 'available',
                scheduleId: avail._id
              });
            }
            // Có timeSlots: thêm events theo timeSlots (bất kể isAllDay là gì)
            else if (avail.timeSlots && avail.timeSlots.length > 0) {
              avail.timeSlots.forEach(slot => {
                if (slot.startTime && slot.endTime) {
                  events.push({
                    type: 'availability',
                    date: new Date(currentDate),
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isAllDay: false,
                    status: 'available',
                    scheduleId: avail._id
                  });
                }
              });
            }
            // isAllDay = false và không có timeSlots: bận cả ngày, không thêm events
            // isAllDay undefined/null và không có timeSlots: coi như rảnh cả ngày (fallback)
            else if (avail.isAllDay === undefined || avail.isAllDay === null) {
              events.push({
                type: 'availability',
                date: new Date(currentDate),
                startTime: '00:00',
                endTime: '23:59',
                isAllDay: true,
                status: 'available',
                scheduleId: avail._id
              });
            }
            // isAllDay = false và không có timeSlots: không thêm (bận cả ngày)
          }
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add bookings as events
    const isOwner = caregiverId === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    
    bookings.forEach(booking => {
      events.push({
        type: 'booking',
        bookingId: booking._id,
        date: booking.bookingDate,
        startTime: booking.bookingTime,
        endTime: calculateEndTime(booking.bookingTime, booking.duration),
        status: booking.status,
        careseeker: isOwner || isAdmin ? {
          _id: booking.careseeker._id,
          name: booking.careseeker.name,
          avatar: booking.careseeker.avatar,
          phone: booking.careseeker.phone
        } : null,
        elderly: booking.elderlyProfile ? {
          name: booking.elderlyProfile.fullName,
          age: booking.elderlyProfile.age
        } : null,
        totalPrice: booking.totalPrice,
        workLocation: booking.workLocation
      });
    });

    // Sort events by date and time
    events.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({
      success: true,
      data: {
        caregiver: caregiver ? {
          _id: caregiver._id,
          name: caregiver.name,
          avatar: caregiver.avatar
        } : null,
        dateRange: {
          start,
          end
        },
        events,
        summary: {
          totalAvailableSlots: events.filter(e => e.type === 'availability').length,
          totalBookings: events.filter(e => e.type === 'booking').length,
          confirmedBookings: events.filter(e => e.type === 'booking' && e.status === 'confirmed').length,
          pendingBookings: events.filter(e => e.type === 'booking' && e.status === 'pending').length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate end time
function calculateEndTime(startTime, durationHours) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + (durationHours * 60);
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// ========== ADMIN ENDPOINTS ==========

// @desc    Get all availability schedules (Admin)
// @route   GET /api/caregiver-availability/admin/all
// @access  Private (Admin only)
exports.getAllSchedules = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const schedules = await CaregiverAvailability.find({})
      .populate('caregiver', 'name email phone avatar')
      .sort('-createdAt')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await CaregiverAvailability.countDocuments({});

    res.json({
      success: true,
      data: {
        schedules,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
