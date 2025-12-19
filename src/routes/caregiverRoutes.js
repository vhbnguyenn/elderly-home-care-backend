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
  getCaregiversList,
} = require('../controllers/caregiverController');
const { protect, authorize } = require('../middlewares/auth');
const { uploadCaregiverProfileOptional } = require('../middlewares/upload');
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
 * /api/caregivers/profile:
 *   post:
 *     summary: Tạo hồ sơ caregiver
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "0123456789"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               gender:
 *                 type: string
 *                 enum: [Nam, Nữ]
 *                 example: "Nam"
 *               permanentAddress:
 *                 type: string
 *                 example: "123 Nguyễn Huệ, Q1, TPHCM"
 *               temporaryAddress:
 *                 type: string
 *                 example: "456 Lê Lợi, Q1, TPHCM"
 *               idCardNumber:
 *                 type: string
 *                 example: "123456789012"
 *               idCardFrontImage:
 *                 type: string
 *                 description: "URL ảnh CCCD/CMND mặt trước (nếu đã upload trước)"
 *               idCardBackImage:
 *                 type: string
 *                 description: "URL ảnh CCCD/CMND mặt sau (nếu đã upload trước)"
 *               universityDegreeImage:
 *                 type: string
 *                 description: "URL ảnh bằng đại học (nếu đã upload trước)"
 *               profileImage:
 *                 type: string
 *                 description: "URL avatar/ảnh đại diện (nếu đã upload trước)"
 *               yearsOfExperience:
 *                 type: number
 *                 example: 5
 *               workHistory:
 *                 type: string
 *                 example: "Đã làm việc tại bệnh viện X, Y"
 *               education:
 *                 type: string
 *                 enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *                 example: "đại học"
 *               bio:
 *                 type: string
 *                 example: "Tôi là người có kinh nghiệm chăm sóc người già"
 *               agreeToEthics:
 *                 type: boolean
 *                 example: true
 *               agreeToTerms:
 *                 type: boolean
 *                 example: true
 *               certificates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Chứng chỉ chăm sóc người già"
 *                     issueDate:
 *                       type: string
 *                       format: date
 *                       example: "2020-01-01"
 *                     issuingOrganization:
 *                       type: string
 *                       example: "Bộ Y tế"
 *                     certificateType:
 *                       type: string
 *                       enum: [chăm sóc người già, y tá, điều dưỡng, sơ cứu, dinh dưỡng, vật lí trị liệu, khác]
 *                       example: "chăm sóc người già"
 *                     certificateImage:
 *                       type: string
 *                       description: "URL ảnh chứng chỉ (nếu đã upload trước)"
 *         multipart/form-data:
 *           schema:
 *             type: object
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
 *                 description: "Ảnh avatar/ảnh đại diện"
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
router.post('/profile', protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfileOptional, createProfile);

/**
 * @swagger
 * /api/caregivers/profile:
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
 * /api/caregivers/profile:
 *   put:
 *     summary: Cập nhật profile của caregiver (chỉ các field được phép)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "0123456789"
 *               temporaryAddress:
 *                 type: string
 *                 example: "456 Lê Lợi, Q1, TPHCM"
 *               yearsOfExperience:
 *                 type: number
 *                 example: 5
 *               workHistory:
 *                 type: string
 *                 example: "Đã làm việc tại bệnh viện X, Y"
 *               education:
 *                 type: string
 *                 enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *                 example: "đại học"
 *               bio:
 *                 type: string
 *                 example: "Tôi là người có kinh nghiệm chăm sóc người già"
 *               profileImage:
 *                 type: string
 *                 description: "URL avatar/ảnh đại diện (nếu đã upload trước)"
 *               idCardFrontImage:
 *                 type: string
 *                 description: "URL ảnh CCCD/CMND mặt trước (nếu đã upload trước)"
 *               idCardBackImage:
 *                 type: string
 *                 description: "URL ảnh CCCD/CMND mặt sau (nếu đã upload trước)"
 *               universityDegreeImage:
 *                 type: string
 *                 description: "URL ảnh bằng đại học (nếu đã upload trước)"
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
 *                 description: "Ảnh avatar/ảnh đại diện"
 *               idCardFrontImage:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh CCCD/CMND mặt trước
 *               idCardBackImage:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh CCCD/CMND mặt sau
 *               universityDegreeImage:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh bằng đại học
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
router.put('/profile', protect, authorize(ROLES.CAREGIVER), uploadCaregiverProfileOptional, updateProfile);

/**
 * @swagger
 * /api/caregivers/profiles:
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
 * /api/caregivers/profile/{id}/admin:
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
 * /api/caregivers/profile/{id}/status:
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
 *     summary: Tìm kiếm caregivers bằng AI scoring (location bắt buộc, các field khác optional)
 *     tags: [Caregiver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               elderlyId:
 *                 type: string
 *               location:
 *                 type: object
 *                 required: [address]
 *                 properties:
 *                   address:
 *                     type: string
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   district:
 *                     type: string
 *               packageId:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               requiredCertificates:
 *                 type: array
 *                 items:
 *                   type: string
 *               preferredCertificates:
 *                 type: array
 *                 items:
 *                   type: string
 *               preferredGender:
 *                 type: string
 *                 enum: [male, female]
 *               minExperience:
 *                 type: number
 *               maxDistance:
 *                 type: number
 *               override:
 *                 type: object
 *                 properties:
 *                   healthConditions:
 *                     type: array
 *                     items:
 *                       type: string
 *                   personality:
 *                     type: string
 *                   specialNeeds:
 *                     type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', protect, authorize(ROLES.CARESEEKER), searchCaregivers);

/**
 * @swagger
 * /api/caregivers:
 *   get:
 *     summary: Get list of caregivers (Public)
 *     tags: [Caregiver]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: education
 *         schema:
 *           type: string
 *           enum: [trung học cơ sở, trung học phổ thông, đại học, sau đại học]
 *       - in: query
 *         name: minExperience
 *         schema:
 *           type: integer
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of caregivers
 */
router.get('/', getCaregiversList);

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
