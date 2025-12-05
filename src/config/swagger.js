const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Elderly Home Care API',
      version: '1.0.0',
      description: 'API để quản lý đặt lịch chăm sóc người già',
      contact: {
        name: 'API Support',
        email: 'support@elderlyhomecare.com'
      }
    },
    servers: [
      {
        url: 'https://elderly-home-care-backend.onrender.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js'] // Đường dẫn tới các file có JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
