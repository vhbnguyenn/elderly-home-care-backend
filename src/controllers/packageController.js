const Package = require('../models/Package');
const CaregiverProfile = require('../models/CaregiverProfile');
const { ROLES } = require('../constants');

// @desc    Tạo gói dịch vụ mới
// @route   POST /api/packages
// @access  Private (Admin only)
const createPackage = async (req, res, next) => {
  try {
    const {
      packageName,
      description,
      price,
      packageType,
      duration,
      paymentCycle,
      services,
      customServices,
      notes,
      isPopular
    } = req.body;

    // Validate required fields
    if (!packageName || !description || !price || !packageType || !duration || !paymentCycle) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
      });
    }

    // Create package (không cần caregiver vì là gói chung của hệ thống)
    const packageData = await Package.create({
      packageName,
      description,
      price,
      packageType,
      duration,
      paymentCycle,
      services: services || [],
      customServices: customServices || [],
      notes: notes || '',
      isPopular: isPopular || false,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: packageData
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tất cả gói dịch vụ (Public)
// @route   GET /api/packages
// @access  Public
const getAllPackages = async (req, res, next) => {
  try {
    const { 
      packageType, 
      isActive = true,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    // Filter by package type
    if (packageType) {
      query.packageType = packageType;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const packages = await Package.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Package.countDocuments(query);

    res.status(200).json({
      success: true,
      data: packages,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết gói dịch vụ (Public)
// @route   GET /api/packages/:id
// @access  Public
const getPackageById = async (req, res, next) => {
  try {
    const packageData = await Package.findById(req.params.id);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    res.status(200).json({
      success: true,
      data: packageData
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật gói dịch vụ
// @route   PUT /api/packages/:id
// @access  Private (Admin only)
const updatePackage = async (req, res, next) => {
  try {
    const packageData = await Package.findById(req.params.id);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const {
      packageName,
      description,
      price,
      packageType,
      duration,
      paymentCycle,
      services,
      customServices,
      notes,
      isPopular,
      isActive
    } = req.body;

    // Update fields
    if (packageName !== undefined) packageData.packageName = packageName;
    if (description !== undefined) packageData.description = description;
    if (price !== undefined) packageData.price = price;
    if (packageType !== undefined) packageData.packageType = packageType;
    if (duration !== undefined) packageData.duration = duration;
    if (paymentCycle !== undefined) packageData.paymentCycle = paymentCycle;
    if (services !== undefined) packageData.services = services;
    if (customServices !== undefined) packageData.customServices = customServices;
    if (notes !== undefined) packageData.notes = notes;
    if (isPopular !== undefined) packageData.isPopular = isPopular;
    if (isActive !== undefined) packageData.isActive = isActive;

    await packageData.save();

    await packageData.populate([
      { path: 'caregiver', select: 'name email phone' },
      { path: 'caregiverProfile', select: 'profileImage bio yearsOfExperience' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Package updated successfully',
      data: packageData
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Toggle package active/block status
// @route   PUT /api/packages/:id/toggle
// @access  Private (Admin only)
const togglePackageStatus = async (req, res, next) => {
  try {
    const packageData = await Package.findById(req.params.id);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    // Toggle active status
    packageData.isActive = !packageData.isActive;
    await packageData.save();

    const statusMessage = packageData.isActive ? 'activated' : 'blocked';

    res.status(200).json({
      success: true,
      message: `Package ${statusMessage} successfully`,
      data: packageData
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  togglePackageStatus
};
