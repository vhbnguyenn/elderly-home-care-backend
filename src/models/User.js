const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ROLES } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Không trả về password khi query
    },
    role: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.CAREGIVER, ROLES.CARESEEKER],
      required: [true, 'Please provide a role']
    },
    phone: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    verificationCode: {
      type: String,
      select: false
    },
    verificationCodeExpire: {
      type: Date,
      select: false
    },
    resetPasswordCode: {
      type: String,
      select: false
    },
    resetPasswordCodeExpire: {
      type: Date,
      select: false
    },
    refreshToken: {
      type: String,
      select: false // Không trả về khi query
    }
  },
  {
    timestamps: true
  }
);

// Mã hóa password trước khi save (data encryption)
userSchema.pre('save', async function(next) {
  console.log('🔒 [Pre-save hook] Called for user:', this.email);
  console.log('🔒 [Pre-save hook] isModified("password"):', this.isModified('password'));
  console.log('🔒 [Pre-save hook] Modified paths:', this.modifiedPaths());
  
  if (!this.isModified('password')) {
    console.log('🔒 [Pre-save hook] Password not modified, skipping hash');
    return next(); // ✅ Phải return để dừng execution
  }
  
  console.log('🔒 [Pre-save hook] Password IS modified, hashing...');
  console.log('🔒 [Pre-save hook] Password before hash (first 20 chars):', this.password?.substring(0, 20));
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  
  console.log('🔒 [Pre-save hook] Password after hash (first 20 chars):', this.password?.substring(0, 20));
  next();
});

// So sánh password
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Tạo JWT token
userSchema.methods.generateToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '1h' 
    }
  );
};

// Tạo Refresh Token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' 
    }
  );
};

// Tạo Verification Code (6 số)
userSchema.methods.generateVerificationCode = function() {
  // Tạo mã 6 số ngẫu nhiên
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Lưu mã và thời gian hết hạn (30 phút - tăng từ 10 phút để dễ test)
  this.verificationCode = code;
  this.verificationCodeExpire = Date.now() + 30 * 60 * 1000; // 30 phút
  
  return code;
};

// Tạo Reset Password Code (6 số)
userSchema.methods.generateResetPasswordCode = function() {
  // Tạo mã 6 số ngẫu nhiên
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Lưu mã và thời gian hết hạn (10 phút)
  this.resetPasswordCode = code;
  this.resetPasswordCodeExpire = Date.now() + 10 * 60 * 1000; // 10 phút
  
  return code;
};

module.exports = mongoose.model('User', userSchema);
