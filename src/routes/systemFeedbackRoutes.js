const express = require('express');
const router = express.Router();
const systemFeedbackController = require('../controllers/systemFeedbackController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemFeedback:
 *       type: object
 *       required:
 *         - feedbackType
 *         - category
 *         - title
 *         - description
 *       properties:
 *         feedbackType:
 *           type: string
 *           enum: [bug_report, feature_request, improvement, user_experience, performance, complaint, compliment, other]
 *         category:
 *           type: string
 *           enum: [booking, payment, chat, video_call, profile, search, notification, review, general, other]
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: medium
 *         title:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 2000
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [image, video, document]
 *         deviceInfo:
 *           type: object
 *           properties:
 *             platform:
 *               type: string
 *               enum: [ios, android, web, other]
 *             appVersion:
 *               type: string
 *             osVersion:
 *               type: string
 *             deviceModel:
 *               type: string
 *         satisfactionRating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         tags:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /api/system-feedback:
 *   post:
 *     summary: Tạo feedback/góp ý về hệ thống
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemFeedback'
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *       400:
 *         description: Bad request - validation error
 */
router.post('/', protect, systemFeedbackController.createFeedback);

/**
 * @swagger
 * /api/system-feedback/my-feedbacks:
 *   get:
 *     summary: Lấy danh sách feedback của tôi
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: -createdAt
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewing, in_progress, resolved, closed, rejected]
 *       - in: query
 *         name: feedbackType
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
 */
router.get('/my-feedbacks', protect, systemFeedbackController.getMyFeedbacks);

/**
 * @swagger
 * /api/system-feedback/admin/all:
 *   get:
 *     summary: Lấy tất cả feedback (Admin only)
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: -createdAt
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: feedbackType
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All feedbacks retrieved successfully
 */
router.get('/admin/all', protect, authorize(ROLES.ADMIN), systemFeedbackController.getAllFeedbacks);

/**
 * @swagger
 * /api/system-feedback/{id}:
 *   get:
 *     summary: Lấy chi tiết feedback
 *     tags: [System Feedback]
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
 *         description: Feedback detail retrieved successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 *   put:
 *     summary: Cập nhật feedback (chỉ khi pending/reviewing)
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               attachments:
 *                 type: array
 *               priority:
 *                 type: string
 *               satisfactionRating:
 *                 type: number
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 *       400:
 *         description: Cannot update processed feedback
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 *   delete:
 *     summary: Xóa feedback (chỉ khi pending)
 *     tags: [System Feedback]
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
 *         description: Feedback deleted successfully
 *       400:
 *         description: Cannot delete processed feedback
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 */
router.get('/:id', protect, systemFeedbackController.getFeedbackDetail);
router.put('/:id', protect, systemFeedbackController.updateFeedback);
router.delete('/:id', protect, systemFeedbackController.deleteFeedback);

/**
 * @swagger
 * /api/system-feedback/{id}/rate-resolution:
 *   post:
 *     summary: Đánh giá mức độ hài lòng với cách giải quyết
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - satisfaction
 *             properties:
 *               satisfaction:
 *                 type: string
 *                 enum: [satisfied, neutral, dissatisfied]
 *     responses:
 *       200:
 *         description: Rating submitted successfully
 *       400:
 *         description: Can only rate resolved/closed feedback
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 */
router.post('/:id/rate-resolution', protect, systemFeedbackController.rateResolution);

/**
 * @swagger
 * /api/system-feedback/{id}/respond:
 *   post:
 *     summary: Admin phản hồi feedback
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [pending, reviewing, in_progress, resolved, closed, rejected]
 *     responses:
 *       200:
 *         description: Response added successfully
 *       404:
 *         description: Feedback not found
 */
router.post('/:id/respond', protect, authorize(ROLES.ADMIN), systemFeedbackController.respondToFeedback);

/**
 * @swagger
 * /api/system-feedback/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái feedback (Admin)
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewing, in_progress, resolved, closed, rejected]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Feedback not found
 */
router.put('/:id/status', protect, authorize(ROLES.ADMIN), systemFeedbackController.updateFeedbackStatus);

/**
 * @swagger
 * /api/system-feedback/{id}/internal-note:
 *   post:
 *     summary: Thêm ghi chú nội bộ (Admin)
 *     tags: [System Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Internal note added successfully
 *       404:
 *         description: Feedback not found
 */
router.post('/:id/internal-note', protect, authorize(ROLES.ADMIN), systemFeedbackController.addInternalNote);

module.exports = router;
