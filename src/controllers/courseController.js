const Course = require('../models/Course');
const CourseModule = require('../models/CourseModule');
const Lesson = require('../models/Lesson');
const CourseEnrollment = require('../models/CourseEnrollment');
const { ROLES } = require('../constants/roles');

// Get all courses (chỉ cho user đã đăng nhập)
// - Admin: xem tất cả courses (kể cả chưa publish)
// - User khác: chỉ xem published courses
// - Mỗi course sẽ có thông tin enrollment nếu user đã enroll
exports.getAllCourses = async (req, res) => {
  try {
    const { level, category, search } = req.query;
    const userId = req.user._id.toString();
    
    // Nếu là admin: xem tất cả (kể cả chưa publish)
    // Nếu không phải admin: chỉ xem published
    const filters = { isActive: true };
    if (req.user.role !== ROLES.ADMIN) {
      filters.isPublished = true;
    }
    
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
      .select('-createdBy')
      .lean();
    
    // Lấy tất cả enrollments của user
    const enrollments = await CourseEnrollment.find({ user: userId })
      .lean();
    
    // Tạo map enrollment theo courseId để lookup nhanh
    const enrollmentMap = {};
    enrollments.forEach(enrollment => {
      enrollmentMap[enrollment.course.toString()] = enrollment;
    });
    
    // Thêm thông tin enrollment vào mỗi course
    const coursesWithEnrollment = courses.map(course => {
      const enrollment = enrollmentMap[course._id.toString()];
      return {
        ...course,
        enrollment: enrollment ? {
          _id: enrollment._id,
          status: enrollment.status,
          progress: enrollment.progress,
          completedLessons: enrollment.completedLessons,
          totalLessons: enrollment.totalLessons,
          enrolledAt: enrollment.enrolledAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          completedAt: enrollment.completedAt,
          certificate: enrollment.certificate
        } : null,
        isEnrolled: !!enrollment
      };
    });
    
    res.status(200).json({
      success: true,
      count: coursesWithEnrollment.length,
      data: coursesWithEnrollment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get course detail with modules and lessons
// - Yêu cầu đăng nhập
// - Admin: xem tất cả courses (kể cả chưa publish)
// - User khác: chỉ xem published courses
// - Thêm thông tin enrollment nếu user đã enroll
exports.getCourseDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    
    // Nếu là admin: xem tất cả (kể cả chưa publish)
    // Nếu không phải admin: chỉ xem published
    const courseFilter = { _id: id, isActive: true };
    if (req.user.role !== ROLES.ADMIN) {
      courseFilter.isPublished = true;
    }
    
    const course = await Course.findOne(courseFilter).lean();
    
    // Get enrollment info nếu user đã enroll
    const enrollment = await CourseEnrollment.findOne({
      user: userId,
      course: id
    }).lean();
    
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
        ...course,
        enrollment: enrollment ? {
          _id: enrollment._id,
          status: enrollment.status,
          progress: enrollment.progress,
          completedLessons: enrollment.completedLessons,
          totalLessons: enrollment.totalLessons,
          enrolledAt: enrollment.enrolledAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          completedAt: enrollment.completedAt,
          certificate: enrollment.certificate
        } : null,
        isEnrolled: !!enrollment,
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
// - Yêu cầu đăng nhập
// - Admin: xem tất cả lessons (kể cả của course chưa publish)
// - User khác: chỉ xem lesson của published courses
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
        select: 'title isPublished'
      }
    });
    
    // Nếu không phải admin: kiểm tra course có published không (authorization check - giữ lại)
    if (req.user.role !== ROLES.ADMIN && lesson) {
      if (!lesson.module?.course?.isPublished) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem bài học này'
        });
      }
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
      createdBy: req.user._id
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

// Create course with modules and lessons in one API call
exports.createCourseFull = async (req, res) => {
  try {
    let { modules, instructor, tags, ...courseData } = req.body;
    
    // Parse JSON strings nếu có (từ multipart/form-data)
    if (typeof modules === 'string') {
      try {
        modules = JSON.parse(modules);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid modules JSON format'
        });
      }
    }
    
    if (typeof instructor === 'string') {
      try {
        courseData.instructor = JSON.parse(instructor);
      } catch (e) {
        courseData.instructor = instructor;
      }
    } else if (instructor) {
      courseData.instructor = instructor;
    }
    
    if (typeof tags === 'string') {
      try {
        courseData.tags = JSON.parse(tags);
      } catch (e) {
        courseData.tags = tags.split(',').map(t => t.trim());
      }
    } else if (tags) {
      courseData.tags = tags;
    }
    
    // Xử lý thumbnail upload từ local (nếu có)
    if (req.files?.thumbnail) {
      courseData.thumbnail = req.files.thumbnail[0].path; // Cloudinary URL
    }
    
    // Xử lý instructor avatar upload từ local (nếu có)
    if (req.files?.instructorAvatar) {
      if (!courseData.instructor) {
        courseData.instructor = {};
      }
      if (typeof courseData.instructor === 'string') {
        courseData.instructor = JSON.parse(courseData.instructor);
      }
      courseData.instructor.avatar = req.files.instructorAvatar[0].path; // Cloudinary URL
    }
    
    // Tạo course (không validate)
    const course = new Course({
      ...courseData,
      createdBy: req.user._id
    });
    await course.save({ validateBeforeSave: false });
    
    const createdModules = [];
    const createdLessons = [];
    
    // Tạo modules và lessons nếu có
    if (modules && Array.isArray(modules)) {
      for (const moduleData of modules) {
        const { lessons, ...moduleInfo } = moduleData;
        
        // Tạo module (không validate)
        const module = new CourseModule({
          ...moduleInfo,
          course: course._id
        });
        await module.save({ validateBeforeSave: false });
        createdModules.push(module);
        
        // Tạo lessons cho module này (không validate)
        if (lessons && Array.isArray(lessons)) {
          for (const lessonData of lessons) {
            const lesson = new Lesson({
              ...lessonData,
              module: module._id
            });
            await lesson.save({ validateBeforeSave: false });
            createdLessons.push(lesson);
          }
        }
      }
      
      // Cập nhật stats của course
      if (course && typeof course.updateStats === 'function') {
        await course.updateStats();
      }
    }
    
    // Populate để trả về đầy đủ thông tin
    const populatedCourse = await Course.findById(course._id);
    const populatedModules = await CourseModule.find({ course: course._id })
      .sort({ order: 1 })
      .lean();
    
    for (let module of populatedModules) {
      const lessons = await Lesson.find({ module: module._id })
        .sort({ order: 1 })
        .lean();
      module.lessons = lessons;
    }
    
    res.status(201).json({
      success: true,
      message: 'Tạo khóa học kèm modules và lessons thành công',
      data: {
        course: populatedCourse,
        modules: populatedModules
      }
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

// Update course with modules and lessons in one API call
exports.updateCourseFull = async (req, res) => {
  try {
    const { id } = req.params;
    let { modules, instructor, tags, ...courseData } = req.body;
    
    // Parse JSON strings nếu có (từ multipart/form-data)
    if (typeof modules === 'string') {
      try {
        modules = JSON.parse(modules);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid modules JSON format'
        });
      }
    }
    
    if (typeof instructor === 'string') {
      try {
        courseData.instructor = JSON.parse(instructor);
      } catch (e) {
        courseData.instructor = instructor;
      }
    } else if (instructor) {
      courseData.instructor = instructor;
    }
    
    if (typeof tags === 'string') {
      try {
        courseData.tags = JSON.parse(tags);
      } catch (e) {
        courseData.tags = tags.split(',').map(t => t.trim());
      }
    } else if (tags) {
      courseData.tags = tags;
    }
    
    // Xử lý thumbnail upload từ local (nếu có)
    if (req.files?.thumbnail) {
      courseData.thumbnail = req.files.thumbnail[0].path; // Cloudinary URL
    }
    
    // Xử lý instructor avatar upload từ local (nếu có)
    if (req.files?.instructorAvatar) {
      if (!courseData.instructor) {
        courseData.instructor = {};
      }
      if (typeof courseData.instructor === 'string') {
        courseData.instructor = JSON.parse(courseData.instructor);
      }
      courseData.instructor.avatar = req.files.instructorAvatar[0].path; // Cloudinary URL
    }
    
    // Xử lý resources files upload (nếu có)
    if (req.files?.resources && Array.isArray(req.files.resources)) {
      courseData.resources = req.files.resources.map(file => ({
        title: file.originalname,
        url: file.path, // Cloudinary URL
        type: getFileType(file.mimetype)
      }));
    }
    
    // Lấy course (không check tồn tại)
    const course = await Course.findById(id);
    
    // Update course info (không validate)
    if (course) {
      Object.assign(course, courseData);
      await course.save({ validateBeforeSave: false });
    }
    
    // Nếu có modules trong request, update modules và lessons
    if (modules && Array.isArray(modules)) {
      // Lấy danh sách module IDs hiện tại
      const existingModules = await CourseModule.find({ course: id });
      const existingModuleIds = existingModules.map(m => m._id.toString());
      const newModuleIds = [];
      
      // Xử lý từng module trong request
      for (const moduleData of modules) {
        const { lessons, _id, ...moduleInfo } = moduleData;
        
        let module;
        if (_id && existingModuleIds.includes(_id)) {
          // Update module đã tồn tại (không validate)
          module = await CourseModule.findByIdAndUpdate(
            _id,
            moduleInfo,
            { new: true, runValidators: false }
          );
          newModuleIds.push(_id);
        } else {
          // Tạo module mới (không validate)
          module = new CourseModule({
            ...moduleInfo,
            course: id
          });
          await module.save({ validateBeforeSave: false });
          newModuleIds.push(module._id.toString());
        }
        
        // Xử lý lessons của module này
        if (lessons && Array.isArray(lessons)) {
          const existingLessons = await Lesson.find({ module: module._id });
          const existingLessonIds = existingLessons.map(l => l._id.toString());
          const newLessonIds = [];
          
          for (const lessonData of lessons) {
            const { _id: lessonId, ...lessonInfo } = lessonData;
            
            let lesson;
            if (lessonId && existingLessonIds.includes(lessonId)) {
              // Update lesson đã tồn tại (không validate)
              lesson = await Lesson.findByIdAndUpdate(
                lessonId,
                lessonInfo,
                { new: true, runValidators: false }
              );
              newLessonIds.push(lessonId);
            } else {
              // Tạo lesson mới (không validate)
              lesson = new Lesson({
                ...lessonInfo,
                module: module._id
              });
              await lesson.save({ validateBeforeSave: false });
              newLessonIds.push(lesson._id.toString());
            }
          }
          
          // Xóa các lessons không có trong request
          const lessonsToDelete = existingLessons.filter(
            l => !newLessonIds.includes(l._id.toString())
          );
          if (lessonsToDelete.length > 0) {
            await Lesson.deleteMany({
              _id: { $in: lessonsToDelete.map(l => l._id) }
            });
          }
        } else {
          // Nếu không có lessons trong request, xóa tất cả lessons của module này
          await Lesson.deleteMany({ module: module._id });
        }
      }
      
      // Xóa các modules không có trong request
      const modulesToDelete = existingModules.filter(
        m => !newModuleIds.includes(m._id.toString())
      );
      if (modulesToDelete.length > 0) {
        const moduleIdsToDelete = modulesToDelete.map(m => m._id);
        // Xóa lessons của các modules bị xóa
        await Lesson.deleteMany({ module: { $in: moduleIdsToDelete } });
        // Xóa modules
        await CourseModule.deleteMany({ _id: { $in: moduleIdsToDelete } });
      }
      
      // Cập nhật stats của course
      if (course && typeof course.updateStats === 'function') {
        await course.updateStats();
      }
    }
    
    // Populate để trả về đầy đủ thông tin
    const updatedCourse = await Course.findById(id);
    const updatedModules = await CourseModule.find({ course: id })
      .sort({ order: 1 })
      .lean();
    
    for (let module of updatedModules) {
      const lessons = await Lesson.find({ module: module._id })
        .sort({ order: 1 })
        .lean();
      module.lessons = lessons;
    }
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật khóa học kèm modules và lessons thành công',
      data: {
        course: updatedCourse,
        modules: updatedModules
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete course (hard delete - xóa thật sự khỏi DB)
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findById(id);
    
    // Xóa cascade: Xóa tất cả lessons trước, sau đó modules, cuối cùng là course
    // 1. Tìm tất cả modules của course
    const modules = await CourseModule.find({ course: id });
    const moduleIds = modules.map(m => m._id);
    
    // 2. Xóa tất cả lessons của các modules
    if (moduleIds.length > 0) {
      await Lesson.deleteMany({ module: { $in: moduleIds } });
    }
    
    // 3. Xóa tất cả modules
    await CourseModule.deleteMany({ course: id });
    
    // 4. Xóa course
    await Course.findByIdAndDelete(id);
    
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
    
    if (course) {
      course.isPublished = !course.isPublished;
    }
    await course.save();
    
    res.status(200).json({
      success: true,
      message: course ? `${course.isPublished ? 'Xuất bản' : 'Gỡ xuất bản'} khóa học thành công` : 'Không tìm thấy khóa học',
      data: course || null
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

// Upload video to Cloudinary
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file video để upload'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Upload video thành công',
      data: {
        videoUrl: req.file.path,
        videoProvider: 'cloudinary',
        publicId: req.file.filename,
        duration: req.file.duration || null,
        format: req.file.format,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
