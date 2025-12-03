const express = require('express');
const router = express.Router();
const {
  getCaregiverBookings,
  getCareseekerBookings,
  getBookingDetail,
  getAllBookings,
  updateBookingStatus,
  updateTaskStatus
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         careseeker:
 *           type: string
 *           description: ID của người tìm caregiver
 *         caregiver:
 *           type: string
 *           description: ID của caregiver
 *         startDate:
 *           type: string
 *           format: date
 *           description: Ngày bắt đầu
 *         endDate:
 *           type: string
 *           format: date
 *           description: Ngày kết thúc
 *         startTime:
 *           type: string
 *           description: Giờ bắt đầu (HH:mm)
 *         endTime:
 *           type: string
 *           description: Giờ kết thúc (HH:mm)
 *         serviceType:
 *           type: string
 *           enum: [chăm sóc cơ bản, chăm sóc y tế, hỗ trợ sinh hoạt, đồng hành]
 *         patientInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             age:
 *               type: number
 *             gender:
 *               type: string
 *               enum: [Nam, Nữ]
 *             address:
 *               type: string
 *             healthCondition:
 *               type: string
 *             specialRequirements:
 *               type: string
 *         totalPrice:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, confirmed, in-progress, completed, cancelled]
 *         notes:
 *           type: string
 */

/**
 * @swagger
 * /api/bookings/caregiver:
 *   get:
 *     summary: Lấy danh sách lịch hẹn của caregiver
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in-progress, completed, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/caregiver', protect, authorize(ROLES.CAREGIVER), getCaregiverBookings);

/**
 * @swagger
 * /api/bookings/careseeker:
 *   get:
 *     summary: Lấy danh sách lịch hẹn của careseeker
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in-progress, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/careseeker', protect, authorize(ROLES.CARESEEKER), getCareseekerBookings);

/**
 * @swagger
 * /api/bookings/all:
 *   get:
 *     summary: Lấy tất cả bookings (Admin only)
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
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
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/all', protect, authorize(ROLES.ADMIN), getAllBookings);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Lấy chi tiết lịch hẹn
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Booking not found
 *       403:
 *         description: Not authorized
 */
router.get('/:id', protect, getBookingDetail);

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái lịch hẹn
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, in-progress, completed, cancelled]
 *               cancellationReason:
 *                 type: string
 *                 description: Bắt buộc nếu status là cancelled
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Booking not found
 */
router.put('/:id/status', protect, updateBookingStatus);

/**
 * @swagger
 * /api/bookings/{id}/tasks/{taskId}:
 *   put:
 *     summary: Cập nhật trạng thái task trong booking (Caregiver only)
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isCompleted
 *             properties:
 *               isCompleted:
 *                 type: boolean
 *                 description: true = hoàn thành, false = chưa hoàn thành
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       403:
 *         description: Only assigned caregiver can update tasks
 *       404:
 *         description: Booking or task not found
 */
router.put('/:id/tasks/:taskId', protect, authorize(ROLES.CAREGIVER), updateTaskStatus);

module.exports = router;
