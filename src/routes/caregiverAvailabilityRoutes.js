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
 * /api/caregiver-availability/calendar:
 *   get:
 *     summary: Xem calendar của chính mình (Caregiver only)
 *     description: Caregiver xem calendar của mình (booking + lịch rảnh)
 *     tags: [Caregiver Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       403:
 *         description: Forbidden
 */
router.get('/calendar', protect, authorize(ROLES.CAREGIVER), caregiverAvailabilityController.getCalendar);


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
