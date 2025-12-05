const express = require('express');
const router = express.Router();
const {
  generatePaymentQR,
  confirmPayment,
  handleVNPayCallback,
  getPaymentInfo
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *         method:
 *           type: string
 *           enum: [vnpay, momo, bank_transfer, cash]
 *         transactionId:
 *           type: string
 *         paidAt:
 *           type: string
 *           format: date-time
 *         qrCode:
 *           type: string
 *           description: URL của QR code
 *         bankInfo:
 *           type: object
 *           properties:
 *             bankName:
 *               type: string
 *             accountNumber:
 *               type: string
 *             accountName:
 *               type: string
 */

/**
 * @swagger
 * /api/payments/generate-qr/{bookingId}:
 *   post:
 *     summary: Generate QR code thanh toán sau khi hoàn thành booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [vietqr, momo, vnpay, bank_transfer]
 *                 description: Phương thức thanh toán
 *     responses:
 *       200:
 *         description: QR code generated successfully
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
 *                     amount:
 *                       type: number
 *                     paymentMethod:
 *                       type: string
 *                     qrCodeUrl:
 *                       type: string
 *                     bankInfo:
 *                       type: object
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/generate-qr/:bookingId', protect, authorize(ROLES.CARESEEKER, ROLES.CAREGIVER, ROLES.ADMIN), generatePaymentQR);

/**
 * @swagger
 * /api/payments/confirm/{bookingId}:
 *   post:
 *     summary: Xác nhận thanh toán thủ công (sau khi careseeker chuyển khoản)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
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
 *               - transactionId
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Mã giao dịch từ ngân hàng/ví
 *               paymentMethod:
 *                 type: string
 *                 enum: [vnpay, momo, bank_transfer, cash]
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/confirm/:bookingId', protect, authorize(ROLES.CARESEEKER, ROLES.CAREGIVER, ROLES.ADMIN), confirmPayment);

/**
 * @swagger
 * /api/payments/{bookingId}:
 *   get:
 *     summary: Lấy thông tin thanh toán của booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.get('/:bookingId', protect, getPaymentInfo);

/**
 * @swagger
 * /api/payments/vnpay/callback:
 *   get:
 *     summary: Callback từ VNPay (webhook)
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to success/failed page
 */
router.get('/vnpay/callback', handleVNPayCallback);

module.exports = router;
