const Chat = require('../models/Chat');
const User = require('../models/User');

/**
 * @desc    Create or get conversation
 * @route   POST /api/chats
 * @access  Private
 */
const createOrGetChat = async (req, res, next) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu người tham gia'
      });
    }

    // Cannot chat with yourself
    if (participantId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo cuộc trò chuyện với chính bạn'
      });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người tham gia'
      });
    }

    // Find existing chat
    const userId = req.user._id.toString();
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, participantId] }
    }).populate('participants', 'name email role');

    // Create new chat if doesn't exist
    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, participantId],
        unreadCount: {
          [userId]: 0,
          [participantId]: 0
        }
      });
      
      chat = await Chat.findById(chat._id)
        .populate('participants', 'name email role');
    }

    res.status(200).json({
      success: true,
      data: chat
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my chats
 * @route   GET /api/chats
 * @access  Private
 */
const getMyChats = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'name email role')
      .populate('lastMessage.sender', 'name')
      .sort({ updatedAt: -1 });

    // Format response with unread count
    const formattedChats = chats.map(chat => ({
      _id: chat._id,
      participants: chat.participants,
      lastMessage: chat.lastMessage,
      unreadCount: chat.unreadCount.get(userId) || 0,
      updatedAt: chat.updatedAt
    }));

    res.status(200).json({
      success: true,
      count: formattedChats.length,
      data: formattedChats
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get chat detail
 * @route   GET /api/chats/:chatId
 * @access  Private
 */
const getChatDetail = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate('participants', 'name email role');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check if user is participant
    const userId = req.user._id.toString();
    const isParticipant = chat.participants.some(
      p => p._id.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem cuộc trò chuyện này'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: chat._id,
        participants: chat.participants,
        unreadCount: chat.unreadCount.get(userId) || 0,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get messages
 * @route   GET /api/chats/:chatId/messages
 * @access  Private
 */
const getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(req.params.chatId)
      .populate('messages.sender', 'name email role');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check if user is participant
    const userId = req.user._id.toString();
    const isParticipant = chat.participants.some(
      p => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem tin nhắn'
      });
    }

    // Filter non-deleted messages
    const messages = chat.messages.filter(msg => !msg.isDeleted);
    
    // Pagination (reverse order - newest first)
    const total = messages.length;
    const startIndex = total - (page * limit);
    const endIndex = total - ((page - 1) * limit);
    
    const paginatedMessages = messages
      .slice(Math.max(0, startIndex), endIndex)
      .reverse();

    res.status(200).json({
      success: true,
      count: paginatedMessages.length,
      data: paginatedMessages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send message
 * @route   POST /api/chats/:chatId/messages
 * @access  Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn là bắt buộc'
      });
    }

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check if user is participant
    const userId = req.user._id.toString();
    const isParticipant = chat.participants.some(
      p => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này'
      });
    }

    // Add message using model method
    await chat.addMessage(userId, content.trim());

    // Get the last added message
    const message = chat.messages[chat.messages.length - 1];

    // Populate sender info
    await chat.populate('messages.sender', 'name email role');

    // Emit socket event (will be handled in socket.js)
    if (req.io) {
      // Find other participant
      const otherParticipant = chat.participants.find(
        p => p.toString() !== userId
      );
      
      req.io.to(otherParticipant.toString()).emit('new_message', {
        chatId: chat._id,
        message: chat.messages[chat.messages.length - 1]
      });
    }

    res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công',
      data: message
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark chat as read
 * @route   PUT /api/chats/:chatId/read
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện'
      });
    }

    // Check if user is participant
    const userId = req.user._id.toString();
    const isParticipant = chat.participants.some(
      p => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    await chat.markAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu đã đọc'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread count
 * @route   GET /api/chats/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const chats = await Chat.find({
      participants: req.user._id
    });

    let totalUnread = 0;
    chats.forEach(chat => {
      totalUnread += chat.unreadCount.get(userId) || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount: totalUnread
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrGetChat,
  getMyChats,
  getChatDetail,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
};
