require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants');

const createAdmin = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Thông tin admin
    const adminData = {
      name: 'Admin',
      email: 'admin@gmail.com',
      password: '123123',
      role: ROLES.ADMIN,
      isEmailVerified: true // Admin không cần verify email
    };

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('⚠️  Admin already exists');
      console.log('Email:', existingAdmin.email);
      process.exit(0);
    }

    // Tạo admin mới
    const admin = await User.create(adminData);
    
    console.log('🎉 Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: 123123');
    console.log('👤 Role:', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
