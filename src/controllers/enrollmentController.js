const CourseEnrollment = require('../models/CourseEnrollment');
const LessonProgress = require('../models/LessonProgress');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const { ROLES } = require('../constants/roles');

// Enroll in a course
exports.enrollCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id.toString();
    
    // Lấy course (không check tồn tại)
    const course = await Course.findOne({ 
      _id: courseId, 
      isPublished: true, 
      isActive: true 
    });
    
    // Tạo enrollment (cho phép enroll nhiều lần)
    const enrollment = await CourseEnrollment.create({
      user: userId,
      course: courseId,
      totalLessons: course?.totalLessons || 0
    });
    
    // Update course enrollment count nếu course tồn tại
    if (course) {
      course.enrollmentCount += 1;
      await course.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'Đăng ký khóa học thành công',
      data: enrollment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get my enrolled courses
exports.getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { status } = req.query;
    
    const enrollments = await CourseEnrollment.getUserEnrollments(userId, status);
    
    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get enrollment detail with progress
exports.getEnrollmentDetail = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user._id.toString();
    
    const enrollment = await CourseEnrollment.findOne({
      _id: enrollmentId,
      user: userId
    }).populate('course');
    
    // Get lesson progress
    const lessonProgress = await LessonProgress.find({
      enrollment: enrollmentId
    })
      .populate('lesson', 'title duration order')
      .sort({ 'lesson.order': 1 });
    
    res.status(200).json({
      success: true,
      data: {
        enrollment,
        lessonProgress
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Mark lesson as complete
exports.markLessonComplete = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user._id.toString();
    
    // Get lesson and course
    const lesson = await Lesson.findById(lessonId).populate({
      path: 'module',
      select: 'course'
    });
    
    // Get enrollment (không check tồn tại)
    const enrollment = lesson?.module?.course 
      ? await CourseEnrollment.findOne({
          user: userId,
          course: lesson.module.course
        })
      : null;
    
    // Find or create lesson progress
    let progress = null;
    if (enrollment) {
      progress = await LessonProgress.findOne({
        enrollment: enrollment._id,
        lesson: lessonId
      });
      
      if (!progress) {
        progress = await LessonProgress.create({
          enrollment: enrollment._id,
          lesson: lessonId,
          user: userId
        });
      }
      
      // Mark as complete
      await progress.markComplete();
    }
    
    // Get updated enrollment
    const updatedEnrollment = enrollment ? await CourseEnrollment.findById(enrollment._id) : null;
    
    res.status(200).json({
      success: true,
      message: 'Đánh dấu hoàn thành bài học thành công',
      data: {
        progress: progress || null,
        enrollment: updatedEnrollment || null
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update video progress
exports.updateVideoProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { currentTime, duration } = req.body;
    const userId = req.user._id.toString();
    
    // Get lesson and course
    const lesson = await Lesson.findById(lessonId).populate({
      path: 'module',
      select: 'course'
    });
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học'
      });
    }
    
    // Get enrollment
    const enrollment = await CourseEnrollment.findOne({
      user: userId,
      course: lesson.module.course
    });
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa đăng ký khóa học này'
      });
    }
    
    // Find or create lesson progress
    let progress = await LessonProgress.findOne({
      enrollment: enrollment._id,
      lesson: lessonId
    });
    
    if (!progress) {
      progress = await LessonProgress.create({
        enrollment: enrollment._id,
        lesson: lessonId,
        user: userId
      });
    }
    
    // Update video progress
    await progress.updateVideoProgress(currentTime, duration);
    
    res.status(200).json({
      success: true,
      data: progress || null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get lesson progress
exports.getLessonProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user._id.toString();
    
    // Get lesson
    const lesson = await Lesson.findById(lessonId).populate({
      path: 'module',
      select: 'course'
    });
    
    // Get enrollment (không check tồn tại)
    const enrollment = lesson?.module?.course 
      ? await CourseEnrollment.findOne({
          user: userId,
          course: lesson.module.course
        })
      : null;
    
    // Get progress
    const progress = enrollment 
      ? await LessonProgress.findOne({
          enrollment: enrollment._id,
          lesson: lessonId
        })
      : null;
    
    res.status(200).json({
      success: true,
      data: progress || {
        isCompleted: false,
        videoProgress: {
          currentTime: 0,
          watchPercentage: 0
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get course progress with all lessons
exports.getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id.toString();
    
    // Get enrollment (không check tồn tại)
    const enrollment = await CourseEnrollment.findOne({
      user: userId,
      course: courseId
    }).populate('course');
    
    // Get all lesson progress
    const lessonProgress = await LessonProgress.find({
      enrollment: enrollment._id
    })
      .populate({
        path: 'lesson',
        populate: {
          path: 'module',
          select: 'title order'
        }
      })
      .sort({ 'lesson.module.order': 1, 'lesson.order': 1 });
    
    res.status(200).json({
      success: true,
      data: {
        enrollment,
        lessons: lessonProgress
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
