const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình Cloudinary Storage cho ảnh
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'elderly-care', // Folder trên Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Resize ảnh
  }
});

// Cấu hình Cloudinary Storage cho video
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'elderly-care/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'],
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }
    ]
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

// Cấu hình Cloudinary Storage cho documents/resources
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'elderly-care/resources',
    resource_type: 'auto',
    allowed_formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'mp4', 'mov', 'zip']
  }
});

// Cấu hình upload video với giới hạn 100MB
const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // Giới hạn 100MB
  }
});

// Middleware cho course (thumbnail + instructor avatar)
const uploadCourse = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'instructorAvatar', maxCount: 1 }
]);

// Middleware cho course với resources
const uploadCourseWithResources = multer({
  storage: documentStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB per file
  }
}).fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'instructorAvatar', maxCount: 1 },
  { name: 'resources', maxCount: 50 }
]);

// Middleware cho upload single image - Optional
const uploadSingleOptional = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadSingle(req, res, next);
  }
  next();
};

// Middleware cho course - Optional
const uploadCourseOptional = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadCourse(req, res, next);
  }
  next();
};

// Middleware cho video - Optional
const uploadVideoOptional = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadVideo.single('video')(req, res, next);
  }
  next();
};

// Middleware cho upload feedback images (tối đa 5 ảnh)
const uploadFeedbackImages = upload.array('images', 5);

const uploadFeedbackImagesOptional = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return uploadFeedbackImages(req, res, next);
  }
  next();
};

module.exports = {
  upload,
  uploadCaregiverProfile,
  uploadCaregiverProfileOptional,
  uploadSingle,
  uploadSingleOptional,
  uploadElderlyAvatar,
  uploadElderlyAvatarOptional,
  uploadVideo,
  uploadVideoOptional,
  uploadCourse,
  uploadCourseOptional,
  uploadCourseWithResources,
  uploadFeedbackImages,
  uploadFeedbackImagesOptional
};
