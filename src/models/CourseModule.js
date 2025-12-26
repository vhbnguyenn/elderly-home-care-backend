const mongoose = require('mongoose');

const courseModuleSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },
  order: {
    type: Number,
    default: 1,
    description: 'Thứ tự hiển thị module'
  },
  totalLessons: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number,
    default: 0,
    description: 'Tổng thời lượng của module (phút)'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
courseModuleSchema.index({ course: 1, order: 1 });
courseModuleSchema.index({ course: 1, isActive: 1 });

// Virtual populate lessons
courseModuleSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'module',
  options: { sort: { order: 1 } }
});

// Update stats when lessons change
courseModuleSchema.methods.updateStats = async function() {
  const Lesson = mongoose.model('Lesson');
  const lessons = await Lesson.find({ module: this._id, isActive: true });
  
  this.totalLessons = lessons.length;
  this.totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);
  
  await this.save();
  
  // Update course stats
  const Course = mongoose.model('Course');
  const course = await Course.findById(this.course);
  if (course) {
    await course.updateStats();
  }
};

const CourseModule = mongoose.model('CourseModule', courseModuleSchema);

module.exports = CourseModule;
