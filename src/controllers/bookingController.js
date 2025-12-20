const Booking = require('../models/Booking');
const BookingNote = require('../models/BookingNote');
const CaregiverProfile = require('../models/CaregiverProfile');
const Package = require('../models/Package');
const { ROLES } = require('../constants');
const { createBookingPayment } = require('../services/payosService');

// @desc    Lấy danh sách lịch hẹn của caregiver
// @route   GET /api/bookings/caregiver
// @access  Private (Caregiver only)
const getCaregiverBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const bookings = await Booking.find({ caregiver: req.user._id })
      .populate('careseeker', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const count = await Booking.countDocuments({ caregiver: req.user._id });

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

    res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
      data: booking || null
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
    const { page = 1, limit = 10 } = req.query;

    const bookings = await Booking.find({ careseeker: req.user._id })
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'profileImage bio yearsOfExperience')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const count = await Booking.countDocuments({ careseeker: req.user._id });

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

    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
    }
    if (cancellationReason !== undefined) {
      updateData.cancellationReason = cancellationReason;
      updateData.cancelledBy = req.user._id;
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    );

    // ✅ Tạo payment link khi caregiver hoàn thành booking (nếu chưa thanh toán)
    let paymentInfo = null;
    if (booking && status === 'completed' && booking.payment?.status === 'pending') {
      try {
        // Tạo payment link với PayOS
        const paymentResult = await createBookingPayment({
          amount: booking.totalPrice,
          bookingId: booking._id,
          userId: booking.careseeker,
          description: `Thanh toán booking ${booking._id}`
        });

        if (paymentResult.success) {
          // Cập nhật booking với payment info
          booking.payment.method = 'payos';
          booking.payment.transactionId = paymentResult.transactionId;
          booking.payment.qrCode = paymentResult.qrCode;
          await booking.save();

          // Trả về QR code cho caregiver
          paymentInfo = {
            qrCode: paymentResult.qrCode,
            paymentUrl: paymentResult.paymentUrl,
            orderCode: paymentResult.orderCode,
            amount: booking.totalPrice
          };

          console.log(`✅ Payment link created for completed booking ${booking._id}`);
        }
      } catch (error) {
        console.error('❌ Error creating payment link:', error);
        // Không throw error để không ảnh hưởng việc update status
      }
    }

    // ✅ Xử lý payment khi booking completed và đã thanh toán
    if (booking && status === 'completed' && booking.payment?.status === 'paid' && !booking.payment?.transferredToCaregiver) {
      const Wallet = require('../models/Wallet');
      const PLATFORM_FEE_PERCENTAGE = 15;
      
      try {
        // Kiểm tra đã qua 24h từ lúc thanh toán chưa
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const hasPassed24Hours = booking.payment.paidAt && 
          new Date(booking.payment.paidAt) <= twentyFourHoursAgo;
        
        // Tìm hoặc tạo wallet
        let wallet = await Wallet.findOne({ caregiver: booking.caregiver });
        if (!wallet) {
          wallet = new Wallet({ caregiver: booking.caregiver });
        }
        
        if (hasPassed24Hours) {
          // ✅ Đã qua 24h → Cộng vào availableBalance (trừ 15% phí) và totalEarnings
          const grossAmount = booking.totalPrice;
          const platformFee = Math.round(grossAmount * (PLATFORM_FEE_PERCENTAGE / 100));
          const netAmount = grossAmount - platformFee;

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

          console.log(`✅ Processed payment for booking ${booking._id}: ${netAmount}đ to caregiver (đã qua 24h)`);
        } else {
          // ✅ Chưa qua 24h → Thêm vào pendingAmount (chờ xử lý)
          wallet.pendingAmount += booking.totalPrice;
          wallet.lastUpdated = new Date();
          await wallet.save();
          
          console.log(`⏳ Added pending amount for booking ${booking._id}: ${booking.totalPrice}đ (chờ 24h)`);
        }
      } catch (error) {
        console.error('❌ Error processing payment for completed booking:', error);
        // Không throw error để không ảnh hưởng response
      }
    }

    await booking.populate([
      { path: 'careseeker', select: 'name email phone' },
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio' }
    ]);

    if (booking) {
      await booking.populate([
        { path: 'careseeker', select: 'name email phone' },
        { path: 'caregiver', select: 'name email phone' },
        { path: 'caregiverProfile', select: 'profileImage bio' }
      ]);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công',
      data: booking || null,
      paymentInfo: paymentInfo // QR code để caregiver đưa cho careseeker quét
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

    // Tìm task trong booking (nếu có)
    if (booking && booking.tasks) {
      const task = booking.tasks.id(taskId);
      if (task) {
        task.isCompleted = isCompleted !== undefined ? isCompleted : task.isCompleted;
        
        if (task.isCompleted) {
          task.completedAt = new Date();
          task.completedBy = req.user._id;
        } else {
          task.completedAt = null;
          task.completedBy = null;
        }

        await booking.save();
      }
    }

    if (booking) {
      await booking.populate([
        { path: 'careseeker', select: 'name email phone' },
        { path: 'caregiver', select: 'name email phone' },
        { path: 'caregiverProfile', select: 'profileImage bio' },
        { path: 'elderlyProfile' }
      ]);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật công việc thành công',
      data: booking || null
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

    // Get package info (if exists)
    const packageInfo = packageId ? await Package.findById(packageId) : null;

    // Get caregiver profile (if exists)
    const caregiverProfile = caregiverId ? await CaregiverProfile.findById(caregiverId) : null;

    // Get elderly profile (if exists)
    const ElderlyProfile = require('../models/ElderlyProfile');
    const elderlyProfile = elderlyProfileId ? await ElderlyProfile.findById(elderlyProfileId) : null;

    const now = new Date();
    
    // Parse booking date/time (try to parse, use now if invalid)
    let bookingDateTime = now;
    if (startDate && startTime) {
      try {
        const parsed = new Date(`${startDate}T${startTime}:00.000Z`);
        if (!isNaN(parsed.getTime())) {
          bookingDateTime = parsed;
        }
      } catch (e) {
        // Use default (now)
      }
    }

    // Calculate response deadline (BR-21 dynamic deadline)
    let responseDeadlineHours = 24;
    if (packageInfo && packageInfo.packageType === 'premium') {
      responseDeadlineHours = 48;
    } else if (packageInfo && packageInfo.packageType === 'professional') {
      responseDeadlineHours = 36;
    }

    const responseDeadline = new Date(now.getTime() + responseDeadlineHours * 60 * 60 * 1000);

    // Calculate total price
    const totalPrice = packageInfo?.price || 0;

    // Tạo services từ package
    const services = [];
    if (packageInfo?.services && packageInfo.services.length > 0) {
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
    if (packageInfo?.services && packageInfo.services.length > 0) {
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
      caregiver: caregiverProfile?.user || null,
      caregiverProfile: caregiverId || null,
      elderlyProfile: elderlyProfileId || null,
      package: packageId || null,
      bookingDate: bookingDateTime,
      bookingTime: startTime || null,
      duration: packageInfo?.duration || null,
      workLocation: address || null,
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

    if (booking) {
      // Lưu thông tin check-in
      if (req.file) {
        booking.checkIn.verificationImage = req.file.path; // Cloudinary URL
      }
      booking.checkIn.checkInTime = new Date();
      booking.checkIn.actualStartTime = actualStartTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      booking.checkIn.confirmedBy = req.user._id;
      booking.status = 'in-progress';

      await booking.save();
    }

    res.status(200).json({
      success: true,
      message: 'Đã bắt đầu! Ca làm việc đã được ghi nhận. Người nhà đã nhận thông báo.',
      data: booking ? {
        bookingId: booking._id,
        checkInTime: booking.checkIn.checkInTime,
        actualStartTime: booking.checkIn.actualStartTime,
        verificationImage: booking.checkIn.verificationImage,
        earnings: booking.totalPrice,
        status: booking.status
      } : null
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

    // Chỉ coi là đã check-in khi status là in-progress hoặc completed
    // Và có checkInTime (để tránh trường hợp status đã update nhưng chưa có checkInTime)
    const hasCheckedIn = booking && (booking.status === 'in-progress' || booking.status === 'completed') 
      && !!booking.checkIn?.checkInTime;

    res.status(200).json({
      success: true,
      data: booking ? {
        bookingId: booking._id,
        status: booking.status,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        workLocation: booking.workLocation,
        totalPrice: booking.totalPrice,
        caregiver: booking.caregiver,
        checkIn: {
          hasCheckedIn: hasCheckedIn,
          verificationImage: booking.checkIn?.verificationImage || null,
          checkInTime: booking.checkIn?.checkInTime || null,
          actualStartTime: booking.checkIn?.actualStartTime || null
        }
      } : null
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Create a new note for booking (Caregiver only)
// @route   POST /api/bookings/:id/notes
// @access  Private (Caregiver only - owner)
const createBookingNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Create note
    const note = await BookingNote.create({
      booking: id,
      caregiver: req.user._id,
      content: content || ''
    });

    await note.populate('caregiver', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Tạo ghi chú thành công',
      data: note
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all notes for a booking
// @route   GET /api/bookings/:id/notes
// @access  Private (Caregiver owner & Careseeker can view)
const getBookingNotes = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get all notes for this booking
    const notes = await BookingNote.find({ booking: id })
      .populate('caregiver', 'name avatar')
      .sort('-createdAt');

    res.json({
      success: true,
      data: {
        bookingId: id,
        notes,
        total: notes.length
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
  getCheckInInfo,
  createBookingNote,
  getBookingNotes
};
