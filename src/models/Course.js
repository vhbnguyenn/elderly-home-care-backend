const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề khóa học là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Mô tả khóa học là bắt buộc']
  },
  thumbnail: {
    type: String,
    description: 'URL ảnh thumbnail khóa học'
  },
  instructor: {
    name: {
      type: String,
      required: true
    },
    title: {
      type: String,
      description: 'Chức danh giảng viên (VD: BS., ThS.)'
    },
    avatar: {
      type: String
    }
  },
  level: {
    type: String,
    enum: ['Cơ bản', 'Trung cấp', 'Nâng cao'],
    default: 'Cơ bản'
  },
  duration: {
    type: Number,
    description: 'Tổng thời lượng khóa học (phút)',
    default: 0
  },
  totalLessons: {
    type: Number,
    default: 0
  },
  totalModules: {
    type: Number,
    default: 0
  },
  enrollmentCount: {
    type: Number,
    default: 0,
    description: 'Số học viên đã đăng ký'
  },
  isPublished: {
    type: Boolean,
    default: false,
    description: 'Khóa học đã được xuất bản chưa'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    description: 'Danh mục khóa học'
  },
  tags: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Admin tạo khóa học'
  }
}, {
  timestamps: true
});

// Indexes
courseSchema.index({ isPublished: 1, isActive: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ level: 1 });

// Virtual populate modules
courseSchema.virtual('modules', {
  ref: 'CourseModule',
  localField: '_id',
  foreignField: 'course',
  options: { sort: { order: 1 } }
});

// Update total lessons and duration when modules change
courseSchema.methods.updateStats = async function() {
  const CourseModule = mongoose.model('CourseModule');
  const modules = await CourseModule.find({ course: this._id, isActive: true });
  
  this.totalModules = modules.length;
  this.totalLessons = modules.reduce((sum, module) => sum + module.totalLessons, 0);
  this.duration = modules.reduce((sum, module) => sum + module.totalDuration, 0);
  
  await this.save();
};

// Get published courses
courseSchema.statics.getPublishedCourses = async function(filters = {}) {
  return this.find({ 
    isPublished: true, 
    isActive: true,
    ...filters
  }).sort({ createdAt: -1 });
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
