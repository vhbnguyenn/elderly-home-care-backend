const express = require('express');
const router = express.Router();
const {
  createCertificate,
  getMyCertificates,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  getPendingCertificates,
  reviewCertificate
} = require('../controllers/certificateController');
const { protect, authorize } = require('../middlewares/auth');
const { ROLES } = require('../constants');

/**
 * @swagger
 * tags:
 *   name: Certificates
 *   description: Certificate management for caregivers
 */

/**
 * @swagger
 * /api/certificates:
 *   post:
 *     summary: Create certificate (Caregiver only)
 *     tags: [Certificates]
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
 *               - issueDate
 *               - issuingOrganization
 *               - certificateType
 *               - certificateImage
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Chứng chỉ chăm sóc người già"
 *               issueDate:
 *                 type: string
 *                 format: date
 *                 example: "2023-06-15"
 *               issuingOrganization:
 *                 type: string
 *                 example: "Bộ Y Tế"
 *               certificateType:
 *                 type: string
 *                 enum: [chăm sóc người già, y tá, điều dưỡng, sơ cứu, dinh dưỡng, vật lí trị liệu, khác]
 *                 example: "chăm sóc người già"
 *               certificateImage:
 *                 type: string
 *                 example: "https://cloudinary.com/certificate.jpg"
 *     responses:
 *       201:
 *         description: Certificate submitted for review
 *       404:
 *         description: Caregiver profile not found
 */
router.post('/', protect, authorize(ROLES.CAREGIVER), createCertificate);

/**
 * @swagger
 * /api/certificates/my:
 *   get:
 *     summary: Get my certificates (Caregiver only)
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Certificates retrieved successfully
 */
router.get('/my', protect, authorize(ROLES.CAREGIVER), getMyCertificates);

/**
 * @swagger
 * /api/certificates/admin/pending:
 *   get:
 *     summary: Get all pending certificates (Admin only)
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Pending certificates retrieved successfully
 */
router.get('/admin/pending', protect, authorize(ROLES.ADMIN), getPendingCertificates);

/**
 * @swagger
 * /api/certificates/{id}:
 *   get:
 *     summary: Get certificate by ID
 *     tags: [Certificates]
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
 *         description: Certificate retrieved successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Certificate not found
 *   put:
 *     summary: Update certificate (Caregiver only, pending only)
 *     tags: [Certificates]
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
 *               name:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date
 *               issuingOrganization:
 *                 type: string
 *               certificateType:
 *                 type: string
 *                 enum: [chăm sóc người già, y tá, điều dưỡng, sơ cứu, dinh dưỡng, vật lí trị liệu, khác]
 *               certificateImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Certificate updated successfully
 *       400:
 *         description: Cannot update non-pending certificate
 *   delete:
 *     summary: Delete certificate (Caregiver only, pending only)
 *     tags: [Certificates]
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
 *         description: Certificate deleted successfully
 *       400:
 *         description: Cannot delete non-pending certificate
 */
router.route('/:id')
  .get(protect, getCertificateById)
  .put(protect, authorize(ROLES.CAREGIVER), updateCertificate)
  .delete(protect, authorize(ROLES.CAREGIVER), deleteCertificate);

/**
 * @swagger
 * /api/certificates/{id}/review:
 *   put:
 *     summary: Review certificate - approve/reject (Admin only)
 *     tags: [Certificates]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 example: "approved"
 *               rejectionReason:
 *                 type: string
 *                 example: "Certificate image is unclear"
 *     responses:
 *       200:
 *         description: Certificate reviewed successfully
 *       400:
 *         description: Invalid status or missing rejection reason
 */
router.put('/:id/review', protect, authorize(ROLES.ADMIN), reviewCertificate);

module.exports = router;
