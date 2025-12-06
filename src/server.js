require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/db');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');
const { initializeSocket } = require('./config/socket');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const caregiverRoutes = require('./routes/caregiverRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const walletRoutes = require('./routes/walletRoutes');
const packageRoutes = require('./routes/packageRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const chatRoutes = require('./routes/chatRoutes');
const caregiverReviewRoutes = require('./routes/caregiverReviewRoutes');
const careseekerReviewRoutes = require('./routes/careseekerReviewRoutes');
const videoFeedbackRoutes = require('./routes/videoFeedbackRoutes');
const systemFeedbackRoutes = require('./routes/systemFeedbackRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const videoCallRoutes = require('./routes/videoCallRoutes');
const caregiverAvailabilityRoutes = require('./routes/caregiverAvailabilityRoutes');
const caregiverSkillRoutes = require('./routes/caregiverSkillRoutes');
const courseRoutes = require('./routes/courseRoutes');
const { startWalletCronJob } = require('./utils/walletCron');
const { initializeFirebase } = require('./utils/fcmHelper');

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS Configuration
app.use(cors({
  origin: '*', // Allow all origins (for mobile app)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible globally and in routes
global.io = io;
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/caregiver-reviews', caregiverReviewRoutes);
app.use('/api/careseeker-reviews', careseekerReviewRoutes);
app.use('/api/video-feedback', videoFeedbackRoutes);
app.use('/api/system-feedback', systemFeedbackRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/video-calls', videoCallRoutes);
app.use('/api/caregiver-availability', caregiverAvailabilityRoutes);
app.use('/api/caregiver-skills', caregiverSkillRoutes);
app.use('/api/courses', courseRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Elderly Home Care API',
    version: '1.0.0',
    endpoints: {
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
    
    // Initialize Socket.IO
    initializeSocket(io);
    
    // Start wallet cron job
    startWalletCronJob();
    
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔌 Socket.IO is ready for real-time chat & video calls`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
