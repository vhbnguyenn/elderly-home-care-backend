const express = require('express');
const router = express.Router();
const {
  createProfile,
  getMyProfile,
  updateProfile,
  getAllProfiles,
  getProfileForAdmin,
  updateProfileStatus,
  searchCaregivers,
  getCaregiverDetail,
} = require('../controllers/caregiverController');
const { protect, authorize } = require('../middlewares/auth');
const { uploadCaregiverProfile } = require('../middlewares/upload');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Certificate:
 *       type: object
 *       required:
 *         - name
 *         - issueDate
 *         - issuingOrganization
 *         - certificateType
 *       properties:
 *         name:
 *           type: string
 *           description: Tên chứng chỉ
 *         issueDate:
 *           type: string
 *           format: date
 *           description: Ngày cấp
 *         issuingOrganization:
 *           type: string
 *           description: Tổ chức cấp
 *         certificateType:
 *           type: string
 *           enum: [chăm sóc người già, y tá, điều dưỡng, sơ cứu, dinh dưỡng, vật lí trị liệu, khác]
 *           description: Loại chứng chỉ
 *     
 *     CaregiverProfile:
 *       type: object
 *       required:
 *         - phoneNumber
 *         - dateOfBirth
 *         - gender
 *         - permanentAddress
 *         - idCardNumber
 *         - yearsOfExperience
 *         - workHistory
 *         - education
 *         - bio
 *         - agreeToEthics
 *         - agreeToTerms
 *         - certificates
 *       properties:
 *         phoneNumber:
 *           type: string
 *           description: Số điện thoại (10-11 chữ số)
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: Ngày sinh
 *         gender:
 *           type: string
 *           enum: [Nam, Nữ]
 *           description: Giới tính
 *         permanentAddress:
 *           type: string
 *           description: Địa chỉ thường trú
 *         temporaryAddress:
 *           type: string
 *           description: Địa chỉ tạm trú (optional)
 *         idCardNumber:
 *           type: string
 *           description: Số CMND/CCCD (9-12 chữ số)
 *         yearsOfExperience:
 *           type: number
 *           minimum: 0
 *           description: Số năm kinh nghiệm
 *         workHistory:
 *           type: string
 *           description: Lịch sử làm việc
 *         education:
 *           type: string
 *           enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *           description: Trình độ học vấn
 *         bio:
 *           type: string
 *           maxLength: 1000
 *           description: Giới thiệu bản thân
 *         agreeToEthics:
 *           type: boolean
 *           description: Đồng ý với đạo đức nghề nghiệp
 *         agreeToTerms:
 *           type: boolean
 *           description: Đồng ý với điều khoản
 *         certificates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Certificate'
 *           description: Danh sách chứng chỉ (tối thiểu 1)
 */

/**
 * @swagger
 * /api/caregiver/profile:
 *   post:
 *     summary: Tạo hồ sơ caregiver
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - dateOfBirth
 *               - gender
 *               - permanentAddress
 *               - idCardNumber
 *               - idCardFrontImage
 *               - idCardBackImage
 *               - profileImage
 *               - yearsOfExperience
 *               - workHistory
 *               - education
 *               - bio
 *               - agreeToEthics
 *               - agreeToTerms
 *               - certificates
 *               - certificateImages
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ]
 *               permanentAddress:
 *                 type: string
 *               temporaryAddress:
 *                 type: string
 *               idCardNumber:
 *                 type: string
 *               idCardFrontImage:
 *                 type: string
 *                 format: binary
 *               idCardBackImage:
 *                 type: string
 *                 format: binary
 *               universityDegreeImage:
 *                 type: string
 *                 format: binary
 *                 description: Bắt buộc nếu education là đại học hoặc sau đại học
 *               profileImage:
 *                 type: string
 *                 format: binary
 *               yearsOfExperience:
 *                 type: number
 *               workHistory:
 *                 type: string
 *               education:
 *                 type: string
 *                 enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *               bio:
 *                 type: string
 *               agreeToEthics:
 *                 type: boolean
 *               agreeToTerms:
 *                 type: boolean
 *               certificates:
 *                 type: string
 *                 description: JSON string của array certificates
 *               certificateImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Ảnh chứng chỉ (phải khớp với số lượng certificates)
 *     responses:
 *       201:
 *         description: Profile created successfully
 *       400:
 *         description: Validation error hoặc profile đã tồn tại
 *       401:
 *         description: Unauthorized
 */
router.post('/profile', protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfile, createProfile);

/**
 * @swagger
 * /api/caregiver/profile:
 *   get:
 *     summary: Lấy profile của caregiver hiện tại
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', protect, authorize(ROLES.CAREGIVER), getMyProfile);

/**
 * @swagger
 * /api/caregiver/profile:
 *   put:
 *     summary: Cập nhật profile của caregiver (chỉ các field được phép)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Số điện thoại
 *               temporaryAddress:
 *                 type: string
 *                 description: Địa chỉ tạm trú
 *               yearsOfExperience:
 *                 type: number
 *                 description: Số năm kinh nghiệm
 *               workHistory:
 *                 type: string
 *                 description: Nơi từng làm việc
 *               education:
 *                 type: string
 *                 enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *                 description: Học vấn
 *               bio:
 *                 type: string
 *                 description: Giới thiệu bản thân
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh đại diện
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Không thể update profile đã approved hoặc không có field nào để update
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfile, updateProfile);

/**
 * @swagger
 * /api/caregiver/profiles:
 *   get:
 *     summary: Lấy tất cả profiles (Admin only)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/profiles', protect, authorize(ROLES.ADMIN), getAllProfiles);

/**
 * @swagger
 * /api/caregiver/profile/{id}/admin:
 *   get:
 *     summary: Lấy chi tiết profile caregiver để duyệt (Admin only)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile ID
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
 *                   $ref: '#/components/schemas/CaregiverProfile'
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.get('/profile/:id/admin', protect, authorize(ROLES.ADMIN), getProfileForAdmin);

/**
 * @swagger
 * /api/caregiver/profile/{id}/status:
 *   put:
 *     summary: Approve/Reject profile (Admin only)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Profile ID
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
 *                 enum: [approved, rejected]
 *               rejectionReason:
 *                 type: string
 *                 description: Bắt buộc nếu status là rejected
 *     responses:
 *       200:
 *         description: Profile status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.put('/profile/:id/status', protect, authorize(ROLES.ADMIN), updateProfileStatus);

/**
 * @swagger
 * /api/caregivers/search:
 *   post:
 *     summary: Search caregivers with AI or manual filters
 *     tags: [Caregiver]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language query for AI search
 *               filters:
 *                 type: object
 *                 properties:
 *                   skills:
 *                     type: array
 *                     items:
 *                       type: string
 *                   location:
 *                     type: string
 *                   minRating:
 *                     type: number
 *                   packageType:
 *                     type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', searchCaregivers);

/**
 * @swagger
 * /api/caregivers/{caregiverId}:
 *   get:
 *     summary: Get caregiver detail
 *     tags: [Caregiver]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Caregiver detail
 */
router.get('/:caregiverId', getCaregiverDetail);

module.exports = router;
