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
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Admin: xem tất cả
    if (req.user.role === ROLES.ADMIN) {
      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết lịch hẹn thành công',
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
        message: 'Bạn không có quyền truy cập lịch hẹn này'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
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
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền
    const isCaregiver = booking.caregiver.toString() === req.user._id.toString();
    const isCareseeker = booking.careseeker.toString() === req.user._id.toString();

    if (!isCaregiver && !isCareseeker && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    // Validate status transitions
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    // Caregiver chỉ có thể confirm hoặc cancel
    if (isCaregiver && !['confirmed', 'cancelled', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ đối với caregiver'
      });
    }

    booking.status = status;

    if (status === 'cancelled') {
      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          message: 'Cần cung cấp lý do hủy'
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
      message: `Cập nhật trạng thái lịch hẹn thành công: ${status}`,
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
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Chỉ caregiver được phép update task
    if (booking.caregiver.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ caregiver được phân công mới có thể cập nhật công việc'
      });
    }

    // Tìm task trong booking
    const task = booking.tasks.id(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy công việc'
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
      message: 'Cập nhật công việc thành công',
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
        message: 'Vui lòng nhập đầy đủ các thông tin bắt buộc',
      });
    }

    // Check package exists and is active
    const packageInfo = await Package.findById(packageId);
    if (!packageInfo || !packageInfo.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gói dịch vụ hoặc gói đang bị tắt',
      });
    }

    // Check caregiver exists and is approved
    const caregiverProfile = await CaregiverProfile.findById(caregiverId);
    if (!caregiverProfile || caregiverProfile.profileStatus !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy caregiver hoặc hồ sơ chưa được duyệt',
      });
    }

    // Check elderly profile exists and belongs to careseeker
    const ElderlyProfile = require('../models/ElderlyProfile');
    const elderlyProfile = await ElderlyProfile.findById(elderlyProfileId);
    if (!elderlyProfile || elderlyProfile.careseeker.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ người già hoặc bạn không có quyền',
      });
    }

    // Validate advance booking time based on package type
    const now = new Date();
    
    // Validate and parse startTime
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng giờ bắt đầu không hợp lệ. Dùng HH:mm (ví dụ: 08:00)',
      });
    }

    // Validate and parse startDate
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày bắt đầu không hợp lệ. Dùng YYYY-MM-DD (ví dụ: 2025-12-10)',
      });
    }

    const bookingDateTime = new Date(`${startDate}T${startTime}:00.000Z`);
    
    if (isNaN(bookingDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Giá trị ngày hoặc giờ không hợp lệ',
      });
    }

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
        message: `Gói ${packageInfo.packageType} yêu cầu đặt trước ít nhất ${requiredHours} giờ`,
      });
    }

    // Validate start time (7AM-5PM)
    const [hours] = startTime.split(':').map(Number);
    if (hours < 7 || hours >= 17) {
      return res.status(400).json({
        success: false,
        message: 'Giờ làm việc chỉ từ 07:00 đến 17:00',
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
      message: 'Tạo lịch hẹn thành công',
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
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền - chỉ caregiver của booking này
    if (booking.caregiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền check-in lịch hẹn này'
      });
    }

    // Kiểm tra booking đã confirmed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn phải được xác nhận trước khi check-in'
      });
    }

    // Kiểm tra đã check-in chưa
    if (booking.checkIn.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn đã được check-in trước đó'
      });
    }

    // Kiểm tra có upload ảnh không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Bắt buộc tải lên ảnh xác nhận'
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
        message: 'Không tìm thấy lịch hẹn'
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
        message: 'Bạn không có quyền thực hiện thao tác này'
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
