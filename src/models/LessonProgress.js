const mongoose = require('mongoose');

const lessonProgressSchema = new mongoose.Schema({
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseEnrollment',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  videoProgress: {
    currentTime: {
      type: Number,
      default: 0,
      description: 'Thời gian đã xem (giây)'
    },
    duration: {
      type: Number,
      description: 'Tổng thời lượng video (giây)'
    },
    watchPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
lessonProgressSchema.index({ enrollment: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, lesson: 1 });
lessonProgressSchema.index({ enrollment: 1, isCompleted: 1 });

// Mark lesson as completed
lessonProgressSchema.methods.markComplete = async function() {
  if (!this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
    this.videoProgress.watchPercentage = 100;
    await this.save();
    
    // Update enrollment progress
    const CourseEnrollment = mongoose.model('CourseEnrollment');
    const enrollment = await CourseEnrollment.findById(this.enrollment);
    if (enrollment) {
      await enrollment.updateProgress();
    }
  }
};

// Update video progress
lessonProgressSchema.methods.updateVideoProgress = async function(currentTime, duration) {
  this.videoProgress.currentTime = currentTime;
  this.videoProgress.duration = duration;
  
  if (duration > 0) {
    this.videoProgress.watchPercentage = Math.min(
      100,
      Math.round((currentTime / duration) * 100)
    );
    
    // Auto mark as complete if watched > 90%
    if (this.videoProgress.watchPercentage >= 90 && !this.isCompleted) {
      await this.markComplete();
      return;
    }
  }
  
  this.lastAccessedAt = new Date();
  await this.save();
};

const LessonProgress = mongoose.model('LessonProgress', lessonProgressSchema);

module.exports = LessonProgress;
