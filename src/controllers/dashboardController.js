const User = require('../models/User');
const Booking = require('../models/Booking');
const { ROLES } = require('../constants/roles');

/**
 * @desc Get user statistics by role (for pie/donut chart)
 * @route GET /api/dashboard/users/by-role
 * @access Private (Admin only)
 */
exports.getUsersByRole = async (req, res) => {
  try {
    // Aggregate users by role
    const usersByRole = await User.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          role: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Format data for pie/donut chart
    const formattedData = usersByRole.map(item => ({
      role: item.role,
      label: getRoleLabel(item.role),
      count: item.count
    }));

    // Calculate total
    const total = formattedData.reduce((sum, item) => sum + item.count, 0);

    // Add percentage
    const dataWithPercentage = formattedData.map(item => ({
      ...item,
      percentage: ((item.count / total) * 100).toFixed(2)
    }));

    res.status(200).json({
      success: true,
      data: {
        users: dataWithPercentage,
        total: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics by role',
      error: error.message
    });
  }
};

/**
 * @desc Get user registrations over time (for line chart)
 * @route GET /api/dashboard/users/registrations
 * @access Private (Admin only)
 * @query period - day/week/month (default: day)
 * @query role - caregiver/careseeker/all (default: all)
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query limit - Number of data points (default: 30)
 */
exports.getUserRegistrations = async (req, res) => {
  try {
    const { 
      period = 'day', 
      role = 'all', 
      startDate, 
      endDate,
      limit = 30 
    } = req.query;

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be day, week, or month'
      });
    }

    // Validate role
    if (role !== 'all' && ![ROLES.CAREGIVER, ROLES.CARESEEKER].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be caregiver, careseeker, or all'
      });
    }

    // Set date range
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    // If no dates provided, set default range based on period
    if (!startDate && !endDate) {
      end = new Date();
      switch (period) {
        case 'day':
          start = new Date(end.getTime() - parseInt(limit) * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          start = new Date(end.getTime() - parseInt(limit) * 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(end);
          start.setMonth(start.getMonth() - parseInt(limit));
          break;
      }
    }

    // Build match query
    const matchQuery = {
      createdAt: {
        $gte: start,
        $lte: end
      }
    };

    if (role !== 'all') {
      matchQuery.role = role;
    } else {
      // Exclude admin from statistics
      matchQuery.role = { $in: [ROLES.CAREGIVER, ROLES.CARESEEKER] };
    }

    // Build aggregation pipeline based on period
    let dateFormat;
    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-W%U'; // Year-Week
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { 
              $dateToString: { 
                format: dateFormat, 
                date: '$createdAt' 
              } 
            },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ];

    const registrations = await User.aggregate(pipeline);

    // Format data for line chart
    let formattedData;
    
    if (role === 'all') {
      // Group by date and separate by role
      const dataByDate = {};
      
      registrations.forEach(item => {
        const date = item._id.date;
        if (!dataByDate[date]) {
          dataByDate[date] = {
            date: date,
            caregiver: 0,
            careseeker: 0,
            total: 0
          };
        }
        dataByDate[date][item._id.role] = item.count;
        dataByDate[date].total += item.count;
      });

      formattedData = Object.values(dataByDate);
    } else {
      // Single role data
      formattedData = registrations.map(item => ({
        date: item._id.date,
        count: item.count
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        period: period,
        role: role,
        startDate: start,
        endDate: end,
        registrations: formattedData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user registrations',
      error: error.message
    });
  }
};

/**
 * @desc Get overall dashboard statistics
 * @route GET /api/dashboard/overview
 * @access Private (Admin only)
 */
exports.getDashboardOverview = async (req, res) => {
  try {
    // Get total users by role
    const usersByRole = await User.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format the data
    const stats = {
      totalUsers: 0,
      caregivers: 0,
      careseekers: 0,
      admins: 0
    };

    usersByRole.forEach(item => {
      stats.totalUsers += item.count;
      switch (item._id) {
        case ROLES.CAREGIVER:
          stats.caregivers = item.count;
          break;
        case ROLES.CARESEEKER:
          stats.careseekers = item.count;
          break;
        case ROLES.ADMIN:
          stats.admins = item.count;
          break;
      }
    });

    // Get registrations in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get today's registrations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRegistrations = await User.countDocuments({
      createdAt: { $gte: today }
    });

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentRegistrations: {
          last30Days: recentRegistrations,
          today: todayRegistrations
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard overview',
      error: error.message
    });
  }
};

// Helper function to get Vietnamese role labels
function getRoleLabel(role) {
  const labels = {
    [ROLES.ADMIN]: 'Quản trị viên',
    [ROLES.CAREGIVER]: 'Người chăm sóc',
    [ROLES.CARESEEKER]: 'Người tìm chăm sóc'
  };
  return labels[role] || role;
}

/**
 * @desc Get booking statistics over time (for line chart)
 * @route GET /api/dashboard/bookings/statistics
 * @access Private (Admin only)
 * @query period - day/week/month (default: day)
 * @query status - pending/confirmed/in-progress/completed/cancelled/all (default: all)
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query limit - Number of data points (default: 30)
 */
exports.getBookingStatistics = async (req, res) => {
  try {
    const { 
      period = 'day', 
      status = 'all', 
      startDate, 
      endDate,
      limit = 30 
    } = req.query;

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be day, week, or month'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'all'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, confirmed, in-progress, completed, cancelled, or all'
      });
    }

    // Set date range
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    // If no dates provided, set default range based on period
    if (!startDate && !endDate) {
      end = new Date();
      switch (period) {
        case 'day':
          start = new Date(end.getTime() - parseInt(limit) * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          start = new Date(end.getTime() - parseInt(limit) * 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(end);
          start.setMonth(start.getMonth() - parseInt(limit));
          break;
      }
    }

    // Build match query
    const matchQuery = {
      createdAt: {
        $gte: start,
        $lte: end
      }
    };

    if (status !== 'all') {
      matchQuery.status = status;
    }

    // Build aggregation pipeline based on period
    let dateFormat;
    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-W%U'; // Year-Week
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { 
              $dateToString: { 
                format: dateFormat, 
                date: '$createdAt' 
              } 
            },
            status: '$status'
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ];

    const bookings = await Booking.aggregate(pipeline);

    // Format data for line chart
    let formattedData;
    
    if (status === 'all') {
      // Group by date and separate by status
      const dataByDate = {};
      
      bookings.forEach(item => {
        const date = item._id.date;
        if (!dataByDate[date]) {
          dataByDate[date] = {
            date: date,
            pending: 0,
            confirmed: 0,
            'in-progress': 0,
            completed: 0,
            cancelled: 0,
            total: 0,
            totalRevenue: 0
          };
        }
        dataByDate[date][item._id.status] = item.count;
        dataByDate[date].total += item.count;
        dataByDate[date].totalRevenue += item.totalRevenue;
      });

      formattedData = Object.values(dataByDate);
    } else {
      // Single status data
      formattedData = bookings.map(item => ({
        date: item._id.date,
        count: item.count,
        totalRevenue: item.totalRevenue
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        period: period,
        status: status,
        startDate: start,
        endDate: end,
        bookings: formattedData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking statistics',
      error: error.message
    });
  }
};

/**
 * @desc Get booking overview statistics
 * @route GET /api/dashboard/bookings/overview
 * @access Private (Admin only)
 */
exports.getBookingOverview = async (req, res) => {
  try {
    // Get total bookings by status
    const bookingsByStatus = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Format the data
    const stats = {
      totalBookings: 0,
      pending: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
      completedRevenue: 0
    };

    bookingsByStatus.forEach(item => {
      stats.totalBookings += item.count;
      stats.totalRevenue += item.totalRevenue;
      
      switch (item._id) {
        case 'pending':
          stats.pending = item.count;
          break;
        case 'confirmed':
          stats.confirmed = item.count;
          break;
        case 'in-progress':
          stats.inProgress = item.count;
          break;
        case 'completed':
          stats.completed = item.count;
          stats.completedRevenue = item.totalRevenue;
          break;
        case 'cancelled':
          stats.cancelled = item.count;
          break;
      }
    });

    // Get bookings in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBookings = await Booking.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get today's bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: today }
    });

    // Calculate average booking value
    const avgBookingValue = stats.totalBookings > 0 
      ? (stats.totalRevenue / stats.totalBookings).toFixed(2)
      : 0;

    // Calculate completion rate
    const completionRate = stats.totalBookings > 0
      ? ((stats.completed / stats.totalBookings) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentBookings: {
          last30Days: recentBookings,
          today: todayBookings
        },
        avgBookingValue: parseFloat(avgBookingValue),
        completionRate: parseFloat(completionRate)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking overview',
      error: error.message
    });
  }
};

