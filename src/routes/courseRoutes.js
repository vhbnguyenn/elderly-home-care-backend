const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const { protect, authorize, protectOptional } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { uploadVideo } = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: Courses
 *   description: Training courses management
 */

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Lấy danh sách khóa học (yêu cầu đăng nhập)
 *     description: |
 *       - Yêu cầu đăng nhập (không còn public)
 *       - Hiển thị tất cả courses (chưa enroll + đã enroll)
 *       - Mỗi course có thông tin enrollment nếu user đã enroll
 *       - Admin: Xem tất cả khóa học (kể cả chưa xuất bản)
 *       - User khác: Chỉ xem các khóa học đã được xuất bản (isPublished: true)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [Cơ bản, Trung cấp, Nâng cao]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách khóa học (có thông tin enrollment nếu đã enroll)
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/', protect, courseController.getAllCourses);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Lấy chi tiết khóa học (có modules và lessons)
 *     description: |
 *       - Yêu cầu đăng nhập (không còn public)
 *       - Có thông tin enrollment nếu user đã enroll
 *       - Admin: Xem tất cả khóa học (kể cả chưa xuất bản)
 *       - User khác: Chỉ xem khóa học đã được xuất bản (isPublished: true)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết khóa học (có thông tin enrollment nếu đã enroll)
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy khóa học
 */
router.get('/:id', protect, courseController.getCourseDetail);

/**
 * @swagger
 * /api/courses/lesson/{lessonId}:
 *   get:
 *     summary: Lấy chi tiết bài học
 *     description: |
 *       - Yêu cầu đăng nhập (không còn public)
 *       - User khác: Chỉ xem bài học của khóa học đã được xuất bản
 *       - Admin: Xem tất cả bài học (kể cả của khóa học chưa xuất bản)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết bài học
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xem bài học này
 *       404:
 *         description: Không tìm thấy bài học
 */
router.get('/lesson/:lessonId', protect, courseController.getLessonDetail);

/**
 * @swagger
 * /api/courses/{courseId}/enroll:
 *   post:
 *     summary: Đăng ký khóa học (Vào học)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Đã đăng ký rồi
 */
router.post('/:courseId/enroll', protect, enrollmentController.enrollCourse);

/**
 * @swagger
 * /api/courses/{courseId}/progress:
 *   get:
 *     summary: Lấy tiến độ học khóa học
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tiến độ học
 */
router.get('/:courseId/progress', protect, enrollmentController.getCourseProgress);

/**
 * @swagger
 * /api/courses/lesson/{lessonId}/complete:
 *   post:
 *     summary: Đánh dấu hoàn thành bài học
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đánh dấu hoàn thành thành công
 */
router.post('/lesson/:lessonId/complete', protect, enrollmentController.markLessonComplete);

// ========== ADMIN ROUTES ==========

/**
 * @swagger
 * /api/courses/admin/upload-video:
 *   post:
 *     summary: Upload video lên Cloudinary (Admin)
 *     description: Upload video file từ local lên Cloudinary và trả về URL
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (mp4, mov, avi, mkv, wmv, flv, webm) - Max 100MB
 *     responses:
 *       200:
 *         description: Upload video thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     videoUrl:
 *                       type: string
 *                       description: URL của video trên Cloudinary
 *                     videoProvider:
 *                       type: string
 *                       description: Luôn là "cloudinary"
 *                     publicId:
 *                       type: string
 *                     duration:
 *                       type: number
 *                     format:
 *                       type: string
 *                     size:
 *                       type: number
 *       400:
 *         description: Lỗi upload (không có file hoặc file không hợp lệ)
 */
router.post('/admin/upload-video', protect, authorize(ROLES.ADMIN), uploadVideo.single('video'), courseController.uploadVideo);

/**
 * @swagger
 * /api/courses/admin/create-full:
 *   post:
 *     summary: Tạo khóa học kèm modules và lessons trong 1 API (Admin)
 *     description: Tạo khóa học, modules và lessons tất cả trong 1 request
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Chăm sóc người già cơ bản"
 *               description:
 *                 type: string
 *                 example: "Khóa học cung cấp kiến thức cơ bản về chăm sóc người già"
 *               thumbnail:
 *                 type: string
 *                 example: "https://example.com/thumbnail.jpg"
 *               instructor:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Nguyễn Văn A"
 *                   title:
 *                     type: string
 *                     example: "Chuyên gia chăm sóc người già"
 *                   avatar:
 *                     type: string
 *                     example: "https://example.com/avatar.jpg"
 *               level:
 *                 type: string
 *                 enum: [Cơ bản, Trung cấp, Nâng cao]
 *                 example: "Cơ bản"
 *               category:
 *                 type: string
 *                 example: "Chăm sóc sức khỏe"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["chăm sóc", "người già"]
 *               modules:
 *                 type: array
 *                 description: Danh sách modules kèm lessons
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: "Module 1: Giới thiệu"
 *                     description:
 *                       type: string
 *                       example: "Giới thiệu về chăm sóc người già"
 *                     order:
 *                       type: number
 *                       example: 1
 *                     lessons:
 *                       type: array
 *                       description: Danh sách lessons trong module
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: "Bài 1: Tổng quan"
 *                           description:
 *                             type: string
 *                             example: "Bài học đầu tiên"
 *                           content:
 *                             type: string
 *                             example: "Nội dung bài học..."
 *                           videoUrl:
 *                             type: string
 *                             example: "https://example.com/video.mp4"
 *                           duration:
 *                             type: number
 *                             example: 1800
 *                           learningObjectives:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["Hiểu về nhu cầu", "Nắm nguyên tắc cơ bản"]
 *                           order:
 *                             type: number
 *                             example: 1
 *           example:
 *             title: "Chăm sóc người già cơ bản"
 *             description: "Khóa học cung cấp kiến thức cơ bản"
 *             level: "Cơ bản"
 *             category: "Chăm sóc sức khỏe"
 *             modules:
 *               - title: "Module 1: Giới thiệu"
 *                 description: "Giới thiệu về chăm sóc người già"
 *                 order: 1
 *                 lessons:
 *                   - title: "Bài 1: Tổng quan"
 *                     description: "Bài học đầu tiên"
 *                     content: "Nội dung bài học..."
 *                     videoUrl: "https://example.com/video.mp4"
 *                     duration: 1800
 *                     order: 1
 *                   - title: "Bài 2: Nguyên tắc cơ bản"
 *                     description: "Bài học thứ hai"
 *                     content: "Nội dung bài học..."
 *                     videoUrl: "https://example.com/video2.mp4"
 *                     duration: 2000
 *                     order: 2
 *               - title: "Module 2: Thực hành"
 *                 description: "Module thực hành"
 *                 order: 2
 *                 lessons:
 *                   - title: "Bài 3: Thực hành cơ bản"
 *                     description: "Bài học thực hành"
 *                     content: "Nội dung..."
 *                     videoUrl: "https://example.com/video3.mp4"
 *                     duration: 1500
 *                     order: 1
 *     responses:
 *       201:
 *         description: Tạo khóa học kèm modules và lessons thành công
 */
router.post('/admin/create-full', protect, authorize(ROLES.ADMIN), courseController.createCourseFull);

/**
 * @swagger
 * /api/courses/admin/{id}/update-full:
 *   put:
 *     summary: Cập nhật khóa học kèm modules và lessons trong 1 API (Admin)
 *     description: |
 *       Cập nhật khóa học, modules và lessons tất cả trong 1 request.
 *       - Nếu module/lesson có _id: sẽ update
 *       - Nếu module/lesson không có _id: sẽ tạo mới
 *       - Các module/lesson không có trong request sẽ bị xóa
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của course cần update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Chăm sóc người già cơ bản (Updated)"
 *               description:
 *                 type: string
 *                 example: "Mô tả đã cập nhật"
 *               thumbnail:
 *                 type: string
 *                 example: "https://example.com/thumbnail.jpg"
 *               instructor:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   title:
 *                     type: string
 *                   avatar:
 *                     type: string
 *               level:
 *                 type: string
 *                 enum: [Cơ bản, Trung cấp, Nâng cao]
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               modules:
 *                 type: array
 *                 description: Danh sách modules kèm lessons. Có _id = update, không có _id = tạo mới
 *                 items:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: ID của module (nếu có = update, không có = tạo mới)
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     order:
 *                       type: number
 *                     lessons:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: ID của lesson (nếu có = update, không có = tạo mới)
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           content:
 *                             type: string
 *                           videoUrl:
 *                             type: string
 *                           duration:
 *                             type: number
 *                           learningObjectives:
 *                             type: array
 *                             items:
 *                               type: string
 *                           order:
 *                             type: number
 *           example:
 *             title: "Chăm sóc người già cơ bản (Updated)"
 *             description: "Mô tả đã cập nhật"
 *             level: "Cơ bản"
 *             modules:
 *               - _id: "existing_module_id"
 *                 title: "Module 1: Giới thiệu (Updated)"
 *                 order: 1
 *                 lessons:
 *                   - _id: "existing_lesson_id"
 *                     title: "Bài 1: Tổng quan (Updated)"
 *                     order: 1
 *                   - title: "Bài mới: Thêm mới"
 *                     description: "Bài học mới"
 *                     order: 2
 *               - title: "Module mới"
 *                 description: "Module mới được thêm"
 *                 order: 2
 *                 lessons:
 *                   - title: "Bài học mới"
 *                     order: 1
 *     responses:
 *       200:
 *         description: Cập nhật khóa học kèm modules và lessons thành công
 *       404:
 *         description: Không tìm thấy khóa học
 */
router.put('/admin/:id/update-full', protect, authorize(ROLES.ADMIN), courseController.updateCourseFull);

/**
 * @swagger
 * /api/courses/admin/{id}/publish:
 *   patch:
 *     summary: Xuất bản/gỡ xuất bản khóa học (Admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Toggle publish thành công
 */
router.patch('/admin/:id/publish', protect, authorize(ROLES.ADMIN), courseController.togglePublish);

/**
 * @swagger
 * /api/courses/admin/{id}:
 *   delete:
 *     summary: Xóa khóa học (Admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/admin/:id', protect, authorize(ROLES.ADMIN), courseController.deleteCourse);

module.exports = router;
