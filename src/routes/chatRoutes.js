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
 * /api/chats/{chatId}/messages:
 *   get:
 *     summary: Get messages
 *     description: |
 *       Lấy danh sách tin nhắn trong conversation (có pagination).
 *       Khác với GET /api/chats/{chatId} - API này chỉ trả về thông tin conversation.
 *       API này trả về danh sách messages với pagination, filter tin nhắn đã xóa.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của conversation
 *       - in: query
 *         name: page
 *         description: Số trang (mặc định 1)
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         description: Số tin nhắn mỗi trang (mặc định 50)
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       sender:
 *                         type: object
 *                       content:
 *                         type: string
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
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

/**
 * @swagger
 * /api/chats/{chatId}:
 *   get:
 *     summary: Get chat detail
 *     description: |
 *       Lấy thông tin chi tiết của conversation (KHÔNG bao gồm messages).
 *       Trả về: participants, unreadCount, createdAt, updatedAt.
 *       Để lấy danh sách tin nhắn, dùng API GET /api/chats/{chatId}/messages
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của conversation
 *     responses:
 *       200:
 *         description: Chat detail retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                     unreadCount:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId', protect, getChatDetail);

module.exports = router;
