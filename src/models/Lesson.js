const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseModule'
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },
  content: {
    type: String,
    description: 'Nội dung bài học (HTML hoặc Markdown)'
  },
  videoUrl: {
    type: String,
    description: 'URL video bài giảng'
  },
  videoProvider: {
    type: String,
    enum: ['youtube', 'vimeo', 'cloudinary', 'other'],
    description: 'Nền tảng video'
  },
  duration: {
    type: Number,
    description: 'Thời lượng bài học (phút)'
  },
  learningObjectives: [{
    type: String,
    description: 'Mục tiêu học tập'
  }],
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['pdf', 'doc', 'video', 'link', 'other']
    }
  }],
  order: {
    type: Number,
    default: 1,
    description: 'Thứ tự bài học trong module'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
lessonSchema.index({ module: 1, order: 1 });
lessonSchema.index({ module: 1, isActive: 1 });

// Update module stats after save
lessonSchema.post('save', async function() {
  const CourseModule = mongoose.model('CourseModule');
  const module = await CourseModule.findById(this.module);
  if (module) {
    await module.updateStats();
  }
});

// Update module stats after delete
lessonSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    const CourseModule = mongoose.model('CourseModule');
    const module = await CourseModule.findById(doc.module);
    if (module) {
      await module.updateStats();
    }
  }
});

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
