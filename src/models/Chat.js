const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: Date
    },
    messages: [messageSchema],
    // Tracking unread count for each participant
    unreadCount: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
chatSchema.index({ participants: 1 });
chatSchema.index({ 'participants': 1, updatedAt: -1 });

// Method to add message
chatSchema.methods.addMessage = function(senderId, content) {
  this.messages.push({
    sender: senderId,
    content
  });
  
  this.lastMessage = {
    content,
    sender: senderId,
    timestamp: new Date()
  };
  
  // Increment unread count for other participant
  this.participants.forEach(participantId => {
    const id = participantId.toString();
    if (id !== senderId.toString()) {
      const currentCount = this.unreadCount.get(id) || 0;
      this.unreadCount.set(id, currentCount + 1);
    }
  });
  
  return this.save();
};

// Method to mark messages as read
chatSchema.methods.markAsRead = function(userId) {
  const now = new Date();
  this.messages.forEach(message => {
    if (message.sender.toString() !== userId.toString() && !message.isRead) {
      message.isRead = true;
      message.readAt = now;
    }
  });
  
  // Reset unread count for this user
  this.unreadCount.set(userId.toString(), 0);
  
  return this.save();
};

module.exports = mongoose.model('Chat', chatSchema);
