const Certificate = require('../models/Certificate');
const CaregiverProfile = require('../models/CaregiverProfile');

/**
 * @desc    Create certificate (Caregiver only)
 * @route   POST /api/certificates
 * @access  Private (Caregiver)
 */
const createCertificate = async (req, res, next) => {
  try {
    const { name, issueDate, issuingOrganization, certificateType, certificateImage } = req.body;

    // Check if caregiver profile exists
    const caregiverProfile = await CaregiverProfile.findOne({ user: req.user.id });
    
    if (!caregiverProfile) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver profile not found. Please create your profile first.'
      });
    }

    // Create certificate
    const certificate = await Certificate.create({
      caregiver: req.user.id,
      caregiverProfile: caregiverProfile._id,
      name,
      issueDate,
      issuingOrganization,
      certificateType,
      certificateImage,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Certificate submitted for review',
      data: certificate
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my certificates (Caregiver only)
 * @route   GET /api/certificates/my
 * @access  Private (Caregiver)
 */
const getMyCertificates = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { caregiver: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const certificates = await Certificate.find(query)
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get certificate by ID
 * @route   GET /api/certificates/:id
 * @access  Private (Caregiver, Admin)
 */
const getCertificateById = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate('caregiver', 'name email')
      .populate('caregiverProfile')
      .populate('reviewedBy', 'name email');

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Check if user is the owner or admin
    const isOwner = certificate.caregiver._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this certificate'
      });
    }

    res.status(200).json({
      success: true,
      data: certificate
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update certificate (Caregiver only, only if pending)
 * @route   PUT /api/certificates/:id
 * @access  Private (Caregiver)
 */
const updateCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Check ownership
    if (certificate.caregiver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this certificate'
      });
    }

    // Can only update if pending
    if (certificate.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot update certificate with status: ${certificate.status}`
      });
    }

    const { name, issueDate, issuingOrganization, certificateType, certificateImage } = req.body;

    if (name) certificate.name = name;
    if (issueDate) certificate.issueDate = issueDate;
    if (issuingOrganization) certificate.issuingOrganization = issuingOrganization;
    if (certificateType) certificate.certificateType = certificateType;
    if (certificateImage) certificate.certificateImage = certificateImage;

    await certificate.save();

    res.status(200).json({
      success: true,
      message: 'Certificate updated successfully',
      data: certificate
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete certificate (Caregiver only, only if pending)
 * @route   DELETE /api/certificates/:id
 * @access  Private (Caregiver)
 */
const deleteCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Check ownership
    if (certificate.caregiver.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this certificate'
      });
    }

    // Can only delete if pending
    if (certificate.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete certificate with status: ${certificate.status}`
      });
    }

    await certificate.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Certificate deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all pending certificates (Admin only)
 * @route   GET /api/certificates/admin/pending
 * @access  Private (Admin)
 */
const getPendingCertificates = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const certificates = await Certificate.find({ status: 'pending' })
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'yearsOfExperience education')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Certificate.countDocuments({ status: 'pending' });

    res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Review certificate - approve/reject (Admin only)
 * @route   PUT /api/certificates/:id/review
 * @access  Private (Admin)
 */
const reviewCertificate = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"'
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a certificate'
      });
    }

    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    if (certificate.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Certificate has already been reviewed'
      });
    }

    certificate.status = status;
    certificate.reviewedBy = req.user.id;
    certificate.reviewedAt = new Date();
    
    if (status === 'rejected') {
      certificate.rejectionReason = rejectionReason;
    }

    await certificate.save();

    // If approved, add to caregiver profile certificates array
    if (status === 'approved') {
      const caregiverProfile = await CaregiverProfile.findById(certificate.caregiverProfile);
      
      if (caregiverProfile) {
        caregiverProfile.certificates.push({
          name: certificate.name,
          issueDate: certificate.issueDate,
          issuingOrganization: certificate.issuingOrganization,
          certificateType: certificate.certificateType,
          certificateImage: certificate.certificateImage
        });
        await caregiverProfile.save();
      }
    }

    const populatedCertificate = await Certificate.findById(certificate._id)
      .populate('caregiver', 'name email')
      .populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Certificate ${status} successfully`,
      data: populatedCertificate
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCertificate,
  getMyCertificates,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  getPendingCertificates,
  reviewCertificate
};
