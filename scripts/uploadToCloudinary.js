require('dotenv').config();
const cloudinary = require('../src/config/cloudinary');
const fs = require('fs');
const path = require('path');

const uploadFolder = path.join(__dirname, '../uploads');

const uploadToCloudinary = async () => {
  try {
    console.log('🚀 Starting upload to Cloudinary...');

    // Kiểm tra folder uploads có tồn tại không
    if (!fs.existsSync(uploadFolder)) {
      console.log('✅ No uploads folder found. Nothing to upload.');
      return;
    }

    // Đọc tất cả file trong uploads
    const files = fs.readdirSync(uploadFolder);
    
    if (files.length === 0) {
      console.log('✅ No files to upload.');
      return;
    }

    console.log(`📁 Found ${files.length} files to upload`);

    let successCount = 0;
    let errorCount = 0;

    // Upload từng file
    for (const file of files) {
      const filePath = path.join(uploadFolder, file);
      
      // Chỉ upload file, bỏ qua folder
      if (fs.statSync(filePath).isFile()) {
        try {
          const result = await cloudinary.uploader.upload(filePath, {
            folder: 'elderly-care',
            resource_type: 'auto'
          });
          
          console.log(`✅ Uploaded: ${file} -> ${result.secure_url}`);
          
          // Xóa file local sau khi upload thành công
          fs.unlinkSync(filePath);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to upload ${file}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Upload completed!`);
    console.log(`   Success: ${successCount} files`);
    console.log(`   Failed: ${errorCount} files`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Xóa folder uploads nếu rỗng
    const remainingFiles = fs.readdirSync(uploadFolder);
    if (remainingFiles.length === 0) {
      fs.rmdirSync(uploadFolder);
      console.log('🗑️  Removed empty uploads folder');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

uploadToCloudinary();
