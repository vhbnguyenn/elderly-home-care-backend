const SystemFeedback = require('../models/SystemFeedback');
const { ROLES } = require('../constants');

// @desc    Create system feedback
// @route   POST /api/system-feedback
// @access  Private (Caregiver & Careseeker)
exports.createFeedback = async (req, res, next) => {
  try {
    const {
      feedbackType,
      category,
      priority,
      title,
      description,
      attachments,
      deviceInfo,
      satisfactionRating,
      tags
    } = req.body;

    // Validate required fields
    if (!feedbackType || !category || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    // Create feedback
    const feedback = await SystemFeedback.create({
      user: req.user._id,
      feedbackType,
      category,
      priority: priority || 'medium',
      title,
      description,
      attachments: attachments || [],
      deviceInfo,
      satisfactionRating,
      tags: tags || []
    });

    await feedback.populate('user', 'name email role avatar');

    res.status(201).json({
      success: true,
      message: 'Gửi góp ý thành công. Chúng tôi sẽ xem xét và phản hồi sớm nhất!',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my feedbacks
// @route   GET /api/system-feedback/my-feedbacks
// @access  Private
exports.getMyFeedbacks = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = '-createdAt',
      status,
      feedbackType,
      category
    } = req.query;

    const filterQuery = { user: req.user._id };
    
    if (status) filterQuery.status = status;
    if (feedbackType) filterQuery.feedbackType = feedbackType;
    if (category) filterQuery.category = category;

    const feedbacks = await SystemFeedback.find(filterQuery)
      .select('-internalNotes') // Không hiển thị internal notes cho user
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await SystemFeedback.countDocuments(filterQuery);

    // Count by status
    const statusCount = await SystemFeedback.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        feedbacks,
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

// @desc    Get feedback detail
// @route   GET /api/system-feedback/:id
// @access  Private
exports.getFeedbackDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await SystemFeedback.findById(id)
      .populate('user', 'name email role avatar')
      .populate('adminResponse.respondedBy', 'name email');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check permission
    const isOwner = feedback.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem feedback này'
      });
    }

    // Remove internal notes if not admin
    if (!isAdmin) {
      feedback.internalNotes = undefined;
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback (user can update if still pending)
// @route   PUT /api/system-feedback/:id
// @access  Private
exports.updateFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      attachments,
      priority,
      satisfactionRating
    } = req.body;

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check ownership
    if (feedback.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật feedback này'
      });
    }

    // Chỉ cho phép update nếu status là pending hoặc reviewing
    if (!['pending', 'reviewing'].includes(feedback.status)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể cập nhật feedback đã được xử lý'
      });
    }

    // Update fields
    if (title) feedback.title = title;
    if (description) feedback.description = description;
    if (attachments) feedback.attachments = attachments;
    if (priority) feedback.priority = priority;
    if (satisfactionRating) feedback.satisfactionRating = satisfactionRating;

    feedback.followUpCount += 1;

    await feedback.save();
    await feedback.populate('user', 'name email role avatar');

    res.json({
      success: true,
      message: 'Cập nhật feedback thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete feedback (only if pending)
// @route   DELETE /api/system-feedback/:id
// @access  Private
exports.deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check ownership or admin
    const isOwner = feedback.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa feedback này'
      });
    }

    // User chỉ có thể xóa nếu status là pending
    if (isOwner && !isAdmin && feedback.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa feedback đã được xử lý'
      });
    }

    await feedback.deleteOne();

    res.json({
      success: true,
      message: 'Xóa feedback thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Rate resolution satisfaction
// @route   POST /api/system-feedback/:id/rate-resolution
// @access  Private
exports.rateResolution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { satisfaction } = req.body;

    if (!['satisfied', 'neutral', 'dissatisfied'].includes(satisfaction)) {
      return res.status(400).json({
        success: false,
        message: 'Giá trị satisfaction không hợp lệ'
      });
    }

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check ownership
    if (feedback.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá feedback này'
      });
    }

    // Chỉ cho phép rate nếu đã resolved hoặc closed
    if (!['resolved', 'closed'].includes(feedback.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá sau khi feedback được giải quyết'
      });
    }

    feedback.userSatisfactionWithResolution = satisfaction;
    await feedback.save();

    res.json({
      success: true,
      message: 'Cảm ơn bạn đã đánh giá!',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// ========== ADMIN ENDPOINTS ==========

// @desc    Get all feedbacks (Admin)
// @route   GET /api/system-feedback/admin/all
// @access  Private (Admin only)
exports.getAllFeedbacks = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      status,
      feedbackType,
      category,
      priority,
      search
    } = req.query;

    const filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (feedbackType) filterQuery.feedbackType = feedbackType;
    if (category) filterQuery.category = category;
    if (priority) filterQuery.priority = priority;
    
    if (search) {
      filterQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const feedbacks = await SystemFeedback.find(filterQuery)
      .populate('user', 'name email role avatar')
      .populate('adminResponse.respondedBy', 'name email')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await SystemFeedback.countDocuments(filterQuery);

    // Statistics
    const stats = await SystemFeedback.aggregate([
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          byStatus: {
            $push: '$status'
          },
          byType: {
            $push: '$feedbackType'
          },
          byPriority: {
            $push: '$priority'
          }
        }
      }
    ]);

    const statsData = stats[0] || {};
    const statusDistribution = {};
    const typeDistribution = {};
    const priorityDistribution = {};

    if (statsData.byStatus) {
      statsData.byStatus.forEach(s => {
        statusDistribution[s] = (statusDistribution[s] || 0) + 1;
      });
    }

    if (statsData.byType) {
      statsData.byType.forEach(t => {
        typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      });
    }

    if (statsData.byPriority) {
      statsData.byPriority.forEach(p => {
        priorityDistribution[p] = (priorityDistribution[p] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        feedbacks,
        statistics: {
          total: statsData.totalFeedbacks || 0,
          byStatus: statusDistribution,
          byType: typeDistribution,
          byPriority: priorityDistribution
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

// @desc    Respond to feedback (Admin)
// @route   POST /api/system-feedback/:id/respond
// @access  Private (Admin only)
exports.respondToFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung phản hồi'
      });
    }

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    feedback.adminResponse = {
      respondedBy: req.user._id,
      message,
      respondedAt: new Date()
    };

    if (status) {
      feedback.status = status;
    }

    await feedback.save();
    await feedback.populate([
      { path: 'user', select: 'name email role avatar' },
      { path: 'adminResponse.respondedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Phản hồi thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback status (Admin)
// @route   PUT /api/system-feedback/:id/status
// @access  Private (Admin only)
exports.updateFeedbackStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn trạng thái'
      });
    }

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    feedback.status = status;
    await feedback.save();

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add internal note (Admin)
// @route   POST /api/system-feedback/:id/internal-note
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

    const feedback = await SystemFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    feedback.internalNotes.push({
      note,
      addedBy: req.user._id,
      addedAt: new Date()
    });

    await feedback.save();
    await feedback.populate('internalNotes.addedBy', 'name email');

    res.json({
      success: true,
      message: 'Thêm ghi chú thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};
