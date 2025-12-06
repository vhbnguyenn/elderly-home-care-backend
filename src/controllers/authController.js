const User = require('../models/User');
const { registerSchema, loginSchema, resetPasswordSchema } = require('../utils/validation');
const { verifyRefreshToken } = require('../utils/tokenHelper');
const { sendVerificationCode, sendWelcomeEmail, sendResetPasswordCode } = require('../utils/sendEmail');

/**
 * @desc    Đăng ký tài khoản mới
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body, { 
      abortEarly: false 
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const { name, email, password, role, phone } = value;

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Tạo user mới (password sẽ tự động được mã hóa nhờ pre-save hook)
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      phone
    });

    // Tạo mã verification code (6 số)
    const verificationCode = user.generateVerificationCode();
    await user.save();

    // Gửi email verification code
    try {
      await sendVerificationCode(user.email, user.name, verificationCode);
    } catch (error) {
      console.error('Failed to send verification code:', error);
    }

    // Không trả về password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification code.',
      data: {
        user: userResponse,
        ...(process.env.NODE_ENV === 'development' && { debug_code: verificationCode })
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Đăng nhập
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { email, password } = value;

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user và include password (vì mặc định select: false)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Kiểm tra email đã verify chưa
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // So sánh password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Tạo access token và refresh token
    const accessToken = user.generateToken();
    const refreshToken = user.generateRefreshToken();

    // Lưu refresh token vào database
    user.refreshToken = refreshToken;
    await user.save();

    // Không trả về password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lấy thông tin user hiện tại
 * @route   GET /api/auth/me
 * @access  Private
 */
/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile (for careseeker and admin)
 * @route   PUT /api/auth/profile
 * @access  Private (Careseeker, Admin)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      user.email = email;
      user.isEmailVerified = false; // Need to verify new email
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Tìm user và kiểm tra refresh token có khớp không
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Tạo access token mới
    const newAccessToken = user.generateToken();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout - Xóa refresh token
 * @route   POST /api/auth/logout
 * @access  Private (cần access token)
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Xóa refresh token trong database
    await User.findByIdAndUpdate(userId, {
      refreshToken: null
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email với code
 * @route   POST /api/auth/verify-code
 * @access  Public
 */
const verifyCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user với email và code hợp lệ
    const user = await User.findOne({
      email: normalizedEmail,
      verificationCode: code,
      verificationCodeExpire: { $gt: Date.now() }
    }).select('+verificationCode +verificationCodeExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Cập nhật user: verify email và xóa code
    console.log('🔍 Before update:', { 
      email: user.email, 
      isEmailVerified: user.isEmailVerified 
    });
    
    // Force update với updateOne để đảm bảo lưu vào DB
    const updateResult = await User.updateOne(
      { _id: user._id },
      { 
        $set: { isEmailVerified: true },
        $unset: { verificationCode: 1, verificationCodeExpire: 1 }
      }
    );
    
    console.log('📝 Update result:', updateResult);
    
    if (updateResult.modifiedCount === 0) {
      console.error('⚠️  WARNING: No documents were modified!');
    }
    
    // Reload user từ DB để đảm bảo có data mới nhất
    const updatedUser = await User.findById(user._id);
    
    console.log('✅ After save:', { 
      email: updatedUser.email, 
      isEmailVerified: updatedUser.isEmailVerified,
      _id: updatedUser._id
    });

    // Gửi welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    // Tạo tokens cho user (dùng updatedUser)
    const accessToken = updatedUser.generateToken();
    const refreshToken = updatedUser.generateRefreshToken();
    
    await User.updateOne(
      { _id: updatedUser._id },
      { $set: { refreshToken: refreshToken } }
    );

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isEmailVerified: updatedUser.isEmailVerified
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification code
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Tạo code mới
    const verificationCode = user.generateVerificationCode();
    await user.save();

    // Gửi email
    try {
      await sendVerificationCode(user.email, user.name, verificationCode);
      
      // In ra console trong dev mode để dễ debug
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEV MODE] Verification Code:', verificationCode);
        console.log('📧 Email:', user.email);
      }
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
      ...(process.env.NODE_ENV === 'development' && { debug_code: verificationCode })
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password - Gửi mã reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Không tiết lộ email có tồn tại hay không (bảo mật)
      return res.status(200).json({
        success: true,
        message: 'If your email exists, you will receive a reset code shortly'
      });
    }

    // Tạo reset password code
    const resetCode = user.generateResetPasswordCode();
    await user.save();

    // Gửi email
    try {
      await sendResetPasswordCode(user.email, user.name, resetCode);
    } catch (error) {
      console.error('Failed to send reset code:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset code'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reset password code sent to your email'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password với code
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = resetPasswordSchema.validate(req.body);

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const { email, code, newPassword } = value;

    // Tìm user với code hợp lệ
    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordCodeExpire: { $gt: Date.now() }
    }).select('+resetPasswordCode +resetPasswordCodeExpire +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }

    // Cập nhật password mới
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password (for logged in users)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password, new password and confirm password'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password field
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user account status (Admin only)
 * @route   PUT /api/auth/users/:userId/toggle-status
 * @access  Private (Admin only)
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Cannot block admin accounts
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot block admin accounts'
      });
    }

    // Toggle isActive status
    user.isActive = !user.isActive;
    await user.save();

    const statusMessage = user.isActive ? 'activated' : 'blocked';

    res.status(200).json({
      success: true,
      message: `User account ${statusMessage} successfully`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/auth/users
 * @access  Private (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10, search } = req.query;

    const query = {};

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password -refreshToken -verificationCode -resetPasswordCode')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
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
 * @desc    Create user account (Admin only)
 * @route   POST /api/profiles/users
 * @access  Private (Admin only)
 */
const createUserByAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Validation
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'caregiver', 'careseeker'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: admin, caregiver, careseeker'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user
    const user = await User.create({
      name: name || email.split('@')[0],
      email,
      password,
      role,
      phone,
      isEmailVerified: true, // Admin-created accounts are auto-verified
      isActive: true
    });

    // Send welcome email (optional)
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: userResponse
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate own account (Caregiver & Careseeker only)
 * @route   PUT /api/profiles/deactivate
 * @access  Private (Caregiver, Careseeker)
 */
const deactivateOwnAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Admin cannot deactivate their own account via this endpoint
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be deactivated via this endpoint'
      });
    }

    // Check if already deactivated
    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account is already deactivated'
      });
    }

    // Deactivate account
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Your account has been deactivated successfully. Contact admin to reactivate.',
      data: {
        userId: user._id,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID (Admin only)
 * @route   GET /api/profiles/users/:userId
 * @access  Private (Admin only)
 */
const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password -refreshToken -verificationCode -resetPasswordCode');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  toggleUserStatus,
  getAllUsers,
  getUserById,
  createUserByAdmin,
  deactivateOwnAccount,
  refreshToken,
  logout,
  verifyCode,
  resendVerification,
  forgotPassword,
  resetPassword
};
