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

// @desc    Get all feedbacks (Admin)
// @route   GET /api/video-feedback/admin/all
// @access  Private (Admin only)
exports.getAllFeedbacks = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      status,
      overallExperience,
      search
    } = req.query;

    const filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (overallExperience) filterQuery.overallExperience = overallExperience;
    
    if (search) {
      // Tìm kiếm theo tên reviewer hoặc receiver
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      
      // Nếu không tìm thấy user nào, trả về kết quả rỗng
      if (userIds.length === 0) {
        filterQuery._id = { $in: [] }; // Không có feedback nào
      } else {
        filterQuery.$or = [
          { reviewer: { $in: userIds } },
          { receiver: { $in: userIds } }
        ];
      }
    }

    const feedbacks = await VideoCallFeedback.find(filterQuery)
      .populate('reviewer', 'name email avatar role')
      .populate('receiver', 'name email avatar role')
      .populate('booking', 'bookingDate bookingTime duration workLocation')
      .populate('chatSession')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await VideoCallFeedback.countDocuments(filterQuery);

    // Statistics
    const stats = await VideoCallFeedback.aggregate([
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          byStatus: { $push: '$status' },
          byExperience: { $push: '$overallExperience' },
          avgVideoQuality: { $avg: '$videoQuality' },
          avgAudioQuality: { $avg: '$audioQuality' },
          avgConnectionStability: { $avg: '$connectionStability' }
        }
      }
    ]);

    const statsData = stats[0] || {};
    const statusDistribution = {};
    const experienceDistribution = {};

    if (statsData.byStatus) {
      statsData.byStatus.forEach(s => {
        statusDistribution[s] = (statusDistribution[s] || 0) + 1;
      });
    }

    if (statsData.byExperience) {
      statsData.byExperience.forEach(e => {
        experienceDistribution[e] = (experienceDistribution[e] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        },
        statistics: {
          totalFeedbacks: statsData.totalFeedbacks || 0,
          statusDistribution,
          experienceDistribution,
          avgVideoQuality: statsData.avgVideoQuality ? statsData.avgVideoQuality.toFixed(2) : 0,
          avgAudioQuality: statsData.avgAudioQuality ? statsData.avgAudioQuality.toFixed(2) : 0,
          avgConnectionStability: statsData.avgConnectionStability ? statsData.avgConnectionStability.toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get feedback detail (Admin only)
// @route   GET /api/video-feedback/:id
// @access  Private (Admin only)
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

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

