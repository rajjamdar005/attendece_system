import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';

/**
 * Rate Limiting Configuration
 * Protects against brute force attacks
 */

// General API rate limiter (100 requests per 15 minutes per IP)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased for development)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs (increased for development)
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count even successful requests
});

// Device registration rate limiter (prevent spam device registrations)
export const deviceRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 device registrations per hour
  message: {
    success: false,
    message: 'Too many device registrations from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CORS Configuration
 * Whitelist allowed origins
 */
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // Add production origins here:
  // 'https://yourdomain.com',
];

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // Cache preflight request for 10 minutes
};

/**
 * Helmet Configuration
 * Sets various HTTP headers for security
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Audit Log Middleware
 * Logs all mutation operations (POST, PUT, DELETE)
 */
export const auditLogger = (supabase) => async (req, res, next) => {
  // Only log mutation operations
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Skip audit logging for certain endpoints
  const skipPaths = ['/api/v1/auth/login', '/api/v1/devices/register', '/api/v1/devices/event'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Store original send
  const originalSend = res.send;

  res.send = function (data) {
    // Only log successful operations (200-299 status codes)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const { id: user_id } = req.user;

      // Extract resource info from path
      const pathParts = req.path.split('/');
      const resource_type = pathParts[3] || 'unknown'; // e.g., /api/v1/employees -> 'employees'
      const resource_id = pathParts[4] || null; // e.g., /api/v1/employees/123 -> '123'

      // Determine action
      let action = 'unknown';
      if (req.method === 'POST') action = 'create';
      else if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
      else if (req.method === 'DELETE') action = 'delete';

      // Get IP address
      const ip_address = req.ip || req.connection.remoteAddress;

      // Log to audit_logs table (async, don't wait)
      supabase
        .from('audit_logs')
        .insert({
          user_id,
          action,
          resource_type,
          resource_id,
          ip_address,
          user_agent: req.headers['user-agent'],
          request_body: req.method === 'POST' || req.method === 'PUT' ? req.body : null,
        })
        .then(() => {
          console.log(`[AUDIT] ${user_id} ${action} ${resource_type}${resource_id ? '/' + resource_id : ''}`);
        })
        .catch(err => {
          console.error('[AUDIT] Failed to log:', err.message);
        });
    }

    originalSend.call(this, data);
  };

  next();
};
