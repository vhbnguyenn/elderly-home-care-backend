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

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (Careseeker only)
const createBooking = async (req, res, next) => {
  try {
    const {
      caregiverId,
      packageId,
      elderlyProfileId,
      startDate,
      startTime,
      address,
      specialRequests,
    } = req.body;

    // Validate required fields
    if (!caregiverId || !packageId || !elderlyProfileId || !startDate || !startTime || !address) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
      });
    }

    // Check caregiver exists and is approved
    const caregiverProfile = await CaregiverProfile.findById(caregiverId);
    if (!caregiverProfile || caregiverProfile.profileStatus !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Caregiver not found or not approved',
      });
    }

    // Check caregiver is available
    if (!caregiverProfile.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Caregiver is not available',
      });
    }

    // Check package exists
    const packageInfo = caregiverProfile.packages.id(packageId);
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        message: 'Package not found',
      });
    }

    // Check elderly profile exists and belongs to careseeker
    const ElderlyProfile = require('../models/ElderlyProfile');
    const elderlyProfile = await ElderlyProfile.findById(elderlyProfileId);
    if (!elderlyProfile || elderlyProfile.careseeker.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Elderly profile not found or unauthorized',
      });
    }

    // Validate advance booking time based on package type
    const now = new Date();
    const bookingDateTime = new Date(`${startDate}T${startTime}`);
    const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

    const advanceBookingRequirements = {
      basic: 12,
      professional: 24,
      premium: 48,
    };

    const requiredHours = advanceBookingRequirements[packageInfo.packageType];
    if (hoursUntilBooking < requiredHours) {
      return res.status(400).json({
        success: false,
        message: `${packageInfo.packageType} package requires at least ${requiredHours} hours advance booking`,
      });
    }

    // Validate start time (7AM-5PM)
    const [hours] = startTime.split(':').map(Number);
    if (hours < 7 || hours >= 17) {
      return res.status(400).json({
        success: false,
        message: 'Service hours are 7AM to 5PM only',
      });
    }

    // Calculate response deadline (BR-21 dynamic deadline)
    let responseDeadlineHours = 24;
    if (packageInfo.packageType === 'premium') {
      responseDeadlineHours = 48;
    } else if (packageInfo.packageType === 'professional') {
      responseDeadlineHours = 36;
    }

    const responseDeadline = new Date(now.getTime() + responseDeadlineHours * 60 * 60 * 1000);

    // Calculate total price
    const totalPrice = packageInfo.price;

    // Create booking
    const booking = await Booking.create({
      careseeker: req.user._id,
      caregiver: caregiverProfile.user,
      caregiverProfile: caregiverId,
      elderlyProfile: elderlyProfileId,
      packageType: packageInfo.packageType,
      packageId,
      startDate: bookingDateTime,
      startTime,
      duration: packageInfo.duration,
      address,
      specialRequests: specialRequests || '',
      totalPrice,
      status: 'pending',
      responseDeadline,
    });

    await booking.populate([
      { path: 'careseeker', select: 'name email phone' },
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio yearsOfExperience' },
      { path: 'elderlyProfile', select: 'fullName age healthConditions' },
    ]);

    // TODO: Send notification to caregiver

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
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
  updateTaskStatus,
  createBooking,
};
