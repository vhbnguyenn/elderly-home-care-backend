const express = require('express');
const router = express.Router();
const {
  createDeposit,
  depositCallback,
  createBookingPaymentLink,
  bookingPaymentCallback,
  getCaregiverBankAccount,
  updateCaregiverBankAccount,
  caregiverWithdraw,
  getPaymentStatus
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Quản lý thanh toán qua PayOS (Deposit, Booking, Withdrawal)
 */

// ============ CARESEEKER: NẠP TIỀN ============

/**
 * @swagger
 * /api/payments/deposit:
 *   post:
 *     summary: Tạo link thanh toán để nạp tiền vào ví (Careseeker)
 *     tags: [Payments]
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
 *                 minimum: 10000
 *                 maximum: 50000000
 *                 example: 500000
 *                 description: Số tiền muốn nạp (VND)
 *     responses:
 *       200:
 *         description: Success - Link thanh toán đã được tạo
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
 *                     orderCode:
 *                       type: string
 *                     paymentUrl:
 *                       type: string
 *                     qrCode:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     expiresIn:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/deposit', protect, authorize(ROLES.CARESEEKER), createDeposit);

/**
 * @swagger
 * /api/payments/deposit/callback:
 *   post:
 *     summary: Webhook callback từ PayOS sau khi nạp tiền
 *     tags: [Payments]
 *     description: Endpoint này được gọi tự động bởi PayOS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderCode:
 *                 type: string
 *               status:
 *                 type: string
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Callback processed
 */
router.post('/deposit/callback', depositCallback);

// ============ BOOKING: THANH TOÁN ============

/**
 * @swagger
 * /api/payments/booking/{bookingId}:
 *   post:
 *     summary: Tạo link thanh toán cho booking
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Success - Link thanh toán đã được tạo
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
 *                     bookingId:
 *                       type: string
 *                     orderCode:
 *                       type: string
 *                     paymentUrl:
 *                       type: string
 *                     qrCode:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     expiresIn:
 *                       type: string
 *       400:
 *         description: Booking đã được thanh toán
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/booking/:bookingId', protect, authorize(ROLES.CARESEEKER), createBookingPaymentLink);

/**
 * @swagger
 * /api/payments/booking/callback:
 *   post:
 *     summary: Webhook callback từ PayOS sau khi thanh toán booking
 *     tags: [Payments]
 *     description: Endpoint này được gọi tự động bởi PayOS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderCode:
 *                 type: string
 *               status:
 *                 type: string
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Callback processed
 */
router.post('/booking/callback', bookingPaymentCallback);

// ============ CAREGIVER: RÚT TIỀN ============

/**
 * @swagger
 * /api/payments/caregiver/bank-account:
 *   get:
 *     summary: Lấy thông tin tài khoản ngân hàng caregiver
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Caregiver profile not found
 */
router.get('/caregiver/bank-account', protect, authorize(ROLES.CAREGIVER), getCaregiverBankAccount);

/**
 * @swagger
 * /api/payments/caregiver/bank-account:
 *   put:
 *     summary: Cập nhật thông tin tài khoản ngân hàng caregiver
 *     tags: [Payments]
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
 *       404:
 *         description: Caregiver profile not found
 */
router.put('/caregiver/bank-account', protect, authorize(ROLES.CAREGIVER), updateCaregiverBankAccount);

/**
 * @swagger
 * /api/payments/caregiver/withdraw:
 *   post:
 *     summary: Caregiver rút tiền về ngân hàng qua PayOS
 *     tags: [Payments]
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
 *                 minimum: 50000
 *                 example: 1000000
 *                 description: Số tiền muốn rút (VND)
 *               note:
 *                 type: string
 *                 example: Rút lương tháng 1
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
 *                     bankAccount:
 *                       type: object
 *                     processedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or insufficient balance
 *       404:
 *         description: Bank account not found
 */
router.post('/caregiver/withdraw', protect, authorize(ROLES.CAREGIVER), caregiverWithdraw);

// ============ KIỂM TRA TRẠNG THÁI ============

/**
 * @swagger
 * /api/payments/status/{orderCode}:
 *   get:
 *     summary: Kiểm tra trạng thái transaction từ PayOS
 *     tags: [Payments]
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
 *       500:
 *         description: Cannot check status
 */
router.get('/status/:orderCode', protect, getPaymentStatus);

module.exports = router;
