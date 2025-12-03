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
const aiRoutes = require('./routes/aiRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/caregiver', caregiverRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/elderly', elderlyRoutes);
app.use('/api/ai', aiRoutes);

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
      ai: {
        chatbot: 'POST /api/ai/chatbot',
        recommendCaregiver: 'POST /api/ai/recommend-caregiver',
        generateCareplan: 'POST /api/ai/generate-careplan',
        analyzeHealth: 'POST /api/ai/analyze-health'
      }
    }
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
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
