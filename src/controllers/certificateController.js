const Certificate = require('../models/Certificate');
const CaregiverProfile = require('../models/CaregiverProfile');

/**
 * @desc    Create certificate (Caregiver only)
 * @route   POST /api/certificates
 * @access  Private (Caregiver)
 */
const createCertificate = async (req, res, next) => {
  try {
    const { name, issueDate, expirationDate, issuingOrganization, certificateType, certificateImage } = req.body;

    // Check if caregiver profile exists
    const caregiverProfile = await CaregiverProfile.findOne({ user: req.user.id });
    
    const certificateData = {
      caregiver: req.user.id,
      name,
      issueDate,
      expirationDate,
      issuingOrganization,
      certificateType,
      certificateImage,
      status: 'pending'
    };

    if (caregiverProfile) {
      certificateData.caregiverProfile = caregiverProfile._id;
    }

    // Create certificate
    const certificate = await Certificate.create(certificateData, {
      runValidators: false,
      strict: false
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
    const query = { caregiver: req.user.id };

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

    // Check if user is the owner or admin
    const isOwner = certificate && certificate.caregiver && certificate.caregiver._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this certificate'
      });
    }

    res.status(200).json({
      success: true,
      data: certificate || null
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
    const { name, issueDate, expirationDate, issuingOrganization, certificateType, certificateImage } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (issueDate !== undefined) updateData.issueDate = issueDate;
    if (expirationDate !== undefined) updateData.expirationDate = expirationDate;
    if (issuingOrganization !== undefined) updateData.issuingOrganization = issuingOrganization;
    if (certificateType !== undefined) updateData.certificateType = certificateType;
    if (certificateImage !== undefined) updateData.certificateImage = certificateImage;

    const certificate = await Certificate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    );

    res.status(200).json({
      success: true,
      message: 'Certificate updated successfully',
      data: certificate || null
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
    await Certificate.findByIdAndDelete(req.params.id);

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

    const certificates = await Certificate.find({})
      .populate('caregiver', 'name email phone')
      .populate('caregiverProfile', 'yearsOfExperience education')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Certificate.countDocuments({});

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

    const updateData = {
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (rejectionReason !== undefined) {
      updateData.rejectionReason = rejectionReason;
    }

    const certificate = await Certificate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: false }
    );

    // If approved, add to caregiver profile certificates array
    if (certificate && status === 'approved' && certificate.caregiverProfile) {
      const caregiverProfile = await CaregiverProfile.findById(certificate.caregiverProfile);
      
      if (caregiverProfile) {
        const certData = {
          name: certificate.name,
          issueDate: certificate.issueDate,
          expirationDate: certificate.expirationDate,
          issuingOrganization: certificate.issuingOrganization,
          certificateType: certificate.certificateType,
          certificateImage: certificate.certificateImage
        };
        caregiverProfile.certificates.push(certData);
        await caregiverProfile.save({ runValidators: false });
      }
    }

    const populatedCertificate = await Certificate.findById(certificate?._id || req.params.id)
      .populate('caregiver', 'name email')
      .populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Certificate ${status || 'updated'} successfully`,
      data: populatedCertificate || null
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
