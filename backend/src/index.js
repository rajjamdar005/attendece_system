import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import employeeRoutes from './routes/employees.js';
import tagRoutes from './routes/tags.js';
import deviceRoutes from './routes/devices.js';
import attendanceRoutes from './routes/attendance.js';
import reportRoutes from './routes/reports.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter, deviceRateLimiter } from './middleware/rateLimiter.js';
import logger from './utils/logger.js';

// Import WebSocket handler
import { setupWebSocket } from './websocket/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// =====================================================
// ROUTES
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/v1/auth', rateLimiter, authRoutes);
app.use('/api/v1/companies', rateLimiter, companyRoutes);
app.use('/api/v1/employees', rateLimiter, employeeRoutes);
app.use('/api/v1/tags', rateLimiter, tagRoutes);
app.use('/api/v1/devices', deviceRateLimiter, deviceRoutes);
app.use('/api/v1/attendance', rateLimiter, attendanceRoutes);
app.use('/api/v1/reports', rateLimiter, reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.path,
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// =====================================================
// SERVER SETUP WITH WEBSOCKET
// =====================================================

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/v1/live' });

setupWebSocket(wss);

// Start server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 WebSocket available at ws://localhost:${PORT}/api/v1/live`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
