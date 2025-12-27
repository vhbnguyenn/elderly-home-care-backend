const User = require('../models/User');
const { verifyRefreshToken } = require('../utils/tokenHelper');
const { sendVerificationCode, sendWelcomeEmail, sendResetPasswordCode } = require('../utils/sendEmail');

/**
 * @desc    Đăng ký tài khoản mới
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký'
      });
    }

    // Tạo user mới (password sẽ tự động được mã hóa nhờ pre-save hook)
    // Name là optional, nếu không có sẽ dùng email prefix hoặc để trống
    const user = await User.create({
      name: name || '',
      email: normalizedEmail,
      password,
      role,
      phone
    });

    // Tạo mã verification code (6 số)
    user.generateVerificationCode();
    console.log('📧 [Register] Generated code (before save):', user.verificationCode);
    console.log('📧 [Register] User email:', user.email);
    
    await user.save();
    
    // ✅ Fetch lại user để đảm bảo lấy đúng code từ DB
    const savedUser = await User.findById(user._id).select('+verificationCode');
    const verificationCode = savedUser.verificationCode;
    
    console.log('📧 [Register] Code from DB after save:', verificationCode);

    // Gửi email verification code
    // Dùng email làm tên tạm nếu chưa có name
    const displayName = user.name || user.email.split('@')[0];
    try {
      await sendVerificationCode(user.email, displayName, verificationCode);
      console.log('✅ [Register] Email sent with code:', verificationCode);
    } catch (error) {
      console.error('❌ [Register] Failed to send verification code:', error);
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
      message: 'Đăng ký thành công!',
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
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user và include password (vì mặc định select: false)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      console.log('❌ User not found:', normalizedEmail);
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    console.log('✅ User found:', {
      email: user.email,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      hasPassword: !!user.password
    });

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      console.log('❌ Account inactive');
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị vô hiệu hóa'
      });
    }

    // Kiểm tra email đã verify chưa
    if (!user.isEmailVerified) {
      console.log('❌ Email not verified');
      return res.status(403).json({
        success: false,
        message: 'Vui lòng xác minh email trước khi đăng nhập'
      });
    }

    // So sánh password
    console.log('🔍 Comparing password...');
    const isPasswordMatch = await user.comparePassword(password);
    console.log('🔍 Password match result:', isPasswordMatch);

    if (!isPasswordMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    console.log('✅ Login successful');

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
      message: 'Đăng nhập thành công',
      data: {
        user: userResponse,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
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
      data: user || null
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

    if (user) {
      // Update fields if provided
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      
      // Update email if provided (không check duplicate)
      if (email !== undefined && email !== user.email) {
        user.email = email;
        user.isEmailVerified = false; // Need to verify new email
      }

      await user.save({ runValidators: false });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công',
      data: user || null
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

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ hoặc đã hết hạn'
      });
    }

    // Tìm user và kiểm tra refresh token có khớp không
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị vô hiệu hóa'
      });
    }

    // Tạo access token mới
    const newAccessToken = user.generateToken();

    // CRITICAL: Return both accessToken and refreshToken
    res.status(200).json({
      success: true,
      message: 'Làm mới token thành công',
      data: {
        accessToken: newAccessToken,
        refreshToken: refreshToken // Return the same refresh token
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
      message: 'Đăng xuất thành công'
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

    console.log('🔍 Verify code request:', { email, code, codeType: typeof code });

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user với email trước để debug
    const userByEmail = await User.findOne({ email: normalizedEmail })
      .select('+verificationCode +verificationCodeExpire');

    if (!userByEmail) {
      console.log('❌ User not found with email:', normalizedEmail);
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy người dùng với email này'
      });
    }

    console.log('✅ User found:', {
      email: userByEmail.email,
      storedCode: userByEmail.verificationCode,
      storedCodeType: typeof userByEmail.verificationCode,
      receivedCode: code,
      receivedCodeType: typeof code,
      codeExpire: userByEmail.verificationCodeExpire,
      now: Date.now(),
      isExpired: userByEmail.verificationCodeExpire < Date.now()
    });

    // Convert both codes to string for comparison
    const storedCode = String(userByEmail.verificationCode || '');
    const receivedCode = String(code || '').trim();

    console.log('🔍 String comparison:', {
      storedCode,
      receivedCode,
      match: storedCode === receivedCode
    });

    // Check expiry with detailed logging
    const now = Date.now();
    const expireTime = userByEmail.verificationCodeExpire;
    const timeRemaining = expireTime ? (expireTime - now) / 1000 / 60 : 0; // minutes

    console.log('⏰ Expiry check:', {
      expireTime: new Date(expireTime),
      now: new Date(now),
      timeRemainingMinutes: timeRemaining.toFixed(2),
      isExpired: !expireTime || expireTime < now
    });

    if (!expireTime || expireTime < now) {
      console.log('❌ Code expired');
      return res.status(400).json({
        success: false,
        message: 'Mã xác minh đã hết hạn. Vui lòng yêu cầu mã mới.',
        debug: process.env.NODE_ENV === 'development' ? {
          expireTime: new Date(expireTime),
          now: new Date(now),
          timeRemainingMinutes: timeRemaining.toFixed(2)
        } : undefined
      });
    }

    // Check code match
    if (storedCode !== receivedCode) {
      console.log('❌ Code mismatch');
      return res.status(400).json({
        success: false,
        message: 'Mã xác minh không đúng'
      });
    }

    const user = userByEmail;

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
      message: 'Xác minh email thành công',
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

    // Trim và lowercase email
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được xác minh'
      });
    }

    // Tạo code mới (sẽ OVERWRITE code cũ)
    user.generateVerificationCode();
    
    console.log('📧 [Resend] Generated code (before save):', user.verificationCode);
    
    // Mark fields as modified (vì có select: false)
    user.markModified('verificationCode');
    user.markModified('verificationCodeExpire');
    
    // Force save với validation disabled
    try {
      await user.save({ validateBeforeSave: false });
      console.log('✅ [Resend] User saved successfully with new code');
    } catch (saveError) {
      console.error('❌ [Resend] Error saving user:', saveError);
      throw saveError;
    }

    // ✅ Fetch lại từ DB để đảm bảo code chính xác
    const verifiedUser = await User.findById(user._id).select('+verificationCode +verificationCodeExpire');
    const verificationCode = verifiedUser.verificationCode;
    
    console.log('📧 [Resend] Code from DB after save:', verificationCode);
    console.log('📧 [Resend] Code match check:', {
      email: user.email,
      storedCodeInDB: verificationCode,
      expireTime: new Date(verifiedUser.verificationCodeExpire)
    });

    // Gửi email
    try {
      await sendVerificationCode(user.email, user.name, verificationCode);
      console.log('✅ [Resend] Email sent with code:', verificationCode);
      
      // In ra console trong dev mode để dễ debug
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEV MODE] NEW Verification Code:', verificationCode);
        console.log('📧 Email:', user.email);
      }
    } catch (error) {
      console.error('❌ [Resend] Failed to send verification email:', error);
      return res.status(500).json({
        success: false,
        message: 'Gửi mã xác minh thất bại'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gửi mã xác minh mới',
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

    const user = await User.findOne({ email });

    if (!user) {
      // Không tiết lộ email có tồn tại hay không (bảo mật)
      return res.status(200).json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được mã đặt lại mật khẩu trong ít phút'
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
        message: 'Gửi mã đặt lại mật khẩu thất bại'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã gửi mã đặt lại mật khẩu đến email của bạn'
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
    const { email, code, newPassword, verifyOnly } = req.body;

    // Tìm user với email và code
    const user = await User.findOne({
      email,
      resetPasswordCode: code
    }).select('+resetPasswordCode +resetPasswordCodeExpire +password');

    // Kiểm tra xem có tìm thấy request reset password không
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu đặt lại mật khẩu'
      });
    }

    // Kiểm tra code có hết hạn không
    if (user.resetPasswordCodeExpire < Date.now()) {
      return res.status(410).json({
        success: false,
        message: 'Mã xác thực đã hết hạn'
      });
    }

    // Kiểm tra code có đúng không
    if (user.resetPasswordCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác thực không hợp lệ'
      });
    }

    // Nếu chỉ verify code
    if (verifyOnly) {
      return res.status(200).json({
        success: true,
        message: 'Mã xác thực hợp lệ'
      });
    }

    // Cập nhật password mới
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordCodeExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'
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
    const { currentPassword, newPassword } = req.body;

    // Get user with password field
    const user = await User.findById(req.user.id).select('+password');

    if (user && newPassword) {
      // Update password (không check current password)
      user.password = newPassword;
      await user.save({ runValidators: false });
    }

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
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

    // Cannot block admin accounts (authorization check - giữ lại)
    if (user && user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không thể khóa tài khoản admin'
      });
    }

    // Toggle isActive status
    if (user) {
      user.isActive = !user.isActive;
      await user.save({ runValidators: false });
    }

    const statusMessage = user && user.isActive ? 'kích hoạt' : 'khóa';

    res.status(200).json({
      success: true,
      message: user ? `Tài khoản đã được ${statusMessage} thành công` : 'Không tìm thấy người dùng',
      data: user ? {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      } : null
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

    // Create user (không validate, không check email duplicate)
    const user = await User.create({
      name: name || (email ? email.split('@')[0] : 'User'),
      email: email || '',
      password: password || '',
      role: role || 'careseeker',
      phone: phone || '',
      isEmailVerified: true, // Admin-created accounts are auto-verified
      isActive: true
    }, { runValidators: false, strict: false });

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
      message: 'Tạo tài khoản thành công',
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

    // Admin cannot deactivate their own account via this endpoint (authorization check - giữ lại)
    if (user && user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản admin không thể tự vô hiệu hóa bằng chức năng này'
      });
    }

    // Deactivate account (không check đã deactivate chưa)
    if (user) {
      user.isActive = false;
      await user.save({ runValidators: false });
    }

    res.status(200).json({
      success: true,
      message: 'Tài khoản của bạn đã được vô hiệu hóa thành công. Vui lòng liên hệ admin để kích hoạt lại.',
      data: user ? {
        userId: user._id,
        email: user.email,
        isActive: user.isActive
      } : null
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

    res.status(200).json({
      success: true,
      data: user || null
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user by ID (Admin only)
 * @route   PUT /api/profiles/users/:userId
 * @access  Private (Admin only)
 */
const updateUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive, isEmailVerified } = req.body;

    // Tìm user cần update
    const user = await User.findById(userId);

    // Không cho phép admin tự thay đổi role của chính mình (authorization check - giữ lại)
    if (user && userId === req.user.id && role !== undefined && role !== user.role) {
      return res.status(403).json({
        success: false,
        message: 'Không thể thay đổi role của chính mình'
      });
    }

    if (user) {
      // Cập nhật email nếu có (không check duplicate)
      if (email !== undefined && email !== user.email) {
        user.email = email.trim().toLowerCase();
      }

      // Cập nhật các field được cung cấp
      if (name !== undefined) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (role !== undefined) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;

      await user.save({ runValidators: false });
    }

    // Trả về user đã update (không bao gồm sensitive data)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin người dùng thành công',
      data: user ? {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      } : null
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
  updateUserByAdmin,
  deactivateOwnAccount,
  refreshToken,
  logout,
  verifyCode,
  resendVerification,
  forgotPassword,
  resetPassword
};
