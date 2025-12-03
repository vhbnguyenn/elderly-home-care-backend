require('dotenv').config();
const mongoose = require('mongoose');
const CaregiverProfile = require('../src/models/CaregiverProfile');
const cloudinary = require('../src/config/cloudinary');

const migrateImagesToCloudinary = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Lấy tất cả profiles
    const profiles = await CaregiverProfile.find({});
    console.log(`📁 Found ${profiles.length} profiles to migrate`);

    if (profiles.length === 0) {
      console.log('✅ No profiles to migrate');
      process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        console.log(`\n🔄 Migrating profile: ${profile._id}`);
        
        const updates = {};

        // Các field cần migrate
        const imageFields = [
          'idCardFrontImage',
          'idCardBackImage',
          'universityDegreeImage',
          'profileImage'
        ];

        // Migrate từng field
        for (const field of imageFields) {
          if (profile[field] && profile[field].startsWith('/uploads/')) {
            // Field này vẫn là local path, cần bỏ qua vì file đã xóa
            console.log(`   ⚠️  Skipping ${field}: local file already deleted`);
            updates[field] = null; // Set null vì file không còn
          }
        }

        // Migrate certificates
        if (profile.certificates && profile.certificates.length > 0) {
          updates.certificates = profile.certificates.map(cert => {
            if (cert.certificateImage && cert.certificateImage.startsWith('/uploads/')) {
              console.log(`   ⚠️  Certificate image: local file already deleted`);
              return {
                ...cert.toObject(),
                certificateImage: null
              };
            }
            return cert;
          });
        }

        // Update nếu có thay đổi
        if (Object.keys(updates).length > 0) {
          await CaregiverProfile.findByIdAndUpdate(profile._id, updates);
          console.log(`   ✅ Updated profile ${profile._id}`);
          successCount++;
        } else {
          console.log(`   ℹ️  No migration needed`);
        }

      } catch (error) {
        console.error(`   ❌ Error migrating profile ${profile._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migration completed!`);
    console.log(`   Success: ${successCount} profiles`);
    console.log(`   Errors: ${errorCount} profiles`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  NOTE: Old local image URLs have been set to null.');
    console.log('   Users will need to re-upload their images.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

migrateImagesToCloudinary();
