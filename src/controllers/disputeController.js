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

    // Lấy booking (không check tồn tại)
    const booking = await Booking.findById(bookingId);
    
    // Check user có liên quan đến booking không (authorization check - giữ lại, nhưng chỉ check nếu booking tồn tại)
    if (booking) {
      const isCaregiver = booking.caregiver && booking.caregiver.toString() === req.user._id.toString();
      const isCareseeker = booking.careseeker && booking.careseeker.toString() === req.user._id.toString();

      if (!isCaregiver && !isCareseeker) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền tạo khiếu nại cho booking này'
        });
      }
    }

    // Set deadline (7 ngày từ khi tạo)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    // Create dispute (không validate)
    const dispute = await Dispute.create({
      complainant: req.user._id,
      respondent: respondentId || req.user._id, // Fallback nếu không có
      booking: bookingId || null,
      disputeType: disputeType || 'other',
      severity: severity || 'medium',
      title: title || '',
      description: description || '',
      evidence: evidence || [],
      requestedResolution: requestedResolution || 'other',
      requestedAmount: requestedAmount || 0,
      refundBankInfo: refundBankInfo || undefined,
      priority: severity === 'critical' || severity === 'high' ? 'high' : 'medium',
      deadline
    }, { runValidators: false, strict: false });

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

    // Check permission (authorization check - giữ lại)
    const isAdmin = req.user.role === ROLES.ADMIN;
    if (dispute) {
      const isComplainant = dispute.complainant && dispute.complainant._id && dispute.complainant._id.toString() === req.user._id.toString();
      const isRespondent = dispute.respondent && dispute.respondent._id && dispute.respondent._id.toString() === req.user._id.toString();

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

    const dispute = await Dispute.findById(id);

    // Kiểm tra user là complainant hay respondent
    const isComplainant = dispute && dispute.complainant && dispute.complainant.toString() === req.user._id.toString();
    const isRespondent = dispute && dispute.respondent && dispute.respondent.toString() === req.user._id.toString();

    if (dispute && !isComplainant && !isRespondent) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền phản hồi khiếu nại này'
      });
    }

    // Kiểm tra admin có cho phép bên này phản hồi không (authorization check - giữ lại)
    if (dispute && isComplainant && !dispute.allowComplainantResponse) {
      return res.status(403).json({
        success: false,
        message: 'Admin chưa cho phép người khiếu nại phản hồi/bổ sung bằng chứng'
      });
    }

    if (dispute && isRespondent && !dispute.allowRespondentResponse) {
      return res.status(403).json({
        success: false,
        message: 'Admin chưa cho phép người bị khiếu nại phản hồi'
      });
    }

    if (dispute) {
      // Xác định người phản hồi
      const from = isComplainant ? 'complainant' : 'respondent';

      // Tạo response mới
      const newResponse = {
        from,
        userId: req.user._id,
        message: message || '',
        evidence: evidence || [],
        respondedAt: new Date()
      };

      // Thêm vào mảng responses
      if (!dispute.responses) {
        dispute.responses = [];
      }
      dispute.responses.push(newResponse);

      // Bổ sung bằng chứng vào mảng evidence chính nếu có
      if (evidence && evidence.length > 0) {
        if (!dispute.evidence) {
          dispute.evidence = [];
        }
        evidence.forEach(ev => {
          dispute.evidence.push({
            ...ev,
            uploadedAt: new Date()
          });
        });
      }

      // Cập nhật status
      dispute.status = 'under_review';

      // Thêm timeline entry
      const timelineMessage = isComplainant 
        ? 'Người khiếu nại đã bổ sung bằng chứng/phản hồi'
        : 'Người bị khiếu nại đã phản hồi';
      
      dispute.addTimelineEntry(
        isComplainant ? 'complainant_responded' : 'respondent_responded',
        timelineMessage,
        req.user._id
      );

      await dispute.save();
      await dispute.populate([
        { path: 'complainant', select: 'name email role avatar' },
        { path: 'respondent', select: 'name email role avatar' }
      ]);
    }

    res.json({
      success: true,
      message: 'Phản hồi/bổ sung bằng chứng đã được gửi',
      data: dispute || null
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

    // Check is complainant (authorization check - giữ lại)
    if (dispute && dispute.complainant && dispute.complainant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người khiếu nại mới có thể rút khiếu nại'
      });
    }

    if (dispute) {
      dispute.status = 'withdrawn';
      dispute.addTimelineEntry(
        'dispute_withdrawn',
        reason || 'Người khiếu nại đã rút khiếu nại',
        req.user._id
      );

      await dispute.save();
    }

    res.json({
      success: true,
      message: 'Khiếu nại đã được rút',
      data: dispute || null
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

    const dispute = await Dispute.findById(id);

    // Check is complainant or respondent (authorization check - giữ lại)
    const isComplainant = dispute && dispute.complainant && dispute.complainant.toString() === req.user._id.toString();
    const isRespondent = dispute && dispute.respondent && dispute.respondent.toString() === req.user._id.toString();

    if (dispute && !isComplainant && !isRespondent) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá khiếu nại này'
      });
    }

    if (dispute) {
      const satisfactionData = {
        rating: rating || 5, // Default 5 nếu không có
        feedback: feedback || '',
        ratedAt: new Date()
      };

      if (isComplainant) {
        dispute.complainantSatisfaction = satisfactionData;
      } else if (isRespondent) {
        dispute.respondentSatisfaction = satisfactionData;
      }

      await dispute.save();
    }

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

    if (dispute) {
      dispute.assignedTo = adminId || req.user._id;
      dispute.status = 'investigating';
      
      dispute.addTimelineEntry(
        'dispute_assigned',
        `Khiếu nại được giao cho admin`,
        req.user._id
      );

      await dispute.save();
    }

    res.json({
      success: true,
      message: 'Khiếu nại đã được giao',
      data: dispute || null
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

    const dispute = await Dispute.findById(id);

    if (dispute) {
      dispute.adminDecision = {
        decision: decision || 'no_fault',
        resolution: resolution || '',
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
        `Admin đã đưa ra quyết định: ${decision || 'no_fault'}`,
        req.user._id
      );

      await dispute.save();
    }
    await dispute.populate([
      { path: 'complainant', select: 'name email role' },
      { path: 'respondent', select: 'name email role' },
      { path: 'adminDecision.decidedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Quyết định đã được lưu',
      data: dispute || null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update dispute status (Admin only)
// @route   PUT /api/disputes/:id/status
// @access  Private (Admin only)
exports.updateDisputeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, allowComplainantResponse, allowRespondentResponse } = req.body;

    const dispute = await Dispute.findById(id);

    if (dispute) {
      // Cập nhật status nếu có
      if (status) {
      const oldStatus = dispute.status;
      dispute.status = status;
      
      dispute.addTimelineEntry(
        'status_updated',
        note || `Trạng thái chuyển từ ${oldStatus} sang ${status}`,
        req.user._id
      );
    }

    // Cập nhật allowComplainantResponse nếu có
    if (allowComplainantResponse !== undefined) {
      dispute.allowComplainantResponse = allowComplainantResponse;
      dispute.addTimelineEntry(
        'response_permission_updated',
        allowComplainantResponse 
          ? 'Admin đã cho phép người khiếu nại phản hồi/bổ sung bằng chứng' 
          : 'Admin đã tắt quyền phản hồi của người khiếu nại',
        req.user._id
      );
    }

      // Cập nhật allowRespondentResponse nếu có
      if (allowRespondentResponse !== undefined) {
        dispute.allowRespondentResponse = allowRespondentResponse;
        dispute.addTimelineEntry(
          'response_permission_updated',
          allowRespondentResponse 
            ? 'Admin đã cho phép người bị khiếu nại phản hồi' 
            : 'Admin đã tắt quyền phản hồi của người bị khiếu nại',
          req.user._id
        );
      }

      await dispute.save();
    }

    res.json({
      success: true,
      message: 'Cập nhật thành công',
      data: dispute || null
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

    const dispute = await Dispute.findById(id);

    if (dispute) {
      if (!dispute.internalNotes) {
        dispute.internalNotes = [];
      }
      dispute.internalNotes.push({
        note: note || '',
        addedBy: req.user._id,
        addedAt: new Date()
      });

      await dispute.save();
    }
    if (dispute) {
      await dispute.populate('internalNotes.addedBy', 'name email');
    }

    res.json({
      success: true,
      message: 'Thêm ghi chú thành công',
      data: dispute || null
    });
  } catch (error) {
    next(error);
  }
};
