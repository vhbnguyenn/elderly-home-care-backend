const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

// Import controllers
const {
  getMe,
  updateProfile: updateUserProfile,
  changePassword,
  getAllUsers,
  getUserById,
  toggleUserStatus,
  createUserByAdmin,
  deactivateOwnAccount,
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
 * /api/profiles/change-password:
 *   put:
 *     summary: Change password (for logged in users)
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
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: OldPassword123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect or validation failed
 *       401:
 *         description: Not authorized
 */
router.put('/change-password', protect, changePassword);

/**
 * @swagger
 * /api/profiles/deactivate:
 *   put:
 *     summary: Deactivate own account (Caregiver & Careseeker only)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated successfully
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
 *                   example: Your account has been deactivated successfully. Contact admin to reactivate.
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Account is already deactivated
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin accounts cannot be deactivated via this endpoint
 */
router.put('/deactivate', protect, authorize(ROLES.CAREGIVER, ROLES.CARESEEKER), deactivateOwnAccount);

/**
 * @swagger
 * /api/profiles/users:
 *   post:
 *     summary: Create user account (Admin only)
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
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: Password123
 *               role:
 *                 type: string
 *                 enum: [admin, caregiver, careseeker]
 *                 example: careseeker
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *     responses:
 *       201:
 *         description: User account created successfully
 *       400:
 *         description: Email already exists or validation failed
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, caregiver, careseeker]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
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
 *         description: Users retrieved successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 */
router.route('/users')
  .post(protect, authorize(ROLES.ADMIN), createUserByAdmin)
  .get(protect, authorize(ROLES.ADMIN), getAllUsers);

/**
 * @swagger
 * /api/profiles/users/{userId}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: User not found
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Admin access required
 */
router.get('/users/:userId', protect, authorize(ROLES.ADMIN), getUserById);

/**
 * @swagger
 * /api/profiles/users/{userId}/toggle-status:
 *   put:
 *     summary: Toggle user account status - block/activate (Admin only)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to toggle status
 *     responses:
 *       200:
 *         description: User status toggled successfully
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
 *                   example: User account blocked successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       403:
 *         description: Cannot block admin accounts
 *       404:
 *         description: User not found
 */
router.put('/users/:userId/toggle-status', protect, authorize(ROLES.ADMIN), toggleUserStatus);

module.exports = router;
