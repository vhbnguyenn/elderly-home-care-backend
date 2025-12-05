const express = require('express');
const router = express.Router();
const {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  togglePackageStatus
} = require('../controllers/packageController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * tags:
 *   name: Packages
 *   description: Package management
 */

/**
 * @swagger
 * /api/packages:
 *   get:
 *     summary: Get all packages (Public)
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: packageType
 *         schema:
 *           type: string
 *           enum: [basic, professional, premium]
 *       - in: query
 *         name: caregiverId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of packages
 *   post:
 *     summary: Create new package (Admin only)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageName
 *               - description
 *               - price
 *               - packageType
 *               - duration
 *               - paymentCycle
 *             properties:
 *               packageName:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               packageType:
 *                 type: string
 *                 enum: [basic, professional, premium]
 *               duration:
 *                 type: number
 *               paymentCycle:
 *                 type: string
 *                 enum: [hourly, daily, monthly, shift]
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               customServices:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *               isPopular:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Package created successfully
 */
router.route('/')
  .get(getAllPackages) // Public
  .post(protect, authorize(ROLES.ADMIN), createPackage); // Admin only

/**
 * @swagger
 * /api/packages/{id}:
 *   get:
 *     summary: Get package by ID (Public)
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Package details
 *   put:
 *     summary: Update package (Admin only)
 *     tags: [Packages]
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
 *     responses:
 *       200:
 *         description: Package updated successfully
 */
router.route('/:id')
  .get(getPackageById) // Public
  .put(protect, authorize(ROLES.ADMIN), updatePackage); // Admin only

/**
 * @swagger
 * /api/packages/{id}/toggle:
 *   put:
 *     summary: Toggle package active/block status (Admin only)
 *     tags: [Packages]
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
 *         description: Package status toggled successfully (activated or blocked)
 */
router.put('/:id/toggle', protect, authorize(ROLES.ADMIN), togglePackageStatus);

module.exports = router;
