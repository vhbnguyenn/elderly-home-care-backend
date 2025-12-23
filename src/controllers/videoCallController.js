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

    // Lấy booking nếu có (không check tồn tại)
    const booking = bookingId ? await Booking.findById(bookingId) : null;
    
    // Check user có liên quan đến booking không (authorization check - giữ lại nếu booking tồn tại)
    if (booking) {
      const isInvolved = 
        booking.caregiver && booking.caregiver.toString() === req.user._id.toString() ||
        booking.careseeker && booking.careseeker.toString() === req.user._id.toString();

      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền gọi trong booking này'
        });
      }
    }

    // Check if receiver is online (via socket - will handle in socket.js)
    // For now, just create the call

    // Create video call (không validate)
    const videoCall = await VideoCall.create({
      caller: req.user._id,
      receiver: receiverId || req.user._id, // Fallback nếu không có
      booking: bookingId || undefined,
      callType: callType || 'video',
      status: 'ringing',
      deviceInfo: {
        caller: deviceInfo || {}
      }
    }, { runValidators: false, strict: false });

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

    // Check is receiver (authorization check - giữ lại)
    if (videoCall && videoCall.receiver && videoCall.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người nhận mới có thể chấp nhận cuộc gọi'
      });
    }

    if (videoCall) {
      videoCall.status = 'ongoing';
      videoCall.startTime = new Date();
      if (deviceInfo) {
        if (!videoCall.deviceInfo) {
          videoCall.deviceInfo = {};
        }
        videoCall.deviceInfo.receiver = deviceInfo;
      }

      await videoCall.save();
    }
    if (videoCall) {
      await videoCall.populate([
        { path: 'caller', select: 'name avatar role' },
        { path: 'receiver', select: 'name avatar role' }
      ]);

      // Emit socket event to caller
      if (global.io && videoCall.caller) {
        global.io.to(videoCall.caller.toString()).emit('call-accepted', {
          callId: videoCall._id,
          receiver: {
            _id: req.user._id,
            name: req.user.name,
            avatar: req.user.avatar
          }
        });
      }
    }

    res.json({
      success: true,
      message: 'Đã chấp nhận cuộc gọi',
      data: videoCall || null
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

    // Check is receiver (authorization check - giữ lại)
    if (videoCall && videoCall.receiver && videoCall.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người nhận mới có thể từ chối cuộc gọi'
      });
    }

    if (videoCall) {
      videoCall.status = 'rejected';
      videoCall.endTime = new Date();
      videoCall.rejectionReason = reason || 'User rejected';

      await videoCall.save();
    }

    // Emit socket event to caller
    if (videoCall && global.io && videoCall.caller) {
      global.io.to(videoCall.caller.toString()).emit('call-rejected', {
        callId: videoCall._id,
        reason: videoCall.rejectionReason || 'User rejected'
      });
    }

    res.json({
      success: true,
      message: 'Đã từ chối cuộc gọi',
      data: videoCall || null
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

    // Check is caller or receiver (authorization check - giữ lại)
    const isCaller = videoCall && videoCall.caller && videoCall.caller.toString() === req.user._id.toString();
    const isReceiver = videoCall && videoCall.receiver && videoCall.receiver.toString() === req.user._id.toString();

    if (videoCall && !isCaller && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền kết thúc cuộc gọi này'
      });
    }

    if (videoCall) {
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
    }

    // Emit socket event to other party
    if (videoCall && global.io) {
      const otherUserId = isCaller && videoCall.receiver ? videoCall.receiver.toString() : 
                         isReceiver && videoCall.caller ? videoCall.caller.toString() : null;
      if (otherUserId) {
        global.io.to(otherUserId).emit('call-ended', {
          callId: videoCall._id,
          endedBy: req.user._id,
          duration: videoCall.duration || 0
        });
      }
    }

    res.json({
      success: true,
      message: 'Cuộc gọi đã kết thúc',
      data: {
        callId: videoCall ? videoCall._id : null,
        duration: videoCall ? videoCall.duration : 0,
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

    // Check permission (authorization check - giữ lại)
    const isAdmin = req.user.role === ROLES.ADMIN;
    if (videoCall) {
      const isCaller = videoCall.caller && videoCall.caller._id && videoCall.caller._id.toString() === req.user._id.toString();
      const isReceiver = videoCall.receiver && videoCall.receiver._id && videoCall.receiver._id.toString() === req.user._id.toString();

      if (!isCaller && !isReceiver && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem cuộc gọi này'
        });
      }
    }

    res.json({
      success: true,
      data: videoCall
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

    // Check permission (authorization check - giữ lại)
    const isCaller = videoCall && videoCall.caller && videoCall.caller.toString() === req.user._id.toString();
    const isReceiver = videoCall && videoCall.receiver && videoCall.receiver.toString() === req.user._id.toString();

    if (videoCall && !isCaller && !isReceiver) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật signaling data'
      });
    }

    if (videoCall) {
      if (!videoCall.signalingData) {
        videoCall.signalingData = {
          offer: null,
          answer: null,
          iceCandidates: []
        };
      }

      if (type === 'offer') {
        videoCall.signalingData.offer = data;
      } else if (type === 'answer') {
        videoCall.signalingData.answer = data;
      } else if (type === 'ice-candidate') {
        if (!videoCall.signalingData.iceCandidates) {
          videoCall.signalingData.iceCandidates = [];
        }
        videoCall.signalingData.iceCandidates.push({
          candidate: data,
          from: isCaller ? 'caller' : 'receiver'
        });
      }

      await videoCall.save();
    }

    // Relay to other party via socket
    if (videoCall && global.io) {
      const otherUserId = isCaller && videoCall.receiver ? videoCall.receiver.toString() : 
                         isReceiver && videoCall.caller ? videoCall.caller.toString() : null;
      if (otherUserId) {
        global.io.to(otherUserId).emit(`webrtc-${type}`, {
          callId: videoCall._id,
          data
        });
      }
    }

    res.json({
      success: true,
      message: 'Signaling data saved'
    });
  } catch (error) {
    next(error);
  }
};

