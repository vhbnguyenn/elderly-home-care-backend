const express = require('express');
const router = express.Router();
const caregiverReviewController = require('../controllers/caregiverReviewController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     CaregiverReview:
 *       type: object
 *       required:
 *         - bookingId
 *         - ratings
 *         - familySupport
 *         - recommendation
 *       properties:
 *         bookingId:
 *           type: string
 *           description: ID của booking đã hoàn thành
 *         ratings:
 *           type: object
 *           properties:
 *             cooperation:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             communication:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             respect:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             readiness:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             workingEnvironment:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *         familySupport:
 *           type: string
 *           enum: [very_supportive, supportive, neutral, minimal, none]
 *         issues:
 *           type: array
 *           items:
 *             type: string
 *             enum: [late_payment, schedule_changes, unrealistic_expectations, communication_difficulties, safety_concerns, hygiene_issues, other]
 *         recommendation:
 *           type: string
 *           enum: [highly_recommend, recommend, neutral, not_recommend]
 *         additionalNotes:
 *           type: string
 *           maxLength: 1000
 */

/**
 * @swagger
 * /api/caregiver-reviews:
 *   post:
 *     summary: Tạo review mới (Caregiver đánh giá Careseeker)
 *     tags: [Caregiver Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CaregiverReview'
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Forbidden - only caregivers can create reviews
 *       404:
 *         description: Booking not found
 */
router.post('/', protect, authorize(ROLES.CAREGIVER), caregiverReviewController.createReview);

/**
 * @swagger
 * /api/caregiver-reviews/my-reviews:
 *   get:
 *     summary: Lấy danh sách review của tôi (caregiver)
 *     tags: [Caregiver Reviews]
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
router.get('/my-reviews', protect, caregiverReviewController.getMyReviews);

/**
 * @swagger
 * /api/caregiver-reviews/received:
 *   get:
 *     summary: Lấy danh sách review nhận được (careseeker)
 *     tags: [Caregiver Reviews]
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
 *         description: Forbidden - only careseekers can access
 */
router.get('/received', protect, authorize(ROLES.CARE_SEEKER), caregiverReviewController.getReceivedReviews);


/**
 * @swagger
 * /api/caregiver-reviews/{id}:
 *   get:
 *     summary: Lấy chi tiết một review
 *     tags: [Caregiver Reviews]
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
 *     tags: [Caregiver Reviews]
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
 *             $ref: '#/components/schemas/CaregiverReview'
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Review not found
 */
router.get('/:id', caregiverReviewController.getReviewDetail);
router.put('/:id', protect, caregiverReviewController.updateReview);

/**
 * @swagger
 * /api/caregiver-reviews/{id}/toggle-visibility:
 *   put:
 *     summary: Admin ẩn/hiện review
 *     tags: [Caregiver Reviews]
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
router.put('/:id/toggle-visibility', protect, authorize(ROLES.ADMIN), caregiverReviewController.toggleReviewVisibility);

module.exports = router;
