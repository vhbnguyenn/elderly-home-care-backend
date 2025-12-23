const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * /api/reviews/caregiver/{caregiverId}:
 *   get:
 *     summary: Get reviews for a caregiver
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: packageType
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/caregiver/:caregiverId', reviewController.getCaregiverReviews);

/**
 * @swagger
 * /api/reviews/admin/all:
 *   get:
 *     summary: Lấy tất cả reviews (Admin only) - cả caregiver và careseeker reviews
 *     tags: [Reviews]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [caregiver, careseeker]
 *         description: Lọc theo loại review (nếu không có thì lấy cả 2)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, hidden]
 *       - in: query
 *         name: isVisible
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên reviewer hoặc người được review
 *     responses:
 *       200:
 *         description: All reviews retrieved successfully
 */
router.get('/admin/all', protect, authorize(ROLES.ADMIN), reviewController.getAllReviews);

/**
 * @swagger
 * /api/reviews/admin/{id}:
 *   get:
 *     summary: Lấy chi tiết review (Admin only) - tự động detect loại review
 *     tags: [Reviews]
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
 *         description: Review detail retrieved successfully
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Review not found
 */
router.get('/admin/:id', protect, authorize(ROLES.ADMIN), reviewController.getReviewDetail);

module.exports = router;
