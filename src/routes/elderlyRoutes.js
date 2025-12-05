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
 *                 example: "Nguyễn Văn A"
 *               age:
 *                 type: number
 *                 example: 75
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ]
 *                 example: "Nam"
 *               address:
 *                 type: string
 *                 example: "123 Nguyễn Huệ, Q1, TPHCM"
 *               phone:
 *                 type: string
 *                 example: "0123456789"
 *               bloodType:
 *                 type: string
 *                 enum: [A, B, AB, O, Không rõ]
 *                 example: "A"
 *               medicalConditions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Tiểu đường", "Cao huyết áp"]
 *               medications:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Metformin"
 *                     dosage:
 *                       type: string
 *                       example: "500mg"
 *                     frequency:
 *                       type: string
 *                       example: "2 lần/ngày"
 *                     allergies:
 *                       type: string
 *                       example: "Không"
 *               allergies:
 *                 type: string
 *                 example: "Dị ứng hải sản"
 *               selfCareActivities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     activity:
 *                       type: string
 *                       enum: [Ăn uống, Tắm rửa, Di chuyển, Mặc đồ]
 *                       example: "Ăn uống"
 *                     needHelp:
 *                       type: boolean
 *                       example: false
 *               livingEnvironment:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Căn hộ chung cư, Nhà riêng, Viện dưỡng lão, Khác]
 *                     example: "Nhà riêng"
 *                   hasFamily:
 *                     type: boolean
 *                     example: true
 *                   familyNote:
 *                     type: string
 *                     example: "Sống cùng con trai"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   hobbies:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Đọc sách", "Nghe nhạc"]
 *                   favoriteFoods:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Cháo", "Phở"]
 *                   dietaryRestrictions:
 *                     type: string
 *                     example: "Ăn ít muối, ít đường"
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Nguyễn Văn B"
 *                   relationship:
 *                     type: string
 *                     example: "Con trai"
 *                   phone:
 *                     type: string
 *                     example: "0987654321"
 *               specialNotes:
 *                 type: string
 *                 example: "Cần hỗ trợ di chuyển lên xuống cầu thang"
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                       age:
 *                         type: number
 *                       gender:
 *                         type: string
 *                       address:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       bloodType:
 *                         type: string
 *                       medicalConditions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       medications:
 *                         type: array
 *                         items:
 *                           type: object
 *                       selfCareActivities:
 *                         type: array
 *                         items:
 *                           type: object
 *                       livingEnvironment:
 *                         type: object
 *                       preferences:
 *                         type: object
 *                       emergencyContact:
 *                         type: object
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
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     age:
 *                       type: number
 *                     gender:
 *                       type: string
 *                     address:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     bloodType:
 *                       type: string
 *                     medicalConditions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     medications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           dosage:
 *                             type: string
 *                           frequency:
 *                             type: string
 *                           allergies:
 *                             type: string
 *                     allergies:
 *                       type: string
 *                     selfCareActivities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           activity:
 *                             type: string
 *                           needHelp:
 *                             type: boolean
 *                     livingEnvironment:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         hasFamily:
 *                           type: boolean
 *                         familyNote:
 *                           type: string
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         hobbies:
 *                           type: array
 *                           items:
 *                             type: string
 *                         favoriteFoods:
 *                           type: array
 *                           items:
 *                             type: string
 *                         dietaryRestrictions:
 *                           type: string
 *                     emergencyContact:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         relationship:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     specialNotes:
 *                       type: string
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
 *                 enum: [A, B, AB, O, Không rõ]
 *               medicalConditions:
 *                 type: array
 *                 items:
 *                   type: string
 *               medications:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     dosage:
 *                       type: string
 *                     frequency:
 *                       type: string
 *                     allergies:
 *                       type: string
 *               allergies:
 *                 type: string
 *               selfCareActivities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     activity:
 *                       type: string
 *                       enum: [Ăn uống, Tắm rửa, Di chuyển, Mặc đồ]
 *                     needHelp:
 *                       type: boolean
 *               livingEnvironment:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Căn hộ chung cư, Nhà riêng, Viện dưỡng lão, Khác]
 *                   hasFamily:
 *                     type: boolean
 *                   familyNote:
 *                     type: string
 *               preferences:
 *                 type: object
 *                 properties:
 *                   hobbies:
 *                     type: array
 *                     items:
 *                       type: string
 *                   favoriteFoods:
 *                     type: array
 *                     items:
 *                       type: string
 *                   dietaryRestrictions:
 *                     type: string
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   relationship:
 *                     type: string
 *                   phone:
 *                     type: string
 *               specialNotes:
 *                 type: string
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
