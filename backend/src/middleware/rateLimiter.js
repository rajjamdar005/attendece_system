import rateLimit from 'express-rate-limit';

// Rate limiter for admin/user endpoints
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for device endpoints (more lenient)
export const deviceRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_DEVICE_MAX) || 300,
  message: {
    success: false,
    error: {
      code: 'DEVICE_RATE_LIMIT_EXCEEDED',
      message: 'Device rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use device UUID or IP if available
    return req.device?.device_uuid || req.ip;
  },
});
