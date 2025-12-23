const express = require('express');
const router = express.Router();
const careseekerReviewController = require('../controllers/careseekerReviewController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     CareseekerReview:
 *       type: object
 *       required:
 *         - bookingId
 *         - ratings
 *         - overallSatisfaction
 *         - wouldUseAgain
 *       properties:
 *         bookingId:
 *           type: string
 *           description: ID của booking đã hoàn thành
 *         ratings:
 *           type: object
 *           properties:
 *             professionalism:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             attitude:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             punctuality:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             careQuality:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             communication:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *         overallSatisfaction:
 *           type: string
 *           enum: [very_satisfied, satisfied, neutral, dissatisfied, very_dissatisfied]
 *         strengths:
 *           type: array
 *           items:
 *             type: string
 *             enum: [professional_skills, friendly_attitude, patient, careful, good_communication, punctual, flexible, experienced, other]
 *         improvements:
 *           type: array
 *           items:
 *             type: string
 *             enum: [technical_skills, communication, punctuality, attitude, attention_to_detail, flexibility, other]
 *         wouldUseAgain:
 *           type: string
 *           enum: [definitely, probably, maybe, probably_not, definitely_not]
 *         additionalNotes:
 *           type: string
 *           maxLength: 1000
 */

/**
 * @swagger
 * /api/careseeker-reviews:
 *   post:
 *     summary: Tạo review mới (Careseeker đánh giá Caregiver)
 *     tags: [Careseeker Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CareseekerReview'
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Forbidden - only careseekers can create reviews
 *       404:
 *         description: Booking not found
 */
router.post('/', protect, authorize(ROLES.CARE_SEEKER), careseekerReviewController.createReview);

/**
 * @swagger
 * /api/careseeker-reviews/my-reviews:
 *   get:
 *     summary: Lấy danh sách review của tôi (careseeker)
 *     tags: [Careseeker Reviews]
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
 *         description: Reviews retrieved successfully
 */
router.get('/my-reviews', protect, careseekerReviewController.getMyReviews);

/**
 * @swagger
 * /api/careseeker-reviews/received:
 *   get:
 *     summary: Lấy danh sách review nhận được (caregiver)
 *     tags: [Careseeker Reviews]
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
 *         description: Reviews retrieved successfully
 *       403:
 *         description: Forbidden - only caregivers can access
 */
router.get('/received', protect, authorize(ROLES.CAREGIVER), careseekerReviewController.getReceivedReviews);

/**
 * @swagger
 * /api/careseeker-reviews/caregiver/{caregiverUserId}:
 *   get:
 *     summary: Lấy tất cả review về một caregiver (public)
 *     tags: [Careseeker Reviews]
 *     parameters:
 *       - in: path
 *         name: caregiverUserId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Reviews and statistics retrieved successfully
 *       404:
 *         description: Caregiver not found
 */
router.get('/caregiver/:caregiverUserId', careseekerReviewController.getCaregiverReviews);


/**
 * @swagger
 * /api/careseeker-reviews/{id}:
 *   get:
 *     summary: Lấy chi tiết một review
 *     tags: [Careseeker Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review detail retrieved successfully
 *       404:
 *         description: Review not found
 *   put:
 *     summary: Cập nhật review (chỉ người tạo)
 *     tags: [Careseeker Reviews]
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
 *             $ref: '#/components/schemas/CareseekerReview'
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Review not found
 */
router.get('/:id', careseekerReviewController.getReviewDetail);
router.put('/:id', protect, careseekerReviewController.updateReview);

/**
 * @swagger
 * /api/careseeker-reviews/{id}/toggle-visibility:
 *   put:
 *     summary: Admin ẩn/hiện review
 *     tags: [Careseeker Reviews]
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
 *         description: Review visibility toggled successfully
 *       404:
 *         description: Review not found
 */
router.put('/:id/toggle-visibility', protect, authorize(ROLES.ADMIN), careseekerReviewController.toggleReviewVisibility);

module.exports = router;
