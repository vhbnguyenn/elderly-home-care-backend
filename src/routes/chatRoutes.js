const express = require('express');
const router = express.Router();
const {
  createOrGetChat,
  getMyChats,
  getChatDetail,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount
} = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: Real-time chat management
 */

/**
 * @swagger
 * /api/chats:
 *   post:
 *     summary: Create or get conversation
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *             properties:
 *               participantId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Chat retrieved or created successfully
 *   get:
 *     summary: Get my chats
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chats retrieved successfully
 */
router.route('/')
  .post(protect, createOrGetChat)
  .get(protect, getMyChats);

/**
 * @swagger
 * /api/chats/unread-count:
 *   get:
 *     summary: Get total unread messages count
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 */
router.get('/unread-count', protect, getUnreadCount);

/**
 * @swagger
 * /api/chats/{chatId}:
 *   get:
 *     summary: Get chat detail
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat detail retrieved successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId', protect, getChatDetail);

/**
 * @swagger
 * /api/chats/{chatId}/messages:
 *   get:
 *     summary: Get messages
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *   post:
 *     summary: Send message
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Hello, how are you?"
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.route('/:chatId/messages')
  .get(protect, getMessages)
  .post(protect, sendMessage);

/**
 * @swagger
 * /api/chats/{chatId}/read:
 *   put:
 *     summary: Mark chat as read
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat marked as read
 */
router.put('/:chatId/read', protect, markAsRead);

module.exports = router;
