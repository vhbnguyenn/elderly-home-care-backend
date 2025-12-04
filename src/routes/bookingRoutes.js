const express = require('express');
const router = express.Router();
const {
  getCaregiverBookings,
  getCareseekerBookings,
  getBookingDetail,
  getAllBookings,
  updateBookingStatus,
  updateTaskStatus,
  createBooking,
  checkInBooking,
  getCheckInInfo
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/auth');
const { uploadSingle } = require('../middlewares/upload');
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

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create new booking request
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caregiverId
 *               - packageId
 *               - elderlyProfileId
 *               - startDate
 *               - startTime
 *               - address
 *             properties:
 *               caregiverId:
 *                 type: string
 *                 description: ID of caregiver profile
 *               packageId:
 *                 type: string
 *                 description: ID of package in caregiver's packages array
 *               elderlyProfileId:
 *                 type: string
 *                 description: ID of elderly profile
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date (YYYY-MM-DD)
 *               startTime:
 *                 type: string
 *                 description: Start time (HH:mm), between 07:00 and 17:00
 *               address:
 *                 type: string
 *                 description: Service location address
 *               specialRequests:
 *                 type: string
 *                 description: Special requests or notes
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Caregiver or elderly profile not found
 */
router.post('/', protect, authorize(ROLES.CARESEEKER), createBooking);

/**
 * @swagger
 * /api/bookings/{id}/checkin:
 *   post:
 *     summary: Check-in bắt đầu ca làm việc (Caregiver)
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
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - verificationImage
 *             properties:
 *               verificationImage:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh xác nhận tại địa điểm (nhà/số nhà)
 *               actualStartTime:
 *                 type: string
 *                 description: Thời gian bắt đầu thực tế (HH:mm)
 *                 example: "10:20"
 *     responses:
 *       200:
 *         description: Check-in successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đã bắt đầu! Ca làm việc đã được ghi nhận. Người nhà đã nhận thông báo."
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     checkInTime:
 *                       type: string
 *                       format: date-time
 *                     actualStartTime:
 *                       type: string
 *                       example: "10:20"
 *                     verificationImage:
 *                       type: string
 *                       description: Cloudinary URL của ảnh xác nhận
 *                     earnings:
 *                       type: number
 *                       example: 400000
 *                     status:
 *                       type: string
 *                       example: "in-progress"
 *       400:
 *         description: Invalid request or already checked in
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.post('/:id/checkin', protect, authorize(ROLES.CAREGIVER), uploadSingle, checkInBooking);

/**
 * @swagger
 * /api/bookings/{id}/checkin:
 *   get:
 *     summary: Xem thông tin check-in của booking (Careseeker/Caregiver)
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
 *                     bookingId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "in-progress"
 *                     bookingDate:
 *                       type: string
 *                       format: date
 *                     bookingTime:
 *                       type: string
 *                       example: "10:00"
 *                     workLocation:
 *                       type: string
 *                     totalPrice:
 *                       type: number
 *                     caregiver:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     checkIn:
 *                       type: object
 *                       properties:
 *                         hasCheckedIn:
 *                           type: boolean
 *                           example: true
 *                         verificationImage:
 *                           type: string
 *                           description: Cloudinary URL của ảnh xác nhận
 *                         checkInTime:
 *                           type: string
 *                           format: date-time
 *                         actualStartTime:
 *                           type: string
 *                           example: "10:20"
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
router.get('/:id/checkin', protect, getCheckInInfo);

module.exports = router;
