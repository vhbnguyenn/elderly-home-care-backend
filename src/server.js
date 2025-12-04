require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/db');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const caregiverRoutes = require('./routes/caregiverRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const elderlyRoutes = require('./routes/elderlyRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const walletRoutes = require('./routes/walletRoutes');
const packageRoutes = require('./routes/packageRoutes');
const { startWalletCronJob } = require('./utils/walletCron');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/caregiver', caregiverRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/elderly', elderlyRoutes);
app.use('/api/profiles', elderlyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/packages', packageRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Elderly Home Care API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      caregiver: {
        createProfile: 'POST /api/caregiver/profile',
        getMyProfile: 'GET /api/caregiver/profile',
        updateProfile: 'PUT /api/caregiver/profile',
        getAllProfiles: 'GET /api/caregiver/profiles (Admin)',
        getProfileDetail: 'GET /api/caregiver/profile/:id/admin (Admin)',
        updateStatus: 'PUT /api/caregiver/profile/:id/status (Admin)'
      },
      booking: {
        getCaregiverBookings: 'GET /api/bookings/caregiver',
        getCareseekerBookings: 'GET /api/bookings/careseeker',
        getDetail: 'GET /api/bookings/:id',
        getAllBookings: 'GET /api/bookings/all (Admin)',
        updateStatus: 'PUT /api/bookings/:id/status'
      },
      elderly: {
        create: 'POST /api/elderly',
        getMyProfiles: 'GET /api/elderly',
        getDetail: 'GET /api/elderly/:id',
        update: 'PUT /api/elderly/:id',
        delete: 'DELETE /api/elderly/:id'
      },
      bookingFlow: {
        searchCaregivers: 'POST /api/caregivers/search',
        getCaregiverDetail: 'GET /api/caregivers/:caregiverId',
        getCaregiverReviews: 'GET /api/reviews/caregiver/:caregiverId',
        getElderlyProfiles: 'GET /api/profiles/care-seeker',
        createBooking: 'POST /api/bookings'
      },
      payment: {
        generateQR: 'POST /api/payments/generate-qr/:bookingId',
        confirmPayment: 'POST /api/payments/confirm/:bookingId',
        getPaymentInfo: 'GET /api/payments/:bookingId',
        vnpayCallback: 'GET /api/payments/vnpay/callback'
      }
    }
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Start wallet cron job
    startWalletCronJob();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
