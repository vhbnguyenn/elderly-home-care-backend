# Elderly Home Care Backend

Backend API for elderly home care management system built with Node.js, Express, and MongoDB.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas with Mongoose ODM
- **Middleware**: CORS, express.json()
- **Environment**: dotenv

## Project Structure

```
elderly-home-care-backend/
├── src/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── controllers/
│   │   └── healthController.js # Health check controller
│   ├── middlewares/
│   │   └── errorHandler.js     # Error handling middleware
│   ├── models/
│   │   └── User.js             # Example Mongoose model
│   ├── routes/
│   │   └── healthRoutes.js     # Health check routes
│   └── server.js               # Main entry point
├── .env                         # Environment variables (not in git)
├── .env.example                 # Environment template
├── .gitignore
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your MongoDB Atlas credentials:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

### 3. Run the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## API Endpoints

### Health Check
- **GET** `/health`
  - Returns server status and timestamp
  - Response: `{ status: "ok", message: "Server is running", timestamp: "..." }`

### Root
- **GET** `/`
  - Returns API information and available endpoints

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB Atlas connection string | Required |
| `NODE_ENV` | Environment (development/production) | `development` |

## Scripts

- `npm start` - Start server in production mode
- `npm run dev` - Start server in development mode with nodemon

## Features

✅ Express server with CORS enabled  
✅ MongoDB Atlas connection with Mongoose  
✅ Environment variable configuration  
✅ Centralized error handling  
✅ Health check endpoint  
✅ Example User model with validation  
✅ Modular project structure  
✅ Development auto-reload with nodemon

## Next Steps

1. Replace the placeholder in `.env` with your actual MongoDB Atlas URI
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the development server
4. Add more models, routes, and controllers as needed

## License

ISC
