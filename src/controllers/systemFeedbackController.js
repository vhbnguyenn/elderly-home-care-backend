const SystemFeedback = require('../models/SystemFeedback');
const { ROLES } = require('../constants');

// @desc    Create system feedback
// @route   POST /api/system-feedback
// @access  Private (Caregiver & Careseeker)
exports.createFeedback = async (req, res, next) => {
  try {
    const {
      feedbackType,
      category,
      priority,
      title,
      description,
      attachments,
      deviceInfo,
      satisfactionRating,
      tags
    } = req.body;

    // Validate required fields
    if (!feedbackType || !category || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    // Create feedback
    const feedback = await SystemFeedback.create({
      user: req.user._id,
      feedbackType,
      category,
      priority: priority || 'medium',
      title,
      description,
      attachments: attachments || [],
      deviceInfo,
      satisfactionRating,
      tags: tags || []
    });

    await feedback.populate('user', 'name email role avatar');

    res.status(201).json({
      success: true,
      message: 'Gửi góp ý thành công. Chúng tôi sẽ xem xét và phản hồi sớm nhất!',
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get feedback detail (Admin only)
// @route   GET /api/system-feedback/:id
// @access  Private (Admin only)
exports.getFeedbackDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await SystemFeedback.findById(id)
      .populate('user', 'name email role avatar')
      .populate('adminResponse.respondedBy', 'name email');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
};

// ========== ADMIN ENDPOINTS ==========

// @desc    Get all feedbacks (Admin)
// @route   GET /api/system-feedback/admin/all
// @access  Private (Admin only)
exports.getAllFeedbacks = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = '-createdAt',
      status,
      feedbackType,
      category,
      priority,
      search
    } = req.query;

    const filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (feedbackType) filterQuery.feedbackType = feedbackType;
    if (category) filterQuery.category = category;
    if (priority) filterQuery.priority = priority;
    
    if (search) {
      filterQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const feedbacks = await SystemFeedback.find(filterQuery)
      .populate('user', 'name email role avatar')
      .populate('adminResponse.respondedBy', 'name email')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await SystemFeedback.countDocuments(filterQuery);

    // Statistics
    const stats = await SystemFeedback.aggregate([
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          byStatus: {
            $push: '$status'
          },
          byType: {
            $push: '$feedbackType'
          },
          byPriority: {
            $push: '$priority'
          }
        }
      }
    ]);

    const statsData = stats[0] || {};
    const statusDistribution = {};
    const typeDistribution = {};
    const priorityDistribution = {};

    if (statsData.byStatus) {
      statsData.byStatus.forEach(s => {
        statusDistribution[s] = (statusDistribution[s] || 0) + 1;
      });
    }

    if (statsData.byType) {
      statsData.byType.forEach(t => {
        typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      });
    }

    if (statsData.byPriority) {
      statsData.byPriority.forEach(p => {
        priorityDistribution[p] = (priorityDistribution[p] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        feedbacks,
        statistics: {
          total: statsData.totalFeedbacks || 0,
          byStatus: statusDistribution,
          byType: typeDistribution,
          byPriority: priorityDistribution
        },
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

