const VideoCallFeedback = require('../models/VideoCallFeedback');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Chat = require('../models/Chat');

// @desc    Create video call feedback
// @route   POST /api/video-feedback
// @access  Private
exports.createFeedback = async (req, res, next) => {
  try {
    const {
      receiverId,
      bookingId,
      chatSessionId,
      callInfo,
      videoQuality,
      audioQuality,
      connectionStability,
      issues,
      overallExperience,
      additionalNotes,
      wouldUseAgain
    } = req.body;

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người nhận'
      });
    }

    // Validate không thể tự feedback cho chính mình
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể gửi feedback cho chính mình'
      });
    }

    // Validate booking nếu có
    if (bookingId) {
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
          message: 'Bạn không có quyền feedback cho booking này'
        });
      }
    }

    // Validate chat session nếu có
    if (chatSessionId) {
      const chat = await Chat.findById(chatSessionId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy chat session'
        });
      }

      // Check user có phải participant không
      const isParticipant = chat.participants.some(
        p => p.toString() === req.user._id.toString()
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền feedback cho chat session này'
        });
      }
    }

    // Validate ratings
    if (!videoQuality || !audioQuality || !connectionStability || !overallExperience) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ tất cả các đánh giá'
      });
    }

    // Create feedback
    const feedback = await VideoCallFeedback.create({
      reviewer: req.user._id,
      receiver: receiverId,
      booking: bookingId || null,
      chatSession: chatSessionId || null,
      callInfo,
      videoQuality,
      audioQuality,
      connectionStability,
      issues: issues || [],
      overallExperience,
      additionalNotes,
      wouldUseAgain: wouldUseAgain !== undefined ? wouldUseAgain : true
    });

    await feedback.populate([
      { path: 'reviewer', select: 'name email avatar role' },
      { path: 'receiver', select: 'name email avatar role' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Gửi feedback thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my feedbacks (feedbacks I created)
// @route   GET /api/video-feedback/my-feedbacks
// @access  Private
exports.getMyFeedbacks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    const feedbacks = await VideoCallFeedback.find({ reviewer: req.user._id })
      .populate('receiver', 'name email avatar role')
      .populate('booking', 'bookingDate bookingTime')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await VideoCallFeedback.countDocuments({ reviewer: req.user._id });

    res.json({
      success: true,
      data: {
        feedbacks,
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

// @desc    Get feedbacks received (feedbacks about me)
// @route   GET /api/video-feedback/received
// @access  Private
exports.getReceivedFeedbacks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sortBy = '-createdAt' } = req.query;

    const feedbacks = await VideoCallFeedback.find({ receiver: req.user._id })
      .populate('reviewer', 'name email avatar role')
      .populate('booking', 'bookingDate bookingTime')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await VideoCallFeedback.countDocuments({ receiver: req.user._id });

    res.json({
      success: true,
      data: {
        feedbacks,
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

// @desc    Get feedback statistics
// @route   GET /api/video-feedback/stats
// @access  Private
exports.getFeedbackStats = async (req, res, next) => {
  try {
    // Stats cho feedbacks nhận được
    const stats = await VideoCallFeedback.aggregate([
      { $match: { receiver: req.user._id, status: 'active' } },
      {
        $group: {
          _id: null,
          avgVideoQuality: { $avg: '$videoQuality' },
          avgAudioQuality: { $avg: '$audioQuality' },
          avgConnectionStability: { $avg: '$connectionStability' },
          totalFeedbacks: { $sum: 1 },
          wouldUseAgainCount: {
            $sum: { $cond: ['$wouldUseAgain', 1, 0] }
          }
        }
      }
    ]);

    // Count by overall experience
    const experienceDistribution = await VideoCallFeedback.aggregate([
      { $match: { receiver: req.user._id, status: 'active' } },
      {
        $group: {
          _id: '$overallExperience',
          count: { $sum: 1 }
        }
      }
    ]);

    // Count by issues
    const issuesDistribution = await VideoCallFeedback.aggregate([
      { $match: { receiver: req.user._id, status: 'active' } },
      { $unwind: '$issues' },
      {
        $group: {
          _id: '$issues',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const feedbackStats = stats[0] || {
      avgVideoQuality: 0,
      avgAudioQuality: 0,
      avgConnectionStability: 0,
      totalFeedbacks: 0,
      wouldUseAgainCount: 0
    };

    const overallAverage = stats[0] ? 
      ((feedbackStats.avgVideoQuality + feedbackStats.avgAudioQuality + 
        feedbackStats.avgConnectionStability) / 3).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          ...feedbackStats,
          overallAverage,
          wouldUseAgainRate: feedbackStats.totalFeedbacks > 0 ? 
            ((feedbackStats.wouldUseAgainCount / feedbackStats.totalFeedbacks) * 100).toFixed(1) : 0
        },
        experienceDistribution: experienceDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topIssues: issuesDistribution
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get feedback detail
// @route   GET /api/video-feedback/:id
// @access  Private
exports.getFeedbackDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await VideoCallFeedback.findById(id)
      .populate('reviewer', 'name email avatar role')
      .populate('receiver', 'name email avatar role')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .populate('chatSession');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Chỉ reviewer, receiver hoặc admin mới xem được
    const isReviewer = feedback.reviewer._id.toString() === req.user._id.toString();
    const isReceiver = feedback.receiver._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isReviewer && !isReceiver && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem feedback này'
      });
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update feedback
// @route   PUT /api/video-feedback/:id
// @access  Private (Own feedback only)
exports.updateFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      videoQuality,
      audioQuality,
      connectionStability,
      issues,
      overallExperience,
      additionalNotes,
      wouldUseAgain
    } = req.body;

    const feedback = await VideoCallFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check ownership
    if (feedback.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật feedback này'
      });
    }

    // Update fields
    if (videoQuality) feedback.videoQuality = videoQuality;
    if (audioQuality) feedback.audioQuality = audioQuality;
    if (connectionStability) feedback.connectionStability = connectionStability;
    if (issues !== undefined) feedback.issues = issues;
    if (overallExperience) feedback.overallExperience = overallExperience;
    if (additionalNotes !== undefined) feedback.additionalNotes = additionalNotes;
    if (wouldUseAgain !== undefined) feedback.wouldUseAgain = wouldUseAgain;

    await feedback.save();
    await feedback.populate([
      { path: 'reviewer', select: 'name email avatar role' },
      { path: 'receiver', select: 'name email avatar role' }
    ]);

    res.json({
      success: true,
      message: 'Cập nhật feedback thành công',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete feedback
// @route   DELETE /api/video-feedback/:id
// @access  Private (Own feedback or Admin)
exports.deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await VideoCallFeedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Check permission
    const isOwner = feedback.reviewer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa feedback này'
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

// @desc    Get system-wide video quality stats (Admin only)
// @route   GET /api/video-feedback/admin/system-stats
// @access  Private (Admin)
exports.getSystemStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = { status: 'active' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Overall stats
    const overallStats = await VideoCallFeedback.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          avgVideoQuality: { $avg: '$videoQuality' },
          avgAudioQuality: { $avg: '$audioQuality' },
          avgConnectionStability: { $avg: '$connectionStability' },
          totalFeedbacks: { $sum: 1 },
          totalCallDuration: { $sum: '$callInfo.duration' }
        }
      }
    ]);

    // Most common issues
    const commonIssues = await VideoCallFeedback.aggregate([
      { $match: matchQuery },
      { $unwind: '$issues' },
      {
        $group: {
          _id: '$issues',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Experience distribution
    const experienceDistribution = await VideoCallFeedback.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$overallExperience',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: overallStats[0] || {},
        commonIssues,
        experienceDistribution: experienceDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
};
