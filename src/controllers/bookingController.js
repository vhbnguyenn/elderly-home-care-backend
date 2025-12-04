const Booking = require('../models/Booking');
const CaregiverProfile = require('../models/CaregiverProfile');
const Package = require('../models/Package');
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
// @access  Private (Admin, Caregiver, Careseeker)
const getBookingDetail = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('careseeker', 'name email phone')
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio yearsOfExperience education certificates')
      .populate('elderlyProfile') // Populate đầy đủ thông tin người già
      .populate('package'); // Populate package info

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Admin: xem tất cả
    if (req.user.role === ROLES.ADMIN) {
      return res.status(200).json({
        success: true,
        data: booking
      });
    }

    // Kiểm tra quyền truy cập cho Caregiver và Careseeker
    // Lấy ID từ populated object hoặc ObjectId
    const caregiverId = booking.caregiver._id ? booking.caregiver._id.toString() : booking.caregiver.toString();
    const careseekerId = booking.careseeker._id ? booking.careseeker._id.toString() : booking.careseeker.toString();
    const userId = req.user._id.toString();

    const isCaregiver = caregiverId === userId;
    const isCareseeker = careseekerId === userId;

    if (!isCaregiver && !isCareseeker) {
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

    // Check package exists and is active
    const packageInfo = await Package.findById(packageId);
    if (!packageInfo || !packageInfo.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
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

    // Tạo services từ package
    const services = [];
    if (packageInfo.services && packageInfo.services.length > 0) {
      packageInfo.services.forEach(serviceName => {
        services.push({
          name: serviceName,
          description: '',
          selected: true
        });
      });
    }

    // Tạo tasks từ services của package
    const tasks = [];
    if (packageInfo.services && packageInfo.services.length > 0) {
      packageInfo.services.forEach(serviceName => {
        tasks.push({
          taskName: serviceName,
          description: '',
          isCompleted: false
        });
      });
    }

    // Create booking
    const booking = await Booking.create({
      careseeker: req.user._id,
      caregiver: caregiverProfile.user,
      caregiverProfile: caregiverId,
      elderlyProfile: elderlyProfileId,
      package: packageId,
      bookingDate: bookingDateTime,
      bookingTime: startTime,
      duration: packageInfo.duration,
      workLocation: address,
      specialRequests: specialRequests || '',
      services,
      tasks,
      totalPrice,
      status: 'pending',
      responseDeadline,
    });

    await booking.populate([
      { path: 'careseeker', select: 'name email phone' },
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio yearsOfExperience education certificates' },
      { path: 'elderlyProfile' }, // Populate đầy đủ thông tin người già
      { path: 'package' }, // Populate package info
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

// @desc    Check-in bắt đầu ca làm việc (upload ảnh xác nhận)
// @route   POST /api/bookings/:id/checkin
// @access  Private (Caregiver only)
const checkInBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actualStartTime } = req.body;

    const booking = await Booking.findById(id)
      .populate('careseeker', 'name email phone')
      .populate('elderlyProfile');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Kiểm tra quyền - chỉ caregiver của booking này
    if (booking.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-in this booking'
      });
    }

    // Kiểm tra booking đã confirmed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking must be confirmed before check-in'
      });
    }

    // Kiểm tra đã check-in chưa
    if (booking.checkIn.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Booking already checked in'
      });
    }

    // Kiểm tra có upload ảnh không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Verification image is required'
      });
    }

    // Lưu thông tin check-in
    booking.checkIn.verificationImage = req.file.path; // Cloudinary URL
    booking.checkIn.checkInTime = new Date();
    booking.checkIn.actualStartTime = actualStartTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    booking.checkIn.confirmedBy = req.user._id;
    booking.status = 'in-progress';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Đã bắt đầu! Ca làm việc đã được ghi nhận. Người nhà đã nhận thông báo.',
      data: {
        bookingId: booking._id,
        checkInTime: booking.checkIn.checkInTime,
        actualStartTime: booking.checkIn.actualStartTime,
        verificationImage: booking.checkIn.verificationImage,
        earnings: booking.totalPrice,
        status: booking.status
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Xem thông tin check-in của booking
// @route   GET /api/bookings/:id/checkin
// @access  Private (Careseeker, Caregiver, Admin)
const getCheckInInfo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('caregiver', 'name email phone')
      .populate('careseeker', 'name email phone')
      .select('checkIn status bookingDate bookingTime totalPrice workLocation');

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
        status: booking.status,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        workLocation: booking.workLocation,
        totalPrice: booking.totalPrice,
        caregiver: booking.caregiver,
        checkIn: {
          hasCheckedIn: !!booking.checkIn.checkInTime,
          verificationImage: booking.checkIn.verificationImage || null,
          checkInTime: booking.checkIn.checkInTime || null,
          actualStartTime: booking.checkIn.actualStartTime || null
        }
      }
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
  checkInBooking,
  getCheckInInfo
};
