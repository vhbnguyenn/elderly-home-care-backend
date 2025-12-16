const express = require('express');
const router = express.Router();
const {
  getMyWallet,
  getTransactions,
  getWalletOverview,
  bulkWithdrawToBank
} = require('../controllers/walletController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Wallet:
 *       type: object
 *       properties:
 *         availableBalance:
 *           type: number
 *           description: Số dư khả dụng (sau khi trừ 15% phí)
 *         totalEarnings:
 *           type: number
 *           description: Tổng doanh thu (gross)
 *         totalPlatformFees:
 *           type: number
 *           description: Tổng phí nền tảng đã trừ
 *         pendingAmount:
 *           type: number
 *           description: Số tiền đang chờ xử lý (trong 24h)
 *         platformFeePercentage:
 *           type: number
 *           description: Phần trăm phí nền tảng (15%)
 */

/**
 * @swagger
 * /api/wallet/my-wallet:
 *   get:
 *     summary: Xem thông tin ví của caregiver
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
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
 *                     availableBalance:
 *                       type: number
 *                       example: 850000
 *                     totalEarnings:
 *                       type: number
 *                       example: 1000000
 *                     totalPlatformFees:
 *                       type: number
 *                       example: 150000
 *                     pendingAmount:
 *                       type: number
 *                       example: 500000
 *                     platformFeePercentage:
 *                       type: number
 *                       example: 15
 *       401:
 *         description: Unauthorized
 */
router.get('/my-wallet', protect, authorize(ROLES.CAREGIVER), getMyWallet);

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Lấy lịch sử giao dịch của caregiver
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [earning, platform_fee, refund]
 *         description: Lọc theo loại giao dịch
 *     responses:
 *       200:
 *         description: Success
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [earning, platform_fee, refund]
 *                           amount:
 *                             type: number
 *                           description:
 *                             type: string
 *                           status:
 *                             type: string
 *                           processedAt:
 *                             type: string
 *                             format: date-time
 *                           booking:
 *                             type: object
 *                     totalPages:
 *                       type: number
 *                     currentPage:
 *                       type: number
 *                     total:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/transactions', protect, authorize(ROLES.CAREGIVER), getTransactions);

/**
 * @swagger
 * /api/wallet/overview:
 *   get:
 *     summary: Xem tổng quan tất cả ví (Admin only)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/overview', protect, authorize(ROLES.ADMIN), getWalletOverview);

module.exports = router;
