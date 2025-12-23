const express = require('express');
const router = express.Router();
const caregiverSkillController = require('../controllers/caregiverSkillController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

/**
 * @swagger
 * components:
 *   schemas:
 *     CaregiverSkill:
 *       type: object
 *       required:
 *         - caregiver
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của kỹ năng
 *         caregiver:
 *           type: string
 *           description: ID của caregiver
 *         name:
 *           type: string
 *           description: Tên kỹ năng
 *         description:
 *           type: string
 *           description: Mô tả kỹ năng
 *         icon:
 *           type: string
 *           enum: [medication, vital-signs, emergency, nutrition, exercise, cognitive, bathing, wound-care, communication, first-aid, stethoscope, injection, medical-bag, thermometer, heartbeat, compassion, plant, flower, custom]
 *           description: Icon của kỹ năng
 *         isDisplayedOnProfile:
 *           type: boolean
 *           description: Hiển thị trên profile hay không
 *         isActive:
 *           type: boolean
 *           description: Trạng thái kỹ năng
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/caregiver-skills:
 *   post:
 *     summary: Thêm kỹ năng mới cho caregiver (Caregiver only - tự động lấy ID từ token)
 *     description: |
 *       API này chỉ dành cho CAREGIVER tạo skill cho chính mình.
 *       - CaregiverId tự động lấy từ token (req.user.userId)
 *       - Không cần truyền caregiverId trong request body
 *     tags: [Caregiver Skills]
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
 *                 example: Quản lý thuốc
 *               description:
 *                 type: string
 *                 example: Nhắc nhở và hỗ trợ uống thuốc
 *               icon:
 *                 type: string
 *                 example: medication
 *     responses:
 *       201:
 *         description: Thêm kỹ năng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc kỹ năng đã tồn tại
 *       403:
 *         description: Không có quyền (chỉ caregiver mới tạo được)
 */
router.post('/', protect, authorize(ROLES.CAREGIVER), caregiverSkillController.addSkill);

/**
 * @swagger
 * /api/caregiver-skills/my-skills:
 *   get:
 *     summary: Lấy danh sách kỹ năng của caregiver đang đăng nhập (PRIVATE - Quản lý)
 *     description: |
 *       API này dùng cho CAREGIVER xem và quản lý skills của chính mình.
 *       - Luôn trả về TẤT CẢ skills (cả ẩn và hiện) để caregiver quản lý
 *       - Cần authentication + role CAREGIVER
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công (trả về tất cả skills - cả ẩn và hiện)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CaregiverSkill'
 */
router.get('/my-skills', protect, authorize(ROLES.CAREGIVER), caregiverSkillController.getMySkills);

/**
 * @swagger
 * /api/caregiver-skills/caregiver/{caregiverId}:
 *   get:
 *     summary: Lấy danh sách kỹ năng của một caregiver (PUBLIC - Xem profile)
 *     description: |
 *       API này dùng cho CARESEEKER xem profile của caregiver.
 *       - Public: Không cần authentication
 *       - Mặc định: Chỉ hiển thị skills có isDisplayedOnProfile: true (cho careseeker thấy)
 *     tags: [Caregiver Skills]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của caregiver
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công (mặc định chỉ skills hiển thị)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CaregiverSkill'
 */
router.get('/caregiver/:caregiverId', caregiverSkillController.getSkillsByCaregiver);

/**
 * @swagger
 * /api/caregiver-skills/{id}:
 *   put:
 *     summary: Cập nhật kỹ năng (Caregiver only - chỉ có thể sửa skill của chính mình)
 *     description: |
 *       API này chỉ dành cho CAREGIVER cập nhật skill của chính mình.
 *       - Tự động check ownership từ token
 *       - Chỉ có thể sửa skill của chính mình
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của kỹ năng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *               isDisplayedOnProfile:
 *                 type: boolean
 *                 description: Hiển thị trên profile hay không
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền (chỉ có thể sửa skill của chính mình)
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.put('/:id', protect, authorize(ROLES.CAREGIVER), caregiverSkillController.updateSkill);

/**
 * @swagger
 * /api/caregiver-skills/{id}/toggle-display:
 *   patch:
 *     summary: Bật/tắt hiển thị kỹ năng trên profile (Caregiver only - chỉ có thể toggle skill của chính mình)
 *     description: |
 *       API này chỉ dành cho CAREGIVER toggle hiển thị skill của chính mình.
 *       - Tự động check ownership từ token
 *       - Chỉ có thể toggle skill của chính mình
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của kỹ năng
 *     responses:
 *       200:
 *         description: Toggle thành công
 *       403:
 *         description: Không có quyền (chỉ có thể toggle skill của chính mình)
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.patch('/:id/toggle-display', protect, authorize(ROLES.CAREGIVER), caregiverSkillController.toggleSkillDisplay);

/**
 * @swagger
 * /api/caregiver-skills/{id}:
 *   delete:
 *     summary: Xóa kỹ năng (Caregiver only - chỉ có thể xóa skill của chính mình)
 *     description: |
 *       API này chỉ dành cho CAREGIVER xóa skill của chính mình.
 *       - Tự động check ownership từ token
 *       - Chỉ có thể xóa skill của chính mình
 *       - Soft delete: set isActive = false
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của kỹ năng
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       403:
 *         description: Không có quyền (chỉ có thể xóa skill của chính mình)
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.delete('/:id', protect, authorize(ROLES.CAREGIVER), caregiverSkillController.deleteSkill);

module.exports = router;
