import express from 'express';
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
import userRoutes from './routes/users.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { 
  helmetConfig, 
  corsOptions, 
  apiLimiter, 
  authLimiter, 
  deviceRegisterLimiter,
  auditLogger 
} from './middleware/security.js';
import logger from './utils/logger.js';
import cors from 'cors';
import supabase from './config/database.js';

// Import WebSocket handler
import { setupWebSocket } from './websocket/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers (Helmet)
app.use(helmetConfig);

// CORS with whitelist
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
  next();
});

// Audit logging (logs all mutation operations)
app.use(auditLogger(supabase));

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

// API health check (for firmware)
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes with rate limiting and security
app.use('/api/v1/auth', authLimiter, authRoutes); // Stricter rate limit for auth
app.use('/api/v1/devices/register', deviceRegisterLimiter); // Rate limit device registration
app.use('/api/v1', apiLimiter); // General API rate limiter
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/users', userRoutes);

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
  // Listen on 0.0.0.0 to accept connections from all network interfaces (ESP32, etc.)
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 WebSocket available at ws://localhost:${PORT}/api/v1/live`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🌐 Accepting connections from all interfaces (0.0.0.0)`);
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
