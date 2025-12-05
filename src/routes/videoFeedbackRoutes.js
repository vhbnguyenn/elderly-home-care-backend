const express = require('express');
const router = express.Router();
const videoFeedbackController = require('../controllers/videoFeedbackController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoCallFeedback:
 *       type: object
 *       required:
 *         - receiverId
 *         - videoQuality
 *         - audioQuality
 *         - connectionStability
 *         - overallExperience
 *       properties:
 *         receiverId:
 *           type: string
 *           description: ID của người nhận cuộc gọi
 *         bookingId:
 *           type: string
 *           description: ID của booking (optional)
 *         chatSessionId:
 *           type: string
 *           description: ID của chat session (optional)
 *         callInfo:
 *           type: object
 *           properties:
 *             duration:
 *               type: number
 *               description: Thời lượng cuộc gọi (giây)
 *             startTime:
 *               type: string
 *               format: date-time
 *             endTime:
 *               type: string
 *               format: date-time
 *         videoQuality:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Chất lượng video (1-5 sao)
 *         audioQuality:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Chất lượng audio (1-5 sao)
 *         connectionStability:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Độ ổn định kết nối (1-5 sao)
 *         issues:
 *           type: array
 *           items:
 *             type: string
 *             enum: [video_lag, audio_delay, disconnected, poor_video_quality, poor_audio_quality, echo, background_noise, frozen_screen, no_video, no_audio, other]
 *         overallExperience:
 *           type: string
 *           enum: [excellent, good, average, poor, very_poor]
 *         additionalNotes:
 *           type: string
 *           maxLength: 500
 *         wouldUseAgain:
 *           type: boolean
 *           default: true
 */

/**
 * @swagger
 * /api/video-feedback:
 *   post:
 *     summary: Tạo feedback chất lượng video call
 *     tags: [Video Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoCallFeedback'
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Receiver/Booking/Chat not found
 */
router.post('/', protect, videoFeedbackController.createFeedback);

/**
 * @swagger
 * /api/video-feedback/my-feedbacks:
 *   get:
 *     summary: Lấy danh sách feedback đã gửi
 *     tags: [Video Feedback]
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
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
 */
router.get('/my-feedbacks', protect, videoFeedbackController.getMyFeedbacks);

/**
 * @swagger
 * /api/video-feedback/received:
 *   get:
 *     summary: Lấy danh sách feedback nhận được
 *     tags: [Video Feedback]
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
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
 */
router.get('/received', protect, videoFeedbackController.getReceivedFeedbacks);

/**
 * @swagger
 * /api/video-feedback/stats:
 *   get:
 *     summary: Lấy thống kê feedback của tôi
 *     tags: [Video Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', protect, videoFeedbackController.getFeedbackStats);

/**
 * @swagger
 * /api/video-feedback/admin/system-stats:
 *   get:
 *     summary: Lấy thống kê hệ thống (Admin only)
 *     tags: [Video Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
 */
router.get('/admin/system-stats', protect, authorize(ROLES.ADMIN), videoFeedbackController.getSystemStats);

/**
 * @swagger
 * /api/video-feedback/{id}:
 *   get:
 *     summary: Lấy chi tiết feedback
 *     tags: [Video Feedback]
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
 *     summary: Cập nhật feedback (chỉ người tạo)
 *     tags: [Video Feedback]
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
 *             $ref: '#/components/schemas/VideoCallFeedback'
 *     responses:
 *       200:
 *         description: Feedback updated successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Feedback not found
 *   delete:
 *     summary: Xóa feedback (người tạo hoặc admin)
 *     tags: [Video Feedback]
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
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Feedback not found
 */
router.get('/:id', protect, videoFeedbackController.getFeedbackDetail);
router.put('/:id', protect, videoFeedbackController.updateFeedback);
router.delete('/:id', protect, videoFeedbackController.deleteFeedback);

module.exports = router;
