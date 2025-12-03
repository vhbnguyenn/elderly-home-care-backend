const express = require('express');
const router = express.Router();
const {
  createElderlyProfile,
  getMyElderlyProfiles,
  getElderlyProfileById,
  updateElderlyProfile,
  deleteElderlyProfile,
  getCareseekerProfiles,
} = require('../controllers/elderlyController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * /api/elderly:
 *   post:
 *     summary: Tạo hồ sơ người già
 *     tags: [Elderly]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - age
 *               - gender
 *               - address
 *             properties:
 *               fullName:
 *                 type: string
 *               age:
 *                 type: number
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ]
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               bloodType:
 *                 type: string
 *               medicalConditions:
 *                 type: array
 *                 items:
 *                   type: string
 *               allergies:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile created
 */
router.post('/', protect, authorize(ROLES.CARESEEKER), createElderlyProfile);

/**
 * @swagger
 * /api/elderly:
 *   get:
 *     summary: Lấy danh sách hồ sơ người già của careseeker
 *     tags: [Elderly]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', protect, authorize(ROLES.CARESEEKER), getMyElderlyProfiles);

/**
 * @swagger
 * /api/elderly/{id}:
 *   get:
 *     summary: Lấy chi tiết hồ sơ người già
 *     tags: [Elderly]
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
 *         description: Success
 *       404:
 *         description: Profile not found
 */
router.get('/:id', protect, getElderlyProfileById);

/**
 * @swagger
 * /api/elderly/{id}:
 *   put:
 *     summary: Cập nhật hồ sơ người già
 *     tags: [Elderly]
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
 *         description: Updated
 */
router.put('/:id', protect, authorize(ROLES.CARESEEKER), updateElderlyProfile);

/**
 * @swagger
 * /api/elderly/{id}:
 *   delete:
 *     summary: Xóa hồ sơ người già
 *     tags: [Elderly]
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
 *         description: Deleted
 */
router.delete('/:id', protect, authorize(ROLES.CARESEEKER), deleteElderlyProfile);

/**
 * @swagger
 * /api/profiles/care-seeker:
 *   get:
 *     summary: Get care seeker's elderly profiles (for booking)
 *     tags: [Elderly]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of elderly profiles
 */
router.get('/profiles/care-seeker', protect, authorize(ROLES.CARESEEKER), getCareseekerProfiles);

module.exports = router;
