const express = require('express');
const router = express.Router();
const {
  getUsersByRole,
  getUserRegistrations,
  getDashboardOverview,
  getBookingStatistics,
  getBookingOverview
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: API thống kê cho admin dashboard
 */

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Lấy tổng quan thống kê dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê tổng quan thành công
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
 *                     totalUsers:
 *                       type: number
 *                     caregivers:
 *                       type: number
 *                     careseekers:
 *                       type: number
 *                     admins:
 *                       type: number
 *                     recentRegistrations:
 *                       type: object
 *                       properties:
 *                         last30Days:
 *                           type: number
 *                         today:
 *                           type: number
 */
router.get('/overview', protect, authorize(ROLES.ADMIN), getDashboardOverview);

/**
 * @swagger
 * /api/dashboard/users/by-role:
 *   get:
 *     summary: Lấy số lượng người dùng theo vai trò (cho pie/donut chart)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê thành công
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
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           label:
 *                             type: string
 *                           count:
 *                             type: number
 *                           percentage:
 *                             type: string
 *                     total:
 *                       type: number
 */
router.get('/users/by-role', protect, authorize(ROLES.ADMIN), getUsersByRole);

/**
 * @swagger
 * /api/dashboard/users/registrations:
 *   get:
 *     summary: Lấy thống kê đăng ký người dùng theo thời gian (cho line chart)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Khoảng thời gian thống kê
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [all, caregiver, careseeker]
 *           default: all
 *         description: Vai trò người dùng
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu (ISO string)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc (ISO string)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 30
 *         description: Số lượng điểm dữ liệu
 *     responses:
 *       200:
 *         description: Thống kê thành công
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
 *                     period:
 *                       type: string
 *                     role:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     registrations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           caregiver:
 *                             type: number
 *                           careseeker:
 *                             type: number
 *                           total:
 *                             type: number
 */
router.get('/users/registrations', protect, authorize(ROLES.ADMIN), getUserRegistrations);

/**
 * @swagger
 * /api/dashboard/bookings/overview:
 *   get:
 *     summary: Lấy tổng quan thống kê booking
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê tổng quan booking thành công
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
 *                     totalBookings:
 *                       type: number
 *                     pending:
 *                       type: number
 *                     confirmed:
 *                       type: number
 *                     inProgress:
 *                       type: number
 *                     completed:
 *                       type: number
 *                     cancelled:
 *                       type: number
 *                     totalRevenue:
 *                       type: number
 *                     completedRevenue:
 *                       type: number
 *                     recentBookings:
 *                       type: object
 *                       properties:
 *                         last30Days:
 *                           type: number
 *                         today:
 *                           type: number
 *                     avgBookingValue:
 *                       type: number
 *                     completionRate:
 *                       type: number
 */
router.get('/bookings/overview', protect, authorize(ROLES.ADMIN), getBookingOverview);

/**
 * @swagger
 * /api/dashboard/bookings/statistics:
 *   get:
 *     summary: Lấy thống kê booking theo thời gian (cho line chart)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Khoảng thời gian thống kê
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, confirmed, in-progress, completed, cancelled]
 *           default: all
 *         description: Trạng thái booking
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu (ISO string)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc (ISO string)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 30
 *         description: Số lượng điểm dữ liệu
 *     responses:
 *       200:
 *         description: Thống kê booking thành công
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
 *                     period:
 *                       type: string
 *                     status:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     bookings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           pending:
 *                             type: number
 *                           confirmed:
 *                             type: number
 *                           in-progress:
 *                             type: number
 *                           completed:
 *                             type: number
 *                           cancelled:
 *                             type: number
 *                           total:
 *                             type: number
 *                           totalRevenue:
 *                             type: number
 */
router.get('/bookings/statistics', protect, authorize(ROLES.ADMIN), getBookingStatistics);

module.exports = router;
