const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware xác thực JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Lấy token từ header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Kiểm tra token có tồn tại không
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Bạn không có quyền truy cập'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Lấy thông tin user từ database
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Kiểm tra user có active không
      if (!req.user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị vô hiệu hóa'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware kiểm tra role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Vai trò '${req.user.role}' không được phép truy cập`
      });
    }
    next();
  };
};

/**
 * Middleware xác thực JWT token (Optional)
 * Nếu có token thì verify và set req.user, nếu không có thì tiếp tục (không bắt buộc)
 */
const protectOptional = async (req, res, next) => {
  try {
    let token;

    // Lấy token từ header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Nếu không có token, tiếp tục (không bắt buộc)
    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Lấy thông tin user từ database
      req.user = await User.findById(decoded.id).select('-password');

      if (req.user && !req.user.isActive) {
        // Nếu user bị vô hiệu hóa, không set req.user nhưng vẫn tiếp tục
        req.user = null;
      }

      next();
    } catch (error) {
      // Token không hợp lệ, nhưng vẫn tiếp tục (không bắt buộc)
      next();
    }
  } catch (error) {
    next();
  }
};

module.exports = { protect, authorize, protectOptional };
