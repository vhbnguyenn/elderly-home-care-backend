const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * components:
 *   schemas:
 *     Dispute:
 *       type: object
 *       required:
 *         - bookingId
 *         - respondentId
 *         - disputeType
 *         - severity
 *         - title
 *         - description
 *         - requestedResolution
 *       properties:
 *         bookingId:
 *           type: string
 *         respondentId:
 *           type: string
 *         disputeType:
 *           type: string
 *           enum: [service_quality, payment_issue, no_show, late_arrival, early_departure, unprofessional_behavior, safety_concern, breach_of_agreement, harassment, theft_or_damage, other]
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         title:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 3000
 *         evidence:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [image, video, document, audio]
 *               url:
 *                 type: string
 *               description:
 *                 type: string
 *         requestedResolution:
 *           type: string
 *           enum: [refund, partial_refund, compensation, apology, account_warning, account_suspension, other]
 *         requestedAmount:
 *           type: number
 *           minimum: 0
 *         refundBankInfo:
 *           type: object
 *           description: Required if careseeker requests refund/partial_refund
 *           properties:
 *             accountName:
 *               type: string
 *               maxLength: 100
 *             accountNumber:
 *               type: string
 *               maxLength: 50
 *             bankName:
 *               type: string
 *               maxLength: 100
 *             bankBranch:
 *               type: string
 *               maxLength: 100
 */

/**
 * @swagger
 * /api/disputes:
 *   post:
 *     summary: Tạo khiếu nại
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Dispute'
 *     responses:
 *       201:
 *         description: Dispute created successfully
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking/Respondent not found
 */
router.post('/', protect, disputeController.createDispute);

/**
 * @swagger
 * /api/disputes/admin/all:
 *   get:
 *     summary: Lấy tất cả khiếu nại (Admin only)
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: -createdAt
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: disputeType
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All disputes retrieved successfully
 */
router.get('/admin/all', protect, authorize(ROLES.ADMIN), disputeController.getAllDisputes);

/**
 * @swagger
 * /api/disputes/{id}:
 *   get:
 *     summary: Lấy chi tiết khiếu nại
 *     tags: [Disputes]
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
 *         description: Dispute detail retrieved successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Dispute not found
 */
router.get('/:id', protect, disputeController.getDisputeDetail);

/**
 * @swagger
 * /api/disputes/{id}/respond:
 *   post:
 *     summary: Phản hồi/bổ sung bằng chứng (cả 2 bên - chỉ khi admin cho phép)
 *     description: Người khiếu nại và người bị khiếu nại đều có thể phản hồi/bổ sung bằng chứng, nhưng chỉ hoạt động khi admin đã bật allowComplainantResponse (cho người khiếu nại) hoặc allowRespondentResponse (cho người bị khiếu nại)
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Nội dung phản hồi (tùy chọn)
 *               evidence:
 *                 type: array
 *                 description: Bổ sung bằng chứng (tùy chọn)
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [image, video, document, audio]
 *                     url:
 *                       type: string
 *                     description:
 *                       type: string
 *     responses:
 *       200:
 *         description: Response submitted successfully
 *       403:
 *         description: Forbidden - admin chưa cho phép hoặc không phải complainant/respondent
 *       404:
 *         description: Dispute not found
 */
router.post('/:id/respond', protect, disputeController.respondToDispute);

/**
 * @swagger
 * /api/disputes/{id}/withdraw:
 *   post:
 *     summary: Rút khiếu nại (chỉ người khiếu nại)
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute withdrawn successfully
 *       400:
 *         description: Cannot withdraw resolved dispute
 *       403:
 *         description: Forbidden - not the complainant
 *       404:
 *         description: Dispute not found
 */
router.post('/:id/withdraw', protect, disputeController.withdrawDispute);

/**
 * @swagger
 * /api/disputes/{id}/rate-resolution:
 *   post:
 *     summary: Đánh giá cách giải quyết khiếu nại (cho cả complainant và respondent)
 *     tags: [Disputes]
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
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Rating submitted successfully
 *       400:
 *         description: Can only rate resolved/rejected/refund_completed disputes or already rated
 *       403:
 *         description: Forbidden - must be complainant or respondent
 *       404:
 *         description: Dispute not found
 */
router.post('/:id/rate-resolution', protect, disputeController.rateResolution);

/**
 * @swagger
 * /api/disputes/{id}/assign:
 *   put:
 *     summary: Giao khiếu nại cho admin (Admin only)
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute assigned successfully
 *       404:
 *         description: Dispute not found
 */
router.put('/:id/assign', protect, authorize(ROLES.ADMIN), disputeController.assignDispute);

/**
 * @swagger
 * /api/disputes/{id}/decide:
 *   post:
 *     summary: Đưa ra quyết định cho khiếu nại (Admin only)
 *     tags: [Disputes]
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
 *             required:
 *               - decision
 *               - resolution
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [favor_complainant, favor_respondent, partial_favor, no_fault, mutual_fault]
 *               resolution:
 *                 type: string
 *                 maxLength: 2000
 *               refundAmount:
 *                 type: number
 *               compensationAmount:
 *                 type: number
 *               actions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [warning_issued, account_suspended, refund_processed, compensation_paid, no_action, other]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Decision made successfully
 *       404:
 *         description: Dispute not found
 */
router.post('/:id/decide', protect, authorize(ROLES.ADMIN), disputeController.makeDecision);

/**
 * @swagger
 * /api/disputes/{id}/status:
 *   put:
 *     summary: Cập nhật trạng thái khiếu nại (Admin only)
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, under_review, awaiting_response, investigating, mediation, refund_approved, refund_processing, refund_completed, resolved, rejected, withdrawn, escalated]
 *                 description: Trạng thái khiếu nại
 *               note:
 *                 type: string
 *                 description: Ghi chú khi cập nhật trạng thái
 *               allowComplainantResponse:
 *                 type: boolean
 *                 description: Cho phép/không cho phép người khiếu nại phản hồi/bổ sung bằng chứng
 *               allowRespondentResponse:
 *                 type: boolean
 *                 description: Cho phép/không cho phép người bị khiếu nại phản hồi
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Dispute not found
 */
router.put('/:id/status', protect, authorize(ROLES.ADMIN), disputeController.updateDisputeStatus);

/**
 * @swagger
 * /api/disputes/{id}/internal-note:
 *   post:
 *     summary: Thêm ghi chú nội bộ (Admin only)
 *     tags: [Disputes]
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
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Internal note added successfully
 *       404:
 *         description: Dispute not found
 */
router.post('/:id/internal-note', protect, authorize(ROLES.ADMIN), disputeController.addInternalNote);

module.exports = router;
