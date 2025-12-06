const Dispute = require('../models/Dispute');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { ROLES } = require('../constants');

// @desc    Create dispute/complaint
// @route   POST /api/disputes
// @access  Private (Caregiver & Careseeker)
exports.createDispute = async (req, res, next) => {
  try {
    const {
      bookingId,
      respondentId,
      disputeType,
      severity,
      title,
      description,
      evidence,
      requestedResolution,
      requestedAmount,
      refundBankInfo
    } = req.body;

    // Validate required fields
    if (!bookingId || !respondentId || !disputeType || !severity || !title || !description || !requestedResolution) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    // Validate booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy booking'
      });
    }

    // Check user có liên quan đến booking không
    const isCaregiver = booking.caregiver.toString() === req.user._id.toString();
    const isCareseeker = booking.careseeker.toString() === req.user._id.toString();

    if (!isCaregiver && !isCareseeker) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tạo khiếu nại cho booking này'
      });
    }

    // Validate refund bank info nếu careseeker yêu cầu hoàn tiền
    if (isCareseeker && (requestedResolution === 'refund' || requestedResolution === 'partial_refund')) {
      if (!refundBankInfo || !refundBankInfo.accountName || !refundBankInfo.accountNumber || !refundBankInfo.bankName) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp đầy đủ thông tin tài khoản ngân hàng để nhận hoàn tiền (tên tài khoản, số tài khoản, tên ngân hàng)'
        });
      }
    }

    // Validate respondent
    const respondent = await User.findById(respondentId);
    if (!respondent) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người bị khiếu nại'
      });
    }

    // Không thể tự khiếu nại chính mình
    if (respondentId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo khiếu nại cho chính mình'
      });
    }

    // Respondent phải là người còn lại trong booking
    const validRespondent = 
      (isCaregiver && respondentId === booking.careseeker.toString()) ||
      (isCareseeker && respondentId === booking.caregiver.toString());

    if (!validRespondent) {
      return res.status(400).json({
        success: false,
        message: 'Người bị khiếu nại phải là người tham gia booking này'
      });
    }

    // Set deadline (7 ngày từ khi tạo)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    // Create dispute
    const dispute = await Dispute.create({
      complainant: req.user._id,
      respondent: respondentId,
      booking: bookingId,
      disputeType,
      severity,
      title,
      description,
      evidence: evidence || [],
      requestedResolution,
      requestedAmount: requestedAmount || 0,
      refundBankInfo: refundBankInfo || undefined,
      priority: severity === 'critical' || severity === 'high' ? 'high' : 'medium',
      deadline
    });

    // Add timeline entry
    dispute.addTimelineEntry(
      'dispute_created',
      'Khiếu nại được tạo',
      req.user._id
    );
    await dispute.save();

    await dispute.populate([
      { path: 'complainant', select: 'name email role avatar' },
      { path: 'respondent', select: 'name email role avatar' },
      { path: 'booking', select: 'bookingDate bookingTime duration totalPrice' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Khiếu nại đã được gửi. Chúng tôi sẽ xem xét và liên hệ trong vòng 24-48 giờ.',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my disputes (as complainant)
// @route   GET /api/disputes/my-disputes
// @access  Private
exports.getMyDisputes = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt', status } = req.query;

    const filterQuery = { complainant: req.user._id };
    if (status) filterQuery.status = status;

    const disputes = await Dispute.find(filterQuery)
      .populate('respondent', 'name email role avatar')
      .populate('booking', 'bookingDate bookingTime duration totalPrice')
      .select('-internalNotes -timeline')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Dispute.countDocuments(filterQuery);

    // Status count
    const statusCount = await Dispute.aggregate([
      { $match: { complainant: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        disputes,
        statusCount: statusCount.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get disputes against me (as respondent)
// @route   GET /api/disputes/against-me
// @access  Private
exports.getDisputesAgainstMe = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt', status } = req.query;

    const filterQuery = { respondent: req.user._id };
    if (status) filterQuery.status = status;

    const disputes = await Dispute.find(filterQuery)
      .populate('complainant', 'name email role avatar')
      .populate('booking', 'bookingDate bookingTime duration totalPrice')
      .select('-internalNotes')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Dispute.countDocuments(filterQuery);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dispute detail
// @route   GET /api/disputes/:id
// @access  Private
exports.getDisputeDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dispute = await Dispute.findById(id)
      .populate('complainant', 'name email role avatar')
      .populate('respondent', 'name email role avatar')
      .populate('booking', 'bookingDate bookingTime duration totalPrice workLocation')
      .populate('assignedTo', 'name email')
      .populate('adminDecision.decidedBy', 'name email')
      .populate('timeline.performedBy', 'name email');

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    // Check permission
    const isComplainant = dispute.complainant._id.toString() === req.user._id.toString();
    const isRespondent = dispute.respondent._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isComplainant && !isRespondent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem khiếu nại này'
      });
    }

    // Remove internal notes if not admin
    if (!isAdmin) {
      dispute.internalNotes = undefined;
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Respondent responds to dispute
// @route   POST /api/disputes/:id/respond
// @access  Private (Respondent only)
exports.respondToDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, evidence } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung phản hồi'
      });
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    // Check is respondent
    if (dispute.respondent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền phản hồi khiếu nại này'
      });
    }

    // Check status
    if (!['pending', 'under_review', 'awaiting_response'].includes(dispute.status)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể phản hồi khiếu nại ở trạng thái này'
      });
    }

    dispute.respondentResponse = {
      message,
      evidence: evidence || [],
      respondedAt: new Date()
    };

    dispute.status = 'under_review';

    dispute.addTimelineEntry(
      'respondent_responded',
      'Người bị khiếu nại đã phản hồi',
      req.user._id
    );

    await dispute.save();
    await dispute.populate([
      { path: 'complainant', select: 'name email role avatar' },
      { path: 'respondent', select: 'name email role avatar' }
    ]);

    res.json({
      success: true,
      message: 'Phản hồi đã được gửi',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Withdraw dispute
// @route   POST /api/disputes/:id/withdraw
// @access  Private (Complainant only)
exports.withdrawDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    // Check is complainant
    if (dispute.complainant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người khiếu nại mới có thể rút khiếu nại'
      });
    }

    // Check status
    if (['resolved', 'rejected', 'withdrawn'].includes(dispute.status)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể rút khiếu nại đã được xử lý'
      });
    }

    dispute.status = 'withdrawn';
    dispute.addTimelineEntry(
      'dispute_withdrawn',
      reason || 'Người khiếu nại đã rút khiếu nại',
      req.user._id
    );

    await dispute.save();

    res.json({
      success: true,
      message: 'Khiếu nại đã được rút',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Rate dispute resolution
// @route   POST /api/disputes/:id/rate-resolution
// @access  Private (Complainant & Respondent)
exports.rateResolution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng đánh giá từ 1-5 sao'
      });
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    // Check is complainant or respondent
    const isComplainant = dispute.complainant.toString() === req.user._id.toString();
    const isRespondent = dispute.respondent.toString() === req.user._id.toString();

    if (!isComplainant && !isRespondent) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá khiếu nại này'
      });
    }

    // Check status
    if (!['resolved', 'rejected', 'refund_completed'].includes(dispute.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá sau khi khiếu nại được giải quyết'
      });
    }

    const satisfactionData = {
      rating,
      feedback: feedback || '',
      ratedAt: new Date()
    };

    if (isComplainant) {
      // Check if already rated
      if (dispute.complainantSatisfaction && dispute.complainantSatisfaction.rating) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã đánh giá rồi'
        });
      }
      dispute.complainantSatisfaction = satisfactionData;
    } else {
      // Check if already rated
      if (dispute.respondentSatisfaction && dispute.respondentSatisfaction.rating) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã đánh giá rồi'
        });
      }
      dispute.respondentSatisfaction = satisfactionData;
    }

    await dispute.save();

    res.json({
      success: true,
      message: 'Cảm ơn bạn đã đánh giá!',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// ========== ADMIN ENDPOINTS ==========

// @desc    Get all disputes (Admin)
// @route   GET /api/disputes/admin/all
// @access  Private (Admin only)
exports.getAllDisputes = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      status,
      disputeType,
      priority,
      severity,
      search
    } = req.query;

    const filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (disputeType) filterQuery.disputeType = disputeType;
    if (priority) filterQuery.priority = priority;
    if (severity) filterQuery.severity = severity;
    
    if (search) {
      filterQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const disputes = await Dispute.find(filterQuery)
      .populate('complainant', 'name email role avatar')
      .populate('respondent', 'name email role avatar')
      .populate('booking', 'bookingDate totalPrice')
      .populate('assignedTo', 'name email')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Dispute.countDocuments(filterQuery);

    // Statistics
    const stats = await Dispute.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byStatus: { $push: '$status' },
          byType: { $push: '$disputeType' },
          byPriority: { $push: '$priority' },
          bySeverity: { $push: '$severity' }
        }
      }
    ]);

    const statsData = stats[0] || {};
    const statusDist = {};
    const typeDist = {};
    const priorityDist = {};
    const severityDist = {};

    if (statsData.byStatus) statsData.byStatus.forEach(s => statusDist[s] = (statusDist[s] || 0) + 1);
    if (statsData.byType) statsData.byType.forEach(t => typeDist[t] = (typeDist[t] || 0) + 1);
    if (statsData.byPriority) statsData.byPriority.forEach(p => priorityDist[p] = (priorityDist[p] || 0) + 1);
    if (statsData.bySeverity) statsData.bySeverity.forEach(s => severityDist[s] = (severityDist[s] || 0) + 1);

    res.json({
      success: true,
      data: {
        disputes,
        statistics: {
          total: statsData.total || 0,
          byStatus: statusDist,
          byType: typeDist,
          byPriority: priorityDist,
          bySeverity: severityDist
        },
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign dispute to admin
// @route   PUT /api/disputes/:id/assign
// @access  Private (Admin only)
exports.assignDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    dispute.assignedTo = adminId || req.user._id;
    dispute.status = 'investigating';
    
    dispute.addTimelineEntry(
      'dispute_assigned',
      `Khiếu nại được giao cho admin`,
      req.user._id
    );

    await dispute.save();

    res.json({
      success: true,
      message: 'Khiếu nại đã được giao',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Make decision on dispute
// @route   POST /api/disputes/:id/decide
// @access  Private (Admin only)
exports.makeDecision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      decision,
      resolution,
      refundAmount,
      compensationAmount,
      actions,
      notes
    } = req.body;

    if (!decision || !resolution) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập quyết định và giải pháp'
      });
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    dispute.adminDecision = {
      decision,
      resolution,
      refundAmount: refundAmount || 0,
      compensationAmount: compensationAmount || 0,
      actions: actions || [],
      decidedBy: req.user._id,
      decidedAt: new Date(),
      notes: notes || ''
    };

    dispute.status = 'resolved';
    
    dispute.addTimelineEntry(
      'decision_made',
      `Admin đã đưa ra quyết định: ${decision}`,
      req.user._id
    );

    await dispute.save();
    await dispute.populate([
      { path: 'complainant', select: 'name email role' },
      { path: 'respondent', select: 'name email role' },
      { path: 'adminDecision.decidedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Quyết định đã được lưu',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update dispute status
// @route   PUT /api/disputes/:id/status
// @access  Private (Admin only)
exports.updateDisputeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn trạng thái'
      });
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    const oldStatus = dispute.status;
    dispute.status = status;
    
    dispute.addTimelineEntry(
      'status_updated',
      note || `Trạng thái chuyển từ ${oldStatus} sang ${status}`,
      req.user._id
    );

    await dispute.save();

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add internal note
// @route   POST /api/disputes/:id/internal-note
// @access  Private (Admin only)
exports.addInternalNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập ghi chú'
      });
    }

    const dispute = await Dispute.findById(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khiếu nại'
      });
    }

    dispute.internalNotes.push({
      note,
      addedBy: req.user._id,
      addedAt: new Date()
    });

    await dispute.save();
    await dispute.populate('internalNotes.addedBy', 'name email');

    res.json({
      success: true,
      message: 'Thêm ghi chú thành công',
      data: dispute
    });
  } catch (error) {
    next(error);
  }
};
