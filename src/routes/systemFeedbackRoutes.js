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
 *     summary: Lấy chi tiết feedback (Admin only)
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
 *         description: Forbidden - Admin only
 *       404:
 *         description: Feedback not found
 */
router.get('/:id', protect, authorize(ROLES.ADMIN), systemFeedbackController.getFeedbackDetail);

module.exports = router;
