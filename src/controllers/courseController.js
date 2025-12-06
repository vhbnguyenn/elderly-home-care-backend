const Course = require('../models/Course');
const CourseModule = require('../models/CourseModule');
const Lesson = require('../models/Lesson');
const { ROLES } = require('../constants/roles');

// Get all published courses (public)
exports.getAllCourses = async (req, res) => {
  try {
    const { level, category, search } = req.query;
    
    const filters = { isPublished: true, isActive: true };
    
    if (level) filters.level = level;
    if (category) filters.category = category;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const courses = await Course.find(filters)
      .sort({ createdAt: -1 })
      .select('-createdBy');
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get course detail with modules and lessons
exports.getCourseDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findOne({ 
      _id: id, 
      isPublished: true, 
      isActive: true 
    });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    
    // Get modules with lessons
    const modules = await CourseModule.find({ 
      course: id, 
      isActive: true 
    })
      .sort({ order: 1 })
      .lean();
    
    // Get lessons for each module
    for (let module of modules) {
      const lessons = await Lesson.find({ 
        module: module._id, 
        isActive: true 
      })
        .sort({ order: 1 })
        .select('title duration order')
        .lean();
      
      module.lessons = lessons;
    }
    
    res.status(200).json({
      success: true,
      data: {
        ...course.toObject(),
        modules
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get lesson detail
exports.getLessonDetail = async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    const lesson = await Lesson.findOne({ 
      _id: lessonId, 
      isActive: true 
    }).populate({
      path: 'module',
      select: 'title course order',
      populate: {
        path: 'course',
        select: 'title'
      }
    });
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học'
      });
    }
    
    // Get next lesson
    const nextLesson = await Lesson.findOne({
      module: lesson.module._id,
      order: { $gt: lesson.order },
      isActive: true
    })
      .sort({ order: 1 })
      .select('_id title');
    
    res.status(200).json({
      success: true,
      data: {
        lesson,
        nextLesson
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// ========== ADMIN ONLY ==========

// Create new course
exports.createCourse = async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      createdBy: req.user.userId
    };
    
    const course = await Course.create(courseData);
    
    res.status(201).json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: course
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật khóa học thành công',
      data: course
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete course (soft delete)
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Xóa khóa học thành công'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Publish/unpublish course
exports.togglePublish = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findById(id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    
    course.isPublished = !course.isPublished;
    await course.save();
    
    res.status(200).json({
      success: true,
      message: `${course.isPublished ? 'Xuất bản' : 'Gỡ xuất bản'} khóa học thành công`,
      data: course
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create module
exports.createModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }
    
    const module = await CourseModule.create({
      ...req.body,
      course: courseId
    });
    
    await course.updateStats();
    
    res.status(201).json({
      success: true,
      message: 'Tạo module thành công',
      data: module
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create lesson
exports.createLesson = async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    const module = await CourseModule.findById(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy module'
      });
    }
    
    const lesson = await Lesson.create({
      ...req.body,
      module: moduleId
    });
    
    res.status(201).json({
      success: true,
      message: 'Tạo bài học thành công',
      data: lesson
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update lesson
exports.updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    const lesson = await Lesson.findByIdAndUpdate(
      lessonId,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài học'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật bài học thành công',
      data: lesson
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
