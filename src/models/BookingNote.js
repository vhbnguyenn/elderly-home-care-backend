const mongoose = require('mongoose');

const bookingNoteSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
      index: true
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver is required']
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Index để query nhanh
bookingNoteSchema.index({ booking: 1, createdAt: -1 });

module.exports = mongoose.model('BookingNote', bookingNoteSchema);
