const Booking = require('../models/Booking');
const CaregiverProfile = require('../models/CaregiverProfile');
const { ROLES } = require('../constants');

// @desc    Lấy danh sách lịch hẹn của caregiver
// @route   GET /api/bookings/caregiver
// @access  Private (Caregiver only)
const getCaregiverBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, startDate, endDate } = req.query;

    const query = { caregiver: req.user._id };

    // Filter theo status
    if (status) {
      query.status = status;
    }

    // Filter theo ngày
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(query)
      .populate('careseeker', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio')
      .sort({ startDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết lịch hẹn
// @route   GET /api/bookings/:id
// @access  Private (Caregiver hoặc Careseeker)
const getBookingDetail = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('careseeker', 'name email phone')
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio yearsOfExperience education certificates')
      .populate('elderlyProfile'); // Populate đầy đủ thông tin người già

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền truy cập
    if (
      booking.careseeker.toString() !== req.user._id.toString() &&
      booking.caregiver.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách lịch hẹn của careseeker
// @route   GET /api/bookings/careseeker
// @access  Private (Careseeker only)
const getCareseekerBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { careseeker: req.user._id };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio yearsOfExperience')
      .sort({ startDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tất cả bookings (Admin only)
// @route   GET /api/bookings/all
// @access  Private (Admin only)
const getAllBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('careseeker', 'name email phone')
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật trạng thái booking
// @route   PUT /api/bookings/:id/status
// @access  Private (Caregiver hoặc Careseeker)
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền
    const isCaregiver = booking.caregiver.toString() === req.user._id.toString();
    const isCareseeker = booking.careseeker.toString() === req.user._id.toString();

    if (!isCaregiver && !isCareseeker && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Validate status transitions
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Caregiver chỉ có thể confirm hoặc cancel
    if (isCaregiver && !['confirmed', 'cancelled', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status for caregiver'
      });
    }

    booking.status = status;

    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
      }
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = req.user._id;
    }

    await booking.save();

    await booking.populate([
      { path: 'careseeker', select: 'name email phone' },
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio' }
    ]);

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật trạng thái task trong booking
// @route   PUT /api/bookings/:id/tasks/:taskId
// @access  Private (Caregiver only)
const updateTaskStatus = async (req, res, next) => {
  try {
    const { id, taskId } = req.params;
    const { isCompleted } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Chỉ caregiver được phép update task
    if (booking.caregiver.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned caregiver can update tasks'
      });
    }

    // Tìm task trong booking
    const task = booking.tasks.id(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Cập nhật trạng thái task
    task.isCompleted = isCompleted;
    
    if (isCompleted) {
      task.completedAt = new Date();
      task.completedBy = req.user._id;
    } else {
      task.completedAt = null;
      task.completedBy = null;
    }

    await booking.save();

    await booking.populate([
      { path: 'careseeker', select: 'name email phone' },
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio' },
      { path: 'elderlyProfile' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: booking
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCaregiverBookings,
  getCareseekerBookings,
  getBookingDetail,
  getAllBookings,
  updateBookingStatus,
  updateTaskStatus
};
