/**
 * GROQ MATCHING ROUTES
 * ====================
 * 
 * API routes for Groq AI-based caregiver matching
 */

const express = require('express');
const router = express.Router();
const groqMatchingController = require('../controllers/groqMatchingController');
const { protect, authorize } = require('../middlewares/auth');

/**
 * @swagger
 * /api/groq-matching/test:
 *   get:
 *     summary: Test Groq API connection
 *     description: Test if Groq API is working correctly (no authentication required)
 *     tags: [Groq AI Matching]
 *     responses:
 *       200:
 *         description: Groq API is working
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
 *       500:
 *         description: Groq API error
 */
router.get(
  '/test',
  groqMatchingController.testGroqConnection
);

/**
 * @swagger
 * /api/groq-matching/find-caregivers:
 *   post:
 *     summary: Find matching caregivers using Groq AI
 *     description: Get top 5 caregiver matches using Groq LLaMA AI model
 *     tags: [Groq AI Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: Package ID
 *                 example: "673c2f449b6ce5c5eb9c2a68"
 *               preferences:
 *                 type: object
 *                 description: User preferences (optional)
 *                 properties:
 *                   gender:
 *                     type: string
 *                   experienceYears:
 *                     type: number
 *               maxResults:
 *                 type: number
 *                 default: 5
 *                 description: Maximum number of results
 *     responses:
 *       200:
 *         description: Matching caregivers found
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
 *                     matches:
 *                       type: array
 *                       items:
 *                         type: object
 *                     packageInfo:
 *                       type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Package not found
 */
router.post(
  '/find-caregivers',
  protect,
  authorize('careseeker'),
  groqMatchingController.findMatchingCaregivers
);

/**
 * @swagger
 * /api/groq-matching/compare:
 *   post:
 *     summary: Compare Groq AI vs Rule-based matching
 *     description: Compare results from Groq AI and traditional rule-based algorithm
 *     tags: [Groq AI Matching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: Package ID
 *                 example: "673c2f449b6ce5c5eb9c2a68"
 *     responses:
 *       200:
 *         description: Comparison complete
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
 *                     groq:
 *                       type: object
 *                       description: Groq AI results
 *                     ruleBased:
 *                       type: object
 *                       description: Rule-based results
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/compare',
  protect,
  authorize('careseeker'),
  groqMatchingController.compareMatching
);

module.exports = router;

