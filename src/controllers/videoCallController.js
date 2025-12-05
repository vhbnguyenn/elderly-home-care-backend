const VideoCall = require('../models/VideoCall');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { ROLES } = require('../constants');

// @desc    Initiate video call
// @route   POST /api/video-calls/initiate
// @access  Private
exports.initiateCall = async (req, res, next) => {
  try {
    const {
      receiverId,
      bookingId,
      callType = 'video',
      deviceInfo
    } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn người nhận cuộc gọi'
      });
    }

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người nhận'
      });
    }

    // Cannot call yourself
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể gọi cho chính mình'
      });
    }

    // Validate booking if provided
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy booking'
        });
      }

      // Check user có liên quan đến booking không
      const isInvolved = 
        booking.caregiver.toString() === req.user._id.toString() ||
        booking.careseeker.toString() === req.user._id.toString();

      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền gọi trong booking này'
        });
      }
    }

    // Check if receiver is online (via socket - will handle in socket.js)
    // For now, just create the call

    // Create video call
    const videoCall = await VideoCall.create({
      caller: req.user._id,
      receiver: receiverId,
      booking: bookingId || undefined,
      callType,
      status: 'ringing',
      deviceInfo: {
        caller: deviceInfo || {}
      }
    });

    await videoCall.populate([
      { path: 'caller', select: 'name avatar role' },
      { path: 'receiver', select: 'name avatar role' },
      { path: 'booking', select: 'bookingDate' }
    ]);

    // Emit socket event for real-time notification
    if (global.io) {
      global.io.to(receiverId).emit('incoming-call', {
        callId: videoCall._id,
        caller: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar,
          role: req.user.role
        },
        callType,
        bookingId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Cuộc gọi đã được khởi tạo',
      data: videoCall
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept video call
// @route   POST /api/video-calls/:id/accept
// @access  Private
exports.acceptCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deviceInfo } = req.body;

    const videoCall = await VideoCall.findById(id);

    if (!videoCall) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc gọi'
      });
    }

    // Check is receiver
    if (videoCall.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người nhận mới có thể chấp nhận cuộc gọi'
      });
    }

    // Check status
    if (videoCall.status !== 'ringing') {
      return res.status(400).json({
        success: false,
        message: `Không thể chấp nhận cuộc gọi ở trạng thái ${videoCall.status}`
      });
    }

    videoCall.status = 'ongoing';
    videoCall.startTime = new Date();
    if (deviceInfo) {
      videoCall.deviceInfo.receiver = deviceInfo;
    }

    await videoCall.save();
    await videoCall.populate([
      { path: 'caller', select: 'name avatar role' },
      { path: 'receiver', select: 'name avatar role' }
    ]);

    // Emit socket event to caller
    if (global.io) {
      global.io.to(videoCall.caller.toString()).emit('call-accepted', {
        callId: videoCall._id,
        receiver: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar
        }
      });
    }

    res.json({
      success: true,
      message: 'Đã chấp nhận cuộc gọi',
      data: videoCall
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject video call
// @route   POST /api/video-calls/:id/reject
// @access  Private
exports.rejectCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const videoCall = await VideoCall.findById(id);

    if (!videoCall) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc gọi'
      });
    }

    // Check is receiver
    if (videoCall.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người nhận mới có thể từ chối cuộc gọi'
      });
    }

    // Check status
    if (videoCall.status !== 'ringing') {
      return res.status(400).json({
        success: false,
        message: `Không thể từ chối cuộc gọi ở trạng thái ${videoCall.status}`
      });
    }

    videoCall.status = 'rejected';
    videoCall.endTime = new Date();
    videoCall.rejectionReason = reason || 'User rejected';

    await videoCall.save();

    // Emit socket event to caller
    if (global.io) {
      global.io.to(videoCall.caller.toString()).emit('call-rejected', {
        callId: videoCall._id,
        reason: videoCall.rejectionReason
      });
    }

    res.json({
      success: true,
      message: 'Đã từ chối cuộc gọi',
      data: videoCall
    });
  } catch (error) {
    next(error);
  }
};

// @desc    End video call
// @route   POST /api/video-calls/:id/end
// @access  Private
exports.endCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qualityMetrics } = req.body;

    const videoCall = await VideoCall.findById(id);

    if (!videoCall) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc gọi'
      });
    }

    // Check is caller or receiver
    const isCaller = videoCall.caller.toString() === req.user._id.toString();
    const isReceiver = videoCall.receiver.toString() === req.user._id.toString();

    if (!isCaller && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền kết thúc cuộc gọi này'
      });
    }

    videoCall.status = 'ended';
    videoCall.endTime = new Date();
    videoCall.endedBy = req.user._id;

    // Calculate duration
    if (videoCall.startTime) {
      videoCall.duration = Math.floor((videoCall.endTime - videoCall.startTime) / 1000);
    }

    // Save quality metrics if provided
    if (qualityMetrics) {
      videoCall.qualityMetrics = {
        ...videoCall.qualityMetrics,
        ...qualityMetrics
      };
    }

    await videoCall.save();

    // Emit socket event to other party
    const otherUserId = isCaller ? videoCall.receiver.toString() : videoCall.caller.toString();
    if (global.io) {
      global.io.to(otherUserId).emit('call-ended', {
        callId: videoCall._id,
        endedBy: req.user._id,
        duration: videoCall.duration
      });
    }

    res.json({
      success: true,
      message: 'Cuộc gọi đã kết thúc',
      data: {
        callId: videoCall._id,
        duration: videoCall.duration,
        endedBy: req.user._id
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call history
// @route   GET /api/video-calls/history
// @access  Private
exports.getCallHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, callType, status } = req.query;

    const calls = await VideoCall.getHistory(req.user._id, {
      page,
      limit,
      callType,
      status
    });

    const totalQuery = {
      $or: [
        { caller: req.user._id },
        { receiver: req.user._id }
      ]
    };
    if (callType) totalQuery.callType = callType;
    if (status) totalQuery.status = status;

    const total = await VideoCall.countDocuments(totalQuery);

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call detail
// @route   GET /api/video-calls/:id
// @access  Private
exports.getCallDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const videoCall = await VideoCall.findById(id)
      .populate('caller', 'name avatar role email')
      .populate('receiver', 'name avatar role email')
      .populate('booking', 'bookingDate bookingTime duration')
      .populate('endedBy', 'name');

    if (!videoCall) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc gọi'
      });
    }

    // Check permission
    const isCaller = videoCall.caller._id.toString() === req.user._id.toString();
    const isReceiver = videoCall.receiver._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isCaller && !isReceiver && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem cuộc gọi này'
      });
    }

    res.json({
      success: true,
      data: videoCall
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call statistics
// @route   GET /api/video-calls/statistics/me
// @access  Private
exports.getMyStatistics = async (req, res, next) => {
  try {
    const stats = await VideoCall.getStatistics(req.user._id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save WebRTC signaling data
// @route   POST /api/video-calls/:id/signaling
// @access  Private
exports.saveSignalingData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, data } = req.body; // type: 'offer', 'answer', 'ice-candidate'

    const videoCall = await VideoCall.findById(id);

    if (!videoCall) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc gọi'
      });
    }

    // Check permission
    const isCaller = videoCall.caller.toString() === req.user._id.toString();
    const isReceiver = videoCall.receiver.toString() === req.user._id.toString();

    if (!isCaller && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật signaling data'
      });
    }

    if (type === 'offer') {
      videoCall.signalingData.offer = data;
    } else if (type === 'answer') {
      videoCall.signalingData.answer = data;
    } else if (type === 'ice-candidate') {
      videoCall.signalingData.iceCandidates.push({
        candidate: data,
        from: isCaller ? 'caller' : 'receiver'
      });
    }

    await videoCall.save();

    // Relay to other party via socket
    const otherUserId = isCaller ? videoCall.receiver.toString() : videoCall.caller.toString();
    if (global.io) {
      global.io.to(otherUserId).emit(`webrtc-${type}`, {
        callId: videoCall._id,
        data
      });
    }

    res.json({
      success: true,
      message: 'Signaling data saved'
    });
  } catch (error) {
    next(error);
  }
};

// ========== ADMIN ENDPOINTS ==========

// @desc    Get all video calls (Admin)
// @route   GET /api/video-calls/admin/all
// @access  Private (Admin only)
exports.getAllCalls = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      status,
      callType,
      search
    } = req.query;

    const filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (callType) filterQuery.callType = callType;
    
    if (search) {
      // Search by caller or receiver name (requires population)
      const users = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      filterQuery.$or = [
        { caller: { $in: userIds } },
        { receiver: { $in: userIds } }
      ];
    }

    const calls = await VideoCall.find(filterQuery)
      .populate('caller', 'name email role avatar')
      .populate('receiver', 'name email role avatar')
      .populate('booking', 'bookingDate')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await VideoCall.countDocuments(filterQuery);

    // Statistics
    const stats = await VideoCall.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          avgDuration: { $avg: '$duration' },
          byStatus: { $push: '$status' },
          byType: { $push: '$callType' }
        }
      }
    ]);

    const statsData = stats[0] || {};
    const statusDist = {};
    const typeDist = {};

    if (statsData.byStatus) statsData.byStatus.forEach(s => statusDist[s] = (statusDist[s] || 0) + 1);
    if (statsData.byType) statsData.byType.forEach(t => typeDist[t] = (typeDist[t] || 0) + 1);

    res.json({
      success: true,
      data: {
        calls,
        statistics: {
          total: statsData.total || 0,
          totalDuration: statsData.totalDuration || 0,
          avgDuration: Math.round(statsData.avgDuration || 0),
          byStatus: statusDist,
          byType: typeDist
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
