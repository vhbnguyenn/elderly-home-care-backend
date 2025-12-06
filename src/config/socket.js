const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Store online users: { userId: socketId }
const onlineUsers = new Map();

const initializeSocket = (io) => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Invalid token'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId); // Join room with userId

    // Broadcast online status
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // Send online users list to the connected user
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    // Handle typing indicator
    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(chatId).emit('user_typing', {
        userId: socket.userId,
        chatId,
        isTyping
      });
    });

    // Handle join chat room
    socket.on('join_chat', ({ chatId }) => {
      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat ${chatId}`);
    });

    // Handle leave chat room
    socket.on('leave_chat', ({ chatId }) => {
      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat ${chatId}`);
    });

    // Handle message read
    socket.on('message_read', ({ chatId, messageId }) => {
      socket.to(chatId).emit('message_read_by_other', {
        chatId,
        messageId,
        readBy: socket.userId
      });
    });

    // ========== VIDEO CALL EVENTS ==========

    // Handle WebRTC offer
    socket.on('webrtc-offer', ({ callId, receiverId, offer }) => {
      io.to(receiverId).emit('webrtc-offer', {
        callId,
        callerId: socket.userId,
        offer
      });
    });

    // Handle WebRTC answer
    socket.on('webrtc-answer', ({ callId, callerId, answer }) => {
      io.to(callerId).emit('webrtc-answer', {
        callId,
        receiverId: socket.userId,
        answer
      });
    });

    // Handle ICE candidate
    socket.on('ice-candidate', ({ callId, targetUserId, candidate }) => {
      io.to(targetUserId).emit('ice-candidate', {
        callId,
        fromUserId: socket.userId,
        candidate
      });
    });

    // Handle call busy (receiver is in another call)
    socket.on('call-busy', ({ callId, callerId }) => {
      io.to(callerId).emit('call-busy', {
        callId,
        receiverId: socket.userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
      
      // Broadcast offline status
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });

  return io;
};

// Helper function to check if user is online
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Helper function to get socket ID by user ID
const getSocketId = (userId) => {
  return onlineUsers.get(userId);
};

module.exports = {
  initializeSocket,
  isUserOnline,
  getSocketId,
  onlineUsers
};
