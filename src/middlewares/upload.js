const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'elderly-care', // Folder trên Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Resize ảnh
  }
});

// File filter - chỉ cho phép upload ảnh
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png) are allowed!'));
  }
};

// Cấu hình upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Giới hạn 5MB
  },
  fileFilter: fileFilter
});

// Middleware cho caregiver profile với nhiều file
const uploadCaregiverProfile = upload.fields([
  { name: 'idCardFrontImage', maxCount: 1 },
  { name: 'idCardBackImage', maxCount: 1 },
  { name: 'universityDegreeImage', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }, // Avatar của caregiver
  { name: 'certificateImages', maxCount: 10 } // Tối đa 10 chứng chỉ
]);

// Middleware cho upload single image (check-in, v.v.)
const uploadSingle = upload.single('verificationImage');

// Middleware cho upload avatar người già
const uploadElderlyAvatar = upload.single('avatar');

// Middleware wrapper để chỉ upload khi là multipart/form-data
const uploadCaregiverProfileOptional = (req, res, next) => {
  // Chỉ chạy multer nếu content-type là multipart/form-data
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadCaregiverProfile(req, res, next);
  }
  // Nếu không phải multipart, bỏ qua và tiếp tục
  next();
};

const uploadElderlyAvatarOptional = (req, res, next) => {
  // Chỉ chạy multer nếu content-type là multipart/form-data
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadElderlyAvatar(req, res, next);
  }
  // Nếu không phải multipart, bỏ qua và tiếp tục
  next();
};

module.exports = {
  upload,
  uploadCaregiverProfile,
  uploadCaregiverProfileOptional,
  uploadSingle,
  uploadElderlyAvatar,
  uploadElderlyAvatarOptional
};
