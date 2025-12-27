const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const { protect, authorize, protectOptional } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { uploadVideo, uploadCourse, uploadCourseWithResources } = require('../middlewares/upload');

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
 *     description: |
 *       Tạo khóa học, modules và lessons tất cả trong 1 request.
 *       Hỗ trợ upload thumbnail và instructor avatar lên Cloudinary.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh thumbnail (jpg, jpeg, png, tối đa 5MB)
 *               instructorAvatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh avatar giảng viên (jpg, jpeg, png, tối đa 5MB)
 *               resources:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Upload tài liệu khóa học (pdf, doc, video, image, excel... - Tối đa 50 files, mỗi file 20MB)
 *               title:
 *                 type: string
 *                 example: "Chăm sóc người già cơ bản"
 *               description:
 *                 type: string
 *                 example: "Khóa học cung cấp kiến thức cơ bản về chăm sóc người già"
 *               instructor:
 *                 type: string
 *                 description: JSON string của thông tin giảng viên (không cần avatar nếu upload instructorAvatar file)
 *                 example: '{"name":"Nguyễn Văn A","title":"Chuyên gia chăm sóc người già"}'
 *               level:
 *                 type: string
 *                 enum: [Cơ bản, Trung cấp, Nâng cao]
 *                 example: "Cơ bản"
 *               category:
 *                 type: string
 *                 example: "Chăm sóc sức khỏe"
 *               tags:
 *                 type: string
 *                 description: JSON array string của tags
 *                 example: '["chăm sóc", "người già"]'
 *               isPublished:
 *                 type: boolean
 *                 example: true
 *               modules:
 *                 type: string
 *                 description: JSON array string của modules kèm lessons
 *                 example: '[{"title":"Module 1: Giới thiệu","description":"Giới thiệu về chăm sóc người già","order":1,"lessons":[{"title":"Bài 1: Tổng quan","description":"Bài học đầu tiên","content":"Nội dung bài học...","videoUrl":"https://example.com/video.mp4","duration":30,"order":1}]}]'
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               thumbnail:
 *                 type: string
 *                 description: URL của thumbnail (nếu không upload file)
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
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               modules:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Tạo khóa học kèm modules và lessons thành công
 */
router.post('/admin/create-full', protect, authorize(ROLES.ADMIN), uploadCourseWithResources, courseController.createCourseFull);

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh thumbnail mới (optional, jpg, jpeg, png, tối đa 5MB)
 *               instructorAvatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh avatar giảng viên mới (optional, jpg, jpeg, png, tối đa 5MB)
 *               resources:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Upload tài liệu khóa học mới (optional, pdf, doc, video, image, excel... - Tối đa 50 files, mỗi file 20MB)
 *               title:
 *                 type: string
 *                 example: "Chăm sóc người già cơ bản (Updated)"
 *               description:
 *                 type: string
 *                 example: "Mô tả đã cập nhật"
 *               instructor:
 *                 type: string
 *                 description: JSON string của thông tin giảng viên (không cần avatar nếu upload instructorAvatar file)
 *                 example: '{"name":"Nguyễn Văn A","title":"Chuyên gia"}'
 *               level:
 *                 type: string
 *                 enum: [Cơ bản, Trung cấp, Nâng cao]
 *               category:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: JSON array string của tags
 *                 example: '["chăm sóc", "người già"]'
 *               isPublished:
 *                 type: boolean
 *               modules:
 *                 type: string
 *                 description: JSON array string của modules. Có _id = update, không có _id = tạo mới
 *                 example: '[{"_id":"existing_module_id","title":"Module 1","order":1,"lessons":[{"_id":"existing_lesson_id","title":"Bài 1","order":1},{"title":"Bài mới","order":2}]},{"title":"Module mới","order":2,"lessons":[{"title":"Bài học mới","order":1}]}]'
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               thumbnail:
 *                 type: string
 *                 description: URL của thumbnail (nếu không upload file)
 *               instructor:
 *                 type: object
 *               level:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               modules:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Cập nhật khóa học kèm modules và lessons thành công
 *       404:
 *         description: Không tìm thấy khóa học
 */
router.put('/admin/:id/update-full', protect, authorize(ROLES.ADMIN), uploadCourseWithResources, courseController.updateCourseFull);

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
