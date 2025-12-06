const express = require('express');
const router = express.Router();
const {
  findMatchingCaregivers,
  getQuickMatches,
  getRecommendations,
  getMatchingStats,
  testSemanticSimilarity,
  clearCache
} = require('../controllers/aiMatchingController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

/**
 * @swagger
 * tags:
 *   name: AI Matching
 *   description: AI-powered caregiver matching system
 */

/**
 * @swagger
 * /api/ai-matching/find-caregivers:
 *   post:
 *     summary: Find matching caregivers using AI
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requiredSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["tiêm insulin", "đo huyết áp"]
 *               preferredSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["chăm sóc vết thương", "vật lý trị liệu"]
 *               careLevel:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 3
 *                 example: 2
 *               timeSlots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *                     startTime:
 *                       type: string
 *                       pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *                     endTime:
 *                       type: string
 *                       pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *                 example: [{"day": "monday", "startTime": "08:00", "endTime": "12:00"}]
 *               budgetPerHour:
 *                 type: number
 *                 example: 150000
 *               minRating:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 5
 *                 example: 4.0
 *               minExperience:
 *                 type: number
 *                 example: 2
 *               genderPreference:
 *                 type: string
 *                 enum: [Nam, Nữ]
 *               ageRange:
 *                 type: array
 *                 items:
 *                   type: number
 *                 minItems: 2
 *                 maxItems: 2
 *                 example: [25, 50]
 *               topN:
 *                 type: number
 *                 example: 10
 *               useLearning:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Successfully found matching caregivers
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/find-caregivers',
  protect,
  authorize(ROLES.CARESEEKER),
  findMatchingCaregivers
);

/**
 * @swagger
 * /api/ai-matching/quick-match:
 *   get:
 *     summary: Get quick matches (top 5 caregivers)
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quick match results
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/quick-match',
  protect,
  authorize(ROLES.CARESEEKER),
  getQuickMatches
);

/**
 * @swagger
 * /api/ai-matching/recommendations:
 *   get:
 *     summary: Get personalized recommendations based on booking history
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recommendations
 *     responses:
 *       200:
 *         description: Personalized recommendations
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/recommendations',
  protect,
  authorize(ROLES.CARESEEKER),
  getRecommendations
);

/**
 * @swagger
 * /api/ai-matching/stats:
 *   get:
 *     summary: Get AI matching statistics (Admin only)
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Matching statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.get(
  '/stats',
  protect,
  authorize(ROLES.ADMIN),
  getMatchingStats
);

/**
 * @swagger
 * /api/ai-matching/test-similarity:
 *   post:
 *     summary: Test semantic similarity between two skills (Admin only)
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - skill1
 *               - skill2
 *             properties:
 *               skill1:
 *                 type: string
 *                 example: "tiêm insulin"
 *               skill2:
 *                 type: string
 *                 example: "tiêm thuốc"
 *     responses:
 *       200:
 *         description: Similarity score
 *       400:
 *         description: Missing parameters
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/test-similarity',
  protect,
  authorize(ROLES.ADMIN),
  testSemanticSimilarity
);

/**
 * @swagger
 * /api/ai-matching/cache:
 *   delete:
 *     summary: Clear similarity cache (Admin only)
 *     tags: [AI Matching]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/cache',
  protect,
  authorize(ROLES.ADMIN),
  clearCache
);

module.exports = router;
