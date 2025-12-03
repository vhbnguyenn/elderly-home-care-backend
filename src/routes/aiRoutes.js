const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * /api/ai/chatbot:
 *   post:
 *     summary: Chat with AI assistant
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
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
 *               conversationHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: AI response
 */
router.post('/chatbot', protect, aiController.chatbot);

/**
 * @swagger
 * /api/ai/recommend-caregiver:
 *   post:
 *     summary: Get AI caregiver recommendations
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - elderlyProfile
 *             properties:
 *               elderlyProfile:
 *                 type: object
 *     responses:
 *       200:
 *         description: Caregiver recommendations
 */
router.post('/recommend-caregiver', protect, aiController.recommendCaregiver);

/**
 * @swagger
 * /api/ai/generate-careplan:
 *   post:
 *     summary: Generate personalized care plan
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - elderlyProfile
 *             properties:
 *               elderlyProfile:
 *                 type: object
 *     responses:
 *       200:
 *         description: Generated care plan
 */
router.post('/generate-careplan', protect, aiController.generateCareplan);

/**
 * @swagger
 * /api/ai/analyze-health:
 *   post:
 *     summary: Analyze health concerns
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symptoms
 *             properties:
 *               symptoms:
 *                 type: string
 *     responses:
 *       200:
 *         description: Health analysis
 */
router.post('/analyze-health', protect, aiController.analyzeHealthConcerns);

module.exports = router;
