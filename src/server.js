const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not defined in .env');
  }

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);

    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:');
    console.error(error);
    throw error;
  }
};

module.exports = connectDB;
