const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ROLES } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
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
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
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
  
  // Lưu mã và thời gian hết hạn (10 phút)
  this.verificationCode = code;
  this.verificationCodeExpire = Date.now() + 10 * 60 * 1000; // 10 phút
  
  return code;
};

module.exports = mongoose.model('User', userSchema);
