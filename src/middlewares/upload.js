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
  { name: 'profileImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 10 } // Tối đa 10 chứng chỉ
]);

// Middleware cho upload single image (check-in, v.v.)
const uploadSingle = upload.single('verificationImage');

module.exports = {
  upload,
  uploadCaregiverProfile,
  uploadSingle
};
