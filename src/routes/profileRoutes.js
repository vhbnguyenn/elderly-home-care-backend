const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');
const { uploadCaregiverProfile } = require('../middlewares/upload');

// Import controllers
const {
  createProfile: createCaregiverProfile,
  getMyProfile: getMyCaregiverProfile,
  updateProfile: updateCaregiverProfile,
} = require('../controllers/caregiverController');

const {
  createElderlyProfile,
  getMyElderlyProfiles,
  getElderlyProfileById,
  updateElderlyProfile,
  deleteElderlyProfile,
} = require('../controllers/elderlyController');

const {
  getMe,
  updateProfile: updateUserProfile,
} = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Profiles
 *   description: Unified profile management for all user types
 */

/**
 * @swagger
 * /api/profiles/user:
 *   get:
 *     summary: Get current user profile (All roles)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *   put:
 *     summary: Update user profile (Careseeker & Admin only)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.route('/user')
  .get(protect, getMe)
  .put(protect, authorize(ROLES.CARESEEKER, ROLES.ADMIN), updateUserProfile);

/**
 * @swagger
 * /api/profiles/caregiver:
 *   post:
 *     summary: Create caregiver profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Caregiver profile created successfully
 *   get:
 *     summary: Get my caregiver profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *   put:
 *     summary: Update caregiver profile
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.route('/caregiver')
  .post(protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfile, createCaregiverProfile)
  .get(protect, authorize(ROLES.CAREGIVER), getMyCaregiverProfile)
  .put(protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfile, updateCaregiverProfile);

/**
 * @swagger
 * /api/profiles/elderly:
 *   post:
 *     summary: Create elderly profile
 *     tags: [Profiles]
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
 *     responses:
 *       201:
 *         description: Elderly profile created successfully
 *   get:
 *     summary: Get my elderly profiles
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profiles retrieved successfully
 */
router.route('/elderly')
  .post(protect, authorize(ROLES.CARESEEKER), createElderlyProfile)
  .get(protect, authorize(ROLES.CARESEEKER), getMyElderlyProfiles);

/**
 * @swagger
 * /api/profiles/elderly/{id}:
 *   get:
 *     summary: Get elderly profile by ID
 *     tags: [Profiles]
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
 *         description: Profile retrieved successfully
 *   put:
 *     summary: Update elderly profile
 *     tags: [Profiles]
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
 *         description: Profile updated successfully
 *   delete:
 *     summary: Delete elderly profile
 *     tags: [Profiles]
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
 *         description: Profile deleted successfully
 */
router.route('/elderly/:id')
  .get(protect, getElderlyProfileById)
  .put(protect, authorize(ROLES.CARESEEKER), updateElderlyProfile)
  .delete(protect, authorize(ROLES.CARESEEKER), deleteElderlyProfile);

module.exports = router;
