import dotenv from 'dotenv';

// Ensure environment variables are loaded before anything else
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB, disconnectDB, isDatabaseConnected, getDatabaseStatus } from './db.js';
import authRoutes from './routes/authRoutes.js';
import movieRoutes from './routes/movieRoutes.js';
import theatreRoutes from './routes/theatreRoutes.js';
import showtimeRoutes from './routes/showtimeRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

// Initialize Express application
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

// Capture raw body for Razorpay webhook HMAC verification BEFORE the global JSON parser
// The route-level middleware in bookingRoutes.js would never see the raw bytes because
// global app.use(express.json()) consumes the stream first — so we intercept it here.
app.use('/api/bookings/payment/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing middleware
app.use(cookieParser());

// Health check endpoint reporting actual database connectivity
app.get('/api/health', (req, res) => {
  const dbConnected = isDatabaseConnected();
  const dbStatus = getDatabaseStatus();

  const responsePayload = {
    status: dbConnected ? 'ok' : 'unhealthy',
    message: dbConnected
      ? 'iMovies API is running and database is connected'
      : 'Database is disconnected or unavailable',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbConnected,
      state: dbStatus.state,
    },
  };

  const statusCode = dbConnected ? 200 : 503;
  res.status(statusCode).json(responsePayload);
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Movie routes
app.use('/api/movies', movieRoutes);

// Theatre routes
app.use('/api/theatres', theatreRoutes);

// Showtime routes
app.use('/api/showtimes', showtimeRoutes);

// Booking routes
app.use('/api/bookings', bookingRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}. Please use another value.`;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // Handle invalid ObjectId cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found or invalid format: ${err.path}`;
  }

  console.error(`[Error] ${err.name || 'ServerError'}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Port configuration
const PORT = process.env.PORT || 5000;

let server = null;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await disconnectDB();
        console.log('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing database connection during shutdown:', err);
        process.exit(1);
      }
    });

    // Force exit if shutdown takes too long (10s)
    setTimeout(() => {
      console.error('Forcing shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  } else {
    try {
      await disconnectDB();
    } finally {
      process.exit(0);
    }
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Initializes database connection and starts HTTP server.
 * Awaits MongoDB connection before accepting requests, exiting if connection fails.
 */
export const startServer = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`🎬 iMovies Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      console.log(`🩺 Health check available at http://localhost:${PORT}/api/health`);
    });

    return server;
  } catch (error) {
    console.error(`💥 Failed to start server: Required database connection failed - ${error.message}`);
    process.exit(1);
  }
};

// Start server if this file is executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server };
export default app;
