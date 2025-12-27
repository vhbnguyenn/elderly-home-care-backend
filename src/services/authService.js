const User = require('../models/User');
const crypto = require('crypto');

/**
 * Generate verification code (6 digits)
 * @returns {string}
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate reset password token
 * @returns {string}
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash verification code for storage
 * @param {string} code 
 * @returns {string}
 */
const hashCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify code matches hashed version
 * @param {string} code - Plain code
 * @param {string} hashedCode - Hashed code
 * @returns {boolean}
 */
const verifyCode = (code, hashedCode) => {
  const hash = hashCode(code);
  return hash === hashedCode;
};

/**
 * Check if verification code is expired
 * @param {Date} expiresAt 
 * @returns {boolean}
 */
const isCodeExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};

/**
 * Create verification code with expiry
 * @param {number} expiryMinutes - Expiry time in minutes (default 10)
 * @returns {Object} - { code, hashedCode, expiresAt }
 */
const createVerificationCode = (expiryMinutes = 10) => {
  const code = generateVerificationCode();
  const hashedCode = hashCode(code);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  return {
    code,
    hashedCode,
    expiresAt
  };
};

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Normalize email (trim and lowercase)
 * @param {string} email 
 * @returns {string}
 */
const normalizeEmail = (email) => {
  return email.trim().toLowerCase();
};

/**
 * Check if user exists by email
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
const userExistsByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  return !!user;
};

/**
 * Find user by email
 * @param {string} email 
 * @returns {Promise<User|null>}
 */
const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  return await User.findOne({ email: normalizedEmail });
};

/**
 * Generate tokens for user (access + refresh)
 * @param {Object} user - User object
 * @returns {Object} - { accessToken, refreshToken }
 */
const generateTokens = (user) => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  
  return {
    accessToken,
    refreshToken
  };
};

/**
 * Sanitize user data for response (remove sensitive fields)
 * @param {Object} user - User object
 * @returns {Object} - Sanitized user
 */
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.verificationCode;
  delete userObj.verificationCodeExpires;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpires;
  delete userObj.__v;
  
  return userObj;
};

module.exports = {
  generateVerificationCode,
  generateResetToken,
  hashCode,
  verifyCode,
  isCodeExpired,
  createVerificationCode,
  isValidEmail,
  normalizeEmail,
  userExistsByEmail,
  findUserByEmail,
  generateTokens,
  sanitizeUser,
};




