const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

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
 *     summary: Lấy danh sách khóa học
 *     tags: [Courses]
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
 *         description: Danh sách khóa học
 */
router.get('/', courseController.getAllCourses);

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Lấy chi tiết khóa học (có modules và lessons)
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết khóa học
 *       404:
 *         description: Không tìm thấy khóa học
 */
router.get('/:id', courseController.getCourseDetail);

/**
 * @swagger
 * /api/courses/lesson/{lessonId}:
 *   get:
 *     summary: Lấy chi tiết bài học
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết bài học
 */
router.get('/lesson/:lessonId', courseController.getLessonDetail);

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
 * /api/courses/my-enrollments:
 *   get:
 *     summary: Lấy danh sách khóa học đã đăng ký của tôi
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, dropped]
 *     responses:
 *       200:
 *         description: Danh sách khóa học đã đăng ký
 */
router.get('/my-enrollments', protect, enrollmentController.getMyEnrollments);

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

/**
 * @swagger
 * /api/courses/lesson/{lessonId}/progress:
 *   get:
 *     summary: Lấy tiến độ bài học
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
 *         description: Tiến độ bài học
 */
router.get('/lesson/:lessonId/progress', protect, enrollmentController.getLessonProgress);

/**
 * @swagger
 * /api/courses/lesson/{lessonId}/video-progress:
 *   post:
 *     summary: Cập nhật tiến độ xem video
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentTime:
 *                 type: number
 *                 description: Thời gian hiện tại (giây)
 *               duration:
 *                 type: number
 *                 description: Tổng thời lượng video (giây)
 *     responses:
 *       200:
 *         description: Cập nhật tiến độ thành công
 */
router.post('/lesson/:lessonId/video-progress', protect, enrollmentController.updateVideoProgress);

// ========== ADMIN ROUTES ==========

/**
 * @swagger
 * /api/courses/admin/create:
 *   post:
 *     summary: Tạo khóa học mới (Admin)
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
 *               description:
 *                 type: string
 *               thumbnail:
 *                 type: string
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
 *     responses:
 *       201:
 *         description: Tạo khóa học thành công
 */
router.post('/admin/create', protect, authorize(ROLES.ADMIN), courseController.createCourse);

/**
 * @swagger
 * /api/courses/admin/{id}:
 *   put:
 *     summary: Cập nhật khóa học (Admin)
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
 *         description: Cập nhật thành công
 */
router.put('/admin/:id', protect, authorize(ROLES.ADMIN), courseController.updateCourse);

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

/**
 * @swagger
 * /api/courses/admin/{courseId}/modules:
 *   post:
 *     summary: Tạo module mới (Admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tạo module thành công
 */
router.post('/admin/:courseId/modules', protect, authorize(ROLES.ADMIN), courseController.createModule);

/**
 * @swagger
 * /api/courses/admin/modules/{moduleId}/lessons:
 *   post:
 *     summary: Tạo bài học mới (Admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               duration:
 *                 type: number
 *               learningObjectives:
 *                 type: array
 *                 items:
 *                   type: string
 *               order:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tạo bài học thành công
 */
router.post('/admin/modules/:moduleId/lessons', protect, authorize(ROLES.ADMIN), courseController.createLesson);

/**
 * @swagger
 * /api/courses/admin/lessons/{lessonId}:
 *   put:
 *     summary: Cập nhật bài học (Admin)
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
 *         description: Cập nhật thành công
 */
router.put('/admin/lessons/:lessonId', protect, authorize(ROLES.ADMIN), courseController.updateLesson);

module.exports = router;
