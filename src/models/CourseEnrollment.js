const mongoose = require('mongoose');

const courseEnrollmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'dropped'],
    default: 'active'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: 'Phần trăm hoàn thành khóa học'
  },
  completedLessons: {
    type: Number,
    default: 0
  },
  totalLessons: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    description: 'Ngày hoàn thành khóa học'
  },
  certificate: {
    issued: {
      type: Boolean,
      default: false
    },
    issuedAt: {
      type: Date
    },
    certificateUrl: {
      type: String
    }
  }
}, {
  timestamps: true
});

// Indexes
courseEnrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
courseEnrollmentSchema.index({ user: 1, status: 1 });
courseEnrollmentSchema.index({ course: 1 });

// Calculate and update progress
courseEnrollmentSchema.methods.updateProgress = async function() {
  const LessonProgress = mongoose.model('LessonProgress');
  const Course = mongoose.model('Course');
  
  const course = await Course.findById(this.course);
  if (!course) return;
  
  this.totalLessons = course.totalLessons;
  
  const completedCount = await LessonProgress.countDocuments({
    enrollment: this._id,
    isCompleted: true
  });
  
  this.completedLessons = completedCount;
  this.progress = this.totalLessons > 0 
    ? Math.round((completedCount / this.totalLessons) * 100) 
    : 0;
  
  // Mark as completed if 100%
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  this.lastAccessedAt = new Date();
  await this.save();
};

// Get user's enrollments
courseEnrollmentSchema.statics.getUserEnrollments = async function(userId, status = null) {
  const query = { user: userId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('course')
    .sort({ lastAccessedAt: -1 });
};

const CourseEnrollment = mongoose.model('CourseEnrollment', courseEnrollmentSchema);

module.exports = CourseEnrollment;
