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
 *         isCustom:
 *           type: boolean
 *           description: Kỹ năng tự tạo hay từ danh sách có sẵn
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
 * /api/caregiver-skills/predefined:
 *   get:
 *     summary: Lấy danh sách kỹ năng có sẵn để chọn
 *     tags: [Caregiver Skills]
 *     responses:
 *       200:
 *         description: Danh sách kỹ năng có sẵn
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
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       icon:
 *                         type: string
 */
router.get('/predefined', caregiverSkillController.getPredefinedSkills);

/**
 * @swagger
 * /api/caregiver-skills:
 *   post:
 *     summary: Thêm kỹ năng mới cho caregiver
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
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
 *               isCustom:
 *                 type: boolean
 *                 description: true nếu là kỹ năng tự tạo
 *                 example: false
 *               caregiverId:
 *                 type: string
 *                 description: ID của caregiver (chỉ admin có thể dùng)
 *     responses:
 *       201:
 *         description: Thêm kỹ năng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc kỹ năng đã tồn tại
 *       403:
 *         description: Không có quyền
 */
router.post('/', protect, caregiverSkillController.addSkill);

/**
 * @swagger
 * /api/caregiver-skills/batch:
 *   post:
 *     summary: Thêm nhiều kỹ năng cùng lúc
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - skills
 *             properties:
 *               skills:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     icon:
 *                       type: string
 *                 example:
 *                   - name: Quản lý thuốc
 *                     description: Nhắc nhở và hỗ trợ uống thuốc
 *                     icon: medication
 *                   - name: Đo sinh hiệu
 *                     description: Đo huyết áp, nhiệt độ, nhịp tim
 *                     icon: vital-signs
 *               caregiverId:
 *                 type: string
 *                 description: ID của caregiver (chỉ admin có thể dùng)
 *     responses:
 *       201:
 *         description: Thêm kỹ năng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post('/batch', protect, caregiverSkillController.batchAddSkills);

/**
 * @swagger
 * /api/caregiver-skills/my-skills:
 *   get:
 *     summary: Lấy danh sách kỹ năng của caregiver đang đăng nhập
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
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
 * /api/caregiver-skills/statistics:
 *   get:
 *     summary: Lấy thống kê kỹ năng (Admin)
 *     tags: [Caregiver Skills]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 */
router.get('/statistics', protect, authorize(ROLES.ADMIN), caregiverSkillController.getSkillStatistics);

/**
 * @swagger
 * /api/caregiver-skills/caregiver/{caregiverId}:
 *   get:
 *     summary: Lấy danh sách kỹ năng của một caregiver
 *     tags: [Caregiver Skills]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của caregiver
 *       - in: query
 *         name: displayedOnly
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Chỉ lấy kỹ năng hiển thị trên profile (true) hoặc tất cả (false)
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
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
 *     summary: Cập nhật kỹ năng
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
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.put('/:id', protect, caregiverSkillController.updateSkill);

/**
 * @swagger
 * /api/caregiver-skills/{id}/toggle-display:
 *   patch:
 *     summary: Bật/tắt hiển thị kỹ năng trên profile
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
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.patch('/:id/toggle-display', protect, caregiverSkillController.toggleSkillDisplay);

/**
 * @swagger
 * /api/caregiver-skills/{id}:
 *   delete:
 *     summary: Xóa kỹ năng
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
 *       404:
 *         description: Không tìm thấy kỹ năng
 */
router.delete('/:id', protect, caregiverSkillController.deleteSkill);

module.exports = router;
