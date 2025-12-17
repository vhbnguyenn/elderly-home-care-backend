const express = require('express');
const router = express.Router();
const {
  addOrUpdateBankAccount,
  getBankAccount,
  withdrawToBank,
  getWithdrawalHistory,
  getAvailableBalance,
  checkWithdrawalStatus
} = require('../controllers/adminWithdrawalController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * tags:
 *   name: Admin Withdrawal
 *   description: Quản lý rút tiền của admin qua PayOS
 */

/**
 * @swagger
 * /api/admin-withdrawal/bank-account:
 *   post:
 *     summary: Thêm/Cập nhật tài khoản ngân hàng admin
 *     tags: [Admin Withdrawal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankName
 *               - bankCode
 *               - accountNumber
 *               - accountName
 *             properties:
 *               bankName:
 *                 type: string
 *                 example: Vietcombank
 *               bankCode:
 *                 type: string
 *                 example: VCB
 *                 description: Mã ngân hàng (VCB, TCB, MB, ACB...)
 *               accountNumber:
 *                 type: string
 *                 example: 1234567890
 *               accountName:
 *                 type: string
 *                 example: NGUYEN VAN A
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/bank-account', protect, authorize(ROLES.ADMIN), addOrUpdateBankAccount);

/**
 * @swagger
 * /api/admin-withdrawal/bank-account:
 *   get:
 *     summary: Lấy thông tin tài khoản ngân hàng admin
 *     tags: [Admin Withdrawal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/bank-account', protect, authorize(ROLES.ADMIN), getBankAccount);

/**
 * @swagger
 * /api/admin-withdrawal/available-balance:
 *   get:
 *     summary: Xem số dư có thể rút (từ platform fees)
 *     tags: [Admin Withdrawal]
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
 *                       description: Số dư khả dụng để rút
 *                     totalPlatformFees:
 *                       type: number
 *                       description: Tổng phí nền tảng 15% đã thu
 *                     totalWithdrawn:
 *                       type: number
 *                       description: Tổng đã rút
 *                     totalCaregiverBalance:
 *                       type: number
 *                       description: Tổng số dư của caregivers
 *                     totalPending:
 *                       type: number
 *                       description: Tổng số tiền đang chờ xử lý (24h)
 *       401:
 *         description: Unauthorized
 */
router.get('/available-balance', protect, authorize(ROLES.ADMIN), getAvailableBalance);

/**
 * @swagger
 * /api/admin-withdrawal/withdraw:
 *   post:
 *     summary: Rút tiền về tài khoản ngân hàng qua PayOS
 *     tags: [Admin Withdrawal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Số tiền muốn rút (VND)
 *                 minimum: 10000
 *                 example: 5000000
 *               note:
 *                 type: string
 *                 description: Ghi chú
 *                 example: Rút lương tháng 12
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
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     withdrawalId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                     payosOrderCode:
 *                       type: string
 *                     paymentUrl:
 *                       type: string
 *                       description: URL để xác nhận thanh toán (nếu cần)
 *                     bankAccount:
 *                       type: object
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or insufficient balance
 *       401:
 *         description: Unauthorized
 */
router.post('/withdraw', protect, authorize(ROLES.ADMIN), withdrawToBank);

/**
 * @swagger
 * /api/admin-withdrawal/history:
 *   get:
 *     summary: Lấy lịch sử rút tiền
 *     tags: [Admin Withdrawal]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/history', protect, authorize(ROLES.ADMIN), getWithdrawalHistory);

/**
 * @swagger
 * /api/admin-withdrawal/status/{orderCode}:
 *   get:
 *     summary: Kiểm tra trạng thái giao dịch
 *     tags: [Admin Withdrawal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: PayOS order code
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Transaction not found
 *       401:
 *         description: Unauthorized
 */
router.get('/status/:orderCode', protect, authorize(ROLES.ADMIN), checkWithdrawalStatus);

module.exports = router;
