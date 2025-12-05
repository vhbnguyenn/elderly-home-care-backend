const express = require('express');
const router = express.Router();
const caregiverAvailabilityController = require('../controllers/caregiverAvailabilityController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     CaregiverAvailability:
 *       type: object
 *       required:
 *         - startDate
 *       properties:
 *         recurrenceType:
 *           type: string
 *           enum: [weekly, daily, once]
 *           default: weekly
 *         daysOfWeek:
 *           type: array
 *           items:
 *             type: string
 *             enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *           example: ["monday", "wednesday", "friday"]
 *         timeSlots:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 example: "12:00"
 *         isAllDay:
 *           type: boolean
 *           default: false
 *         isHalfDay:
 *           type: boolean
 *           default: false
 *         startDate:
 *           type: string
 *           format: date
 *           example: "2025-12-05"
 *         endDate:
 *           type: string
 *           format: date
 *           example: "2026-12-05"
 *         notes:
 *           type: string
 *           maxLength: 500
 */

/**
 * @swagger
 * /api/caregiver-availability:
 *   post:
 *     summary: Tạo lịch rảnh (Caregiver only)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CaregiverAvailability'
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.createAvailability);

/**
 * @swagger
 * /api/caregiver-availability/my-schedules:
 *   get:
 *     summary: Lấy danh sách lịch rảnh của tôi (Caregiver)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
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
 *         description: Schedules retrieved successfully
 */
router.get('/my-schedules', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.getMySchedules);

/**
 * @swagger
 * /api/caregiver-availability/my-schedule-by-date:
 *   get:
 *     summary: Lấy lịch rảnh của ngày cụ thể (để hiển thị trong UI calendar)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-12-05"
 *     responses:
 *       200:
 *         description: Schedule for specific date retrieved
 *       400:
 *         description: Date is required
 */
router.get('/my-schedule-by-date', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.getMyScheduleByDate);

/**
 * @swagger
 * /api/caregiver-availability/caregiver/{caregiverId}:
 *   get:
 *     summary: Xem lịch rảnh của caregiver (cho careseeker)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Caregiver schedule retrieved successfully
 *       404:
 *         description: Caregiver not found
 */
router.get('/caregiver/:caregiverId', protect, caregiverAvailabilityController.getCaregiverSchedule);

/**
 * @swagger
 * /api/caregiver-availability/check-availability:
 *   post:
 *     summary: Kiểm tra caregiver có rảnh vào thời gian cụ thể không
 *     tags: [Caregiver Availability]
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
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               caregiverId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-10"
 *               startTime:
 *                 type: string
 *                 example: "09:00"
 *               endTime:
 *                 type: string
 *                 example: "11:00"
 *     responses:
 *       200:
 *         description: Availability check result
 *       400:
 *         description: Missing required fields
 */
router.post('/check-availability', protect, caregiverAvailabilityController.checkAvailability);

/**
 * @swagger
 * /api/caregiver-availability/calendar/{caregiverId}:
 *   get:
 *     summary: Xem calendar tổng hợp (availability + bookings) của caregiver
 *     description: Caregiver xem calendar của mình, Careseeker xem để biết lịch rảnh và đã book
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-12-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-12-31"
 *     responses:
 *       200:
 *         description: Calendar with availability and bookings retrieved
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
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [availability, booking]
 *                           date:
 *                             type: string
 *                           startTime:
 *                             type: string
 *                           endTime:
 *                             type: string
 *                           status:
 *                             type: string
 *       403:
 *         description: Forbidden - not caregiver owner or careseeker
 *       404:
 *         description: Caregiver not found
 */
router.get('/calendar/:caregiverId', protect, caregiverAvailabilityController.getCalendar);

/**
 * @swagger
 * /api/caregiver-availability/{id}:
 *   get:
 *     summary: Lấy chi tiết lịch rảnh
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability detail retrieved
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id', protect, caregiverAvailabilityController.getAvailabilityById);

/**
 * @swagger
 * /api/caregiver-availability/{id}:
 *   put:
 *     summary: Cập nhật lịch rảnh (Caregiver owner only)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CaregiverAvailability'
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Schedule not found
 */
router.put('/:id', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.updateAvailability);

/**
 * @swagger
 * /api/caregiver-availability/{id}:
 *   delete:
 *     summary: Xóa lịch rảnh (Caregiver owner only)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *       403:
 *         description: Forbidden - not the owner
 *       404:
 *         description: Schedule not found
 */
router.delete('/:id', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.deleteAvailability);

/**
 * @swagger
 * /api/caregiver-availability/{id}/exceptions:
 *   post:
 *     summary: Thêm ngày nghỉ đột xuất (Caregiver owner only)
 *     tags: [Caregiver Availability]
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
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-25"
 *               reason:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Nghỉ lễ"
 *     responses:
 *       200:
 *         description: Exception added successfully
 *       400:
 *         description: Exception already exists or validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Schedule not found
 */
router.post('/:id/exceptions', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.addException);

/**
 * @swagger
 * /api/caregiver-availability/{id}/exceptions/{exceptionId}:
 *   delete:
 *     summary: Xóa ngày nghỉ đột xuất (Caregiver owner only)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: exceptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exception removed successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Schedule not found
 */
router.delete('/:id/exceptions/:exceptionId', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.removeException);

/**
 * @swagger
 * /api/caregiver-availability/admin/all:
 *   get:
 *     summary: Lấy tất cả lịch rảnh (Admin only)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: caregiverId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: All schedules retrieved successfully
 */
router.get('/admin/all', protect, authorize(ROLES.ADMIN), caregiverAvailabilityController.getAllSchedules);

module.exports = router;
