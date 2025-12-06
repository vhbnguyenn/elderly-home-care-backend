const CaregiverAvailability = require('../models/CaregiverAvailability');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { ROLES } = require('../constants');

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

    // Validate required fields
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ngày bắt đầu'
      });
    }

    if (recurrenceType === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một ngày trong tuần'
      });
    }

    if (!isAllDay && (!timeSlots || timeSlots.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng thêm ít nhất một khung giờ'
      });
    }

    // Validate time slots
    if (!isAllDay && timeSlots) {
      for (const slot of timeSlots) {
        if (!slot.startTime || !slot.endTime) {
          return res.status(400).json({
            success: false,
            message: 'Vui lòng điền đầy đủ thời gian cho mỗi khung giờ'
          });
        }

        if (slot.startTime >= slot.endTime) {
          return res.status(400).json({
            success: false,
            message: 'Giờ kết thúc phải sau giờ bắt đầu'
          });
        }
      }
    }

    // Create availability
    const availability = await CaregiverAvailability.create({
      caregiver: req.user._id,
      recurrenceType,
      daysOfWeek: daysOfWeek || [],
      timeSlots: timeSlots || [],
      isAllDay,
      isHalfDay,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || ''
    });

    await availability.populate('caregiver', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Lịch rảnh đã được lưu thành công',
      data: availability
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
    const { isActive, startDate, endDate } = req.query;

    const query = { caregiver: req.user._id };
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (startDate && endDate) {
      query.$or = [
        {
          startDate: { $lte: new Date(endDate) },
          $or: [
            { endDate: null },
            { endDate: { $gte: new Date(startDate) } }
          ]
        }
      ];
    }

    const schedules = await CaregiverAvailability.find(query)
      .sort('-createdAt');

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my schedule for a specific date (for UI calendar view)
// @route   GET /api/caregiver-availability/my-schedule-by-date
// @access  Private (Caregiver only)
exports.getMyScheduleByDate = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ngày'
      });
    }

    const checkDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[checkDate.getDay()];

    // Tìm tất cả schedules active cho ngày này
    const schedules = await CaregiverAvailability.find({
      caregiver: req.user._id,
      isActive: true,
      startDate: { $lte: checkDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: checkDate } }
      ],
      daysOfWeek: dayOfWeek
    });

    // Filter out exceptions (ngày nghỉ)
    const availableSchedules = schedules.filter(schedule => {
      const hasException = schedule.exceptions.some(exc => {
        const excDate = new Date(exc.date);
        return excDate.toDateString() === checkDate.toDateString();
      });
      return !hasException;
    });

    // Collect all time slots for this date
    const timeSlots = [];
    availableSchedules.forEach(schedule => {
      schedule.timeSlots.forEach(slot => {
        timeSlots.push({
          scheduleId: schedule._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAllDay: schedule.isAllDay,
          isHalfDay: schedule.isHalfDay,
          notes: schedule.notes
        });
      });
    });

    res.json({
      success: true,
      data: {
        date: checkDate,
        dayOfWeek,
        hasSchedule: timeSlots.length > 0,
        timeSlots,
        schedules: availableSchedules
      }
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

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch rảnh'
      });
    }

    // Check permission
    const isOwner = availability.caregiver._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin && req.user.role !== ROLES.CARE_SEEKER) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch rảnh này'
      });
    }

    res.json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update availability
// @route   PUT /api/caregiver-availability/:id
// @access  Private (Caregiver only - owner)
exports.updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      recurrenceType,
      daysOfWeek,
      timeSlots,
      isAllDay,
      isHalfDay,
      startDate,
      endDate,
      notes,
      isActive
    } = req.body;

    const availability = await CaregiverAvailability.findById(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch rảnh'
      });
    }

    // Check ownership
    if (availability.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa lịch rảnh này'
      });
    }

    // Update fields
    if (recurrenceType) availability.recurrenceType = recurrenceType;
    if (daysOfWeek) availability.daysOfWeek = daysOfWeek;
    if (timeSlots) availability.timeSlots = timeSlots;
    if (isAllDay !== undefined) availability.isAllDay = isAllDay;
    if (isHalfDay !== undefined) availability.isHalfDay = isHalfDay;
    if (startDate) availability.startDate = new Date(startDate);
    if (endDate !== undefined) availability.endDate = endDate ? new Date(endDate) : null;
    if (notes !== undefined) availability.notes = notes;
    if (isActive !== undefined) availability.isActive = isActive;

    await availability.save();
    await availability.populate('caregiver', 'name email avatar');

    res.json({
      success: true,
      message: 'Cập nhật lịch rảnh thành công',
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete availability
// @route   DELETE /api/caregiver-availability/:id
// @access  Private (Caregiver only - owner)
exports.deleteAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    const availability = await CaregiverAvailability.findById(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch rảnh'
      });
    }

    // Check ownership
    if (availability.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa lịch rảnh này'
      });
    }

    await availability.deleteOne();

    res.json({
      success: true,
      message: 'Xóa lịch rảnh thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add exception date (ngày nghỉ đột xuất)
// @route   POST /api/caregiver-availability/:id/exceptions
// @access  Private (Caregiver only - owner)
exports.addException = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, reason } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ngày nghỉ'
      });
    }

    const availability = await CaregiverAvailability.findById(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch rảnh'
      });
    }

    // Check ownership
    if (availability.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm ngày nghỉ'
      });
    }

    // Check if exception already exists
    const exceptionDate = new Date(date);
    const exists = availability.exceptions.some(exc => {
      return new Date(exc.date).toDateString() === exceptionDate.toDateString();
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ngày nghỉ này đã tồn tại'
      });
    }

    availability.exceptions.push({
      date: exceptionDate,
      reason: reason || 'Bận việc đột xuất'
    });

    await availability.save();

    res.json({
      success: true,
      message: 'Thêm ngày nghỉ thành công',
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove exception date
// @route   DELETE /api/caregiver-availability/:id/exceptions/:exceptionId
// @access  Private (Caregiver only - owner)
exports.removeException = async (req, res, next) => {
  try {
    const { id, exceptionId } = req.params;

    const availability = await CaregiverAvailability.findById(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch rảnh'
      });
    }

    // Check ownership
    if (availability.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa ngày nghỉ'
      });
    }

    availability.exceptions = availability.exceptions.filter(
      exc => exc._id.toString() !== exceptionId
    );

    await availability.save();

    res.json({
      success: true,
      message: 'Xóa ngày nghỉ thành công',
      data: availability
    });
  } catch (error) {
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

    // Validate caregiver exists
    const caregiver = await User.findById(caregiverId);
    if (!caregiver || caregiver.role !== ROLES.CAREGIVER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver'
      });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const schedules = await CaregiverAvailability.getSchedule(caregiverId, start, end);

    res.json({
      success: true,
      data: {
        caregiver: {
          _id: caregiver._id,
          name: caregiver.name,
          avatar: caregiver.avatar
        },
        schedules,
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

// @desc    Check if caregiver is available at specific time
// @route   POST /api/caregiver-availability/check-availability
// @access  Private
exports.checkAvailability = async (req, res, next) => {
  try {
    const { caregiverId, date, startTime, endTime } = req.body;

    if (!caregiverId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin'
      });
    }

    const checkDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[checkDate.getDay()];

    const availabilities = await CaregiverAvailability.find({
      caregiver: caregiverId,
      isActive: true,
      startDate: { $lte: checkDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: checkDate } }
      ],
      daysOfWeek: dayOfWeek
    });

    const isAvailable = availabilities.some(avail => {
      return avail.isAvailableAt(checkDate, startTime, endTime);
    });

    res.json({
      success: true,
      data: {
        isAvailable,
        matchingSchedules: isAvailable ? availabilities : []
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get calendar view (availability + bookings) for caregiver
// @route   GET /api/caregiver-availability/calendar/:caregiverId
// @access  Private (Caregiver owner & Careseeker can view)
exports.getCalendar = async (req, res, next) => {
  try {
    const { caregiverId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate caregiver exists
    const caregiver = await User.findById(caregiverId);
    if (!caregiver || caregiver.role !== ROLES.CAREGIVER) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver'
      });
    }

    // Check permission
    const isOwner = caregiverId === req.user._id.toString();
    const isCareseeker = req.user.role === ROLES.CARE_SEEKER;
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isCareseeker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem calendar này'
      });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Get availability schedules
    const availabilities = await CaregiverAvailability.find({
      caregiver: caregiverId,
      isActive: true,
      startDate: { $lte: end },
      $or: [
        { endDate: null },
        { endDate: { $gte: start } }
      ]
    }).sort('startDate');

    // Get bookings in date range
    const bookings = await Booking.find({
      caregiver: caregiverId,
      bookingDate: {
        $gte: start,
        $lte: end
      }
    })
      .populate('careseeker', 'name avatar phone')
      .populate('elderly', 'name age')
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
        if (
          currentDate >= avail.startDate &&
          (!avail.endDate || currentDate <= avail.endDate) &&
          (avail.recurrenceType === 'daily' || avail.daysOfWeek.includes(dayOfWeek))
        ) {
          // Check exceptions
          const hasException = avail.exceptions.some(exc => {
            const excDate = new Date(exc.date);
            return excDate.toDateString() === currentDate.toDateString();
          });

          if (!hasException) {
            avail.timeSlots.forEach(slot => {
              events.push({
                type: 'availability',
                date: new Date(currentDate),
                startTime: slot.startTime,
                endTime: slot.endTime,
                isAllDay: avail.isAllDay,
                status: 'available',
                scheduleId: avail._id
              });
            });
          }
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add bookings as events
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
        elderly: booking.elderly ? {
          name: booking.elderly.name,
          age: booking.elderly.age
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
        caregiver: {
          _id: caregiver._id,
          name: caregiver.name,
          avatar: caregiver.avatar
        },
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
    const { page = 1, limit = 20, caregiverId, isActive } = req.query;

    const query = {};
    if (caregiverId) query.caregiver = caregiverId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const schedules = await CaregiverAvailability.find(query)
      .populate('caregiver', 'name email phone avatar')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CaregiverAvailability.countDocuments(query);

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
