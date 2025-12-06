const express = require('express');
const router = express.Router();
const videoCallController = require('../controllers/videoCallController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoCall:
 *       type: object
 *       required:
 *         - receiverId
 *       properties:
 *         receiverId:
 *           type: string
 *           description: ID của người nhận cuộc gọi
 *         bookingId:
 *           type: string
 *           description: ID của booking (optional)
 *         callType:
 *           type: string
 *           enum: [video, audio]
 *           default: video
 *         deviceInfo:
 *           type: object
 *           properties:
 *             platform:
 *               type: string
 *               enum: [ios, android, web]
 *             deviceModel:
 *               type: string
 *             osVersion:
 *               type: string
 *             appVersion:
 *               type: string
 */

/**
 * @swagger
 * /api/video-calls/initiate:
 *   post:
 *     summary: Khởi tạo cuộc gọi video/audio
 *     tags: [Video Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoCall'
 *     responses:
 *       201:
 *         description: Call initiated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Receiver not found
 */
router.post('/initiate', protect, videoCallController.initiateCall);

/**
 * @swagger
 * /api/video-calls/{id}/accept:
 *   post:
 *     summary: Chấp nhận cuộc gọi
 *     tags: [Video Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Call accepted successfully
 *       400:
 *         description: Cannot accept call at this status
 *       403:
 *         description: Forbidden - not the receiver
 *       404:
 *         description: Call not found
 */
router.post('/:id/accept', protect, videoCallController.acceptCall);

/**
 * @swagger
 * /api/video-calls/{id}/reject:
 *   post:
 *     summary: Từ chối cuộc gọi
 *     tags: [Video Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: Call rejected successfully
 *       400:
 *         description: Cannot reject call at this status
 *       403:
 *         description: Forbidden - not the receiver
 *       404:
 *         description: Call not found
 */
router.post('/:id/reject', protect, videoCallController.rejectCall);

/**
 * @swagger
 * /api/video-calls/{id}/end:
 *   post:
 *     summary: Kết thúc cuộc gọi
 *     tags: [Video Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qualityMetrics:
 *                 type: object
 *                 properties:
 *                   callerNetwork:
 *                     type: string
 *                     enum: [wifi, 4g, 5g, 3g, unknown]
 *                   receiverNetwork:
 *                     type: string
 *                     enum: [wifi, 4g, 5g, 3g, unknown]
 *                   avgBitrate:
 *                     type: number
 *                   packetLoss:
 *                     type: number
 *                   latency:
 *                     type: number
 *     responses:
 *       200:
 *         description: Call ended successfully
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Call not found
 */
router.post('/:id/end', protect, videoCallController.endCall);

/**
 * @swagger
 * /api/video-calls/history:
 *   get:
 *     summary: Lấy lịch sử cuộc gọi của tôi
 *     tags: [Video Calls]
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
 *         name: callType
 *         schema:
 *           type: string
 *           enum: [video, audio]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ringing, ongoing, ended, missed, rejected, failed]
 *     responses:
 *       200:
 *         description: Call history retrieved successfully
 */
router.get('/history', protect, videoCallController.getCallHistory);

/**
 * @swagger
 * /api/video-calls/statistics/me:
 *   get:
 *     summary: Lấy thống kê cuộc gọi của tôi
 *     tags: [Video Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics/me', protect, videoCallController.getMyStatistics);

/**
 * @swagger
 * /api/video-calls/{id}:
 *   get:
 *     summary: Lấy chi tiết cuộc gọi
 *     tags: [Video Calls]
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
 *         description: Call detail retrieved successfully
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Call not found
 */
router.get('/:id', protect, videoCallController.getCallDetail);

/**
 * @swagger
 * /api/video-calls/{id}/signaling:
 *   post:
 *     summary: Lưu WebRTC signaling data (offer/answer/ice-candidate)
 *     tags: [Video Calls]
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
 *               - type
 *               - data
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [offer, answer, ice-candidate]
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Signaling data saved and relayed
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Call not found
 */
router.post('/:id/signaling', protect, videoCallController.saveSignalingData);

/**
 * @swagger
 * /api/video-calls/admin/all:
 *   get:
 *     summary: Lấy tất cả cuộc gọi (Admin only)
 *     tags: [Video Calls]
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
 *         name: callType
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All calls retrieved successfully with statistics
 */
router.get('/admin/all', protect, authorize(ROLES.ADMIN), videoCallController.getAllCalls);

module.exports = router;
