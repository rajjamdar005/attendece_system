import { verifyToken } from '../utils/auth.js';
import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcrypt';

/**
 * Middleware to authenticate user JWT tokens
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // Fetch user from database to ensure still active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, company_id, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Middleware to authenticate device tokens
 */
export async function authenticateDevice(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_UNAUTHORIZED',
          message: 'Missing or invalid device token',
        },
      });
    }

    const token = authHeader.substring(7);

    // Query device tokens and match using bcrypt
    const { data: deviceTokens, error } = await supabase
      .from('device_tokens')
      .select(`
        id,
        device_id,
        token_hash,
        is_active,
        expires_at,
        devices (
          id,
          device_uuid,
          device_name,
          company_id,
          is_active
        )
      `)
      .eq('is_active', true);

    if (error || !deviceTokens || deviceTokens.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_UNAUTHORIZED',
          message: 'Invalid device token',
        },
      });
    }

    // Find matching token
    let matchedToken = null;
    for (const dt of deviceTokens) {
      const isMatch = await bcrypt.compare(token, dt.token_hash);
      if (isMatch) {
        matchedToken = dt;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_UNAUTHORIZED',
          message: 'Invalid device token',
        },
      });
    }

    // Check expiration
    if (matchedToken.expires_at && new Date(matchedToken.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_TOKEN_EXPIRED',
          message: 'Device token has expired',
        },
      });
    }

    // Check device is active
    if (!matchedToken.devices || !matchedToken.devices.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_INACTIVE',
          message: 'Device is not active',
        },
      });
    }

    // Update last_used timestamp
    await supabase
      .from('device_tokens')
      .update({ last_used: new Date().toISOString() })
      .eq('id', matchedToken.id);

    req.device = matchedToken.devices;
    next();
  } catch (error) {
    logger.error('Device authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'DEVICE_AUTH_ERROR',
        message: 'Device authentication failed',
      },
    });
  }
}

/**
 * Middleware to check user role
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
}

/**
 * Middleware to check company access
 */
export function checkCompanyAccess(req, res, next) {
  const { role, company_id } = req.user;
  const requestedCompanyId = parseInt(req.params.companyId || req.body.company_id || req.query.company_id);

  // Incubation head can access all companies
  if (role === 'incubation_head') {
    return next();
  }

  // Company admin can only access their own company
  if (role === 'company_admin' && company_id !== requestedCompanyId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied to this company',
      },
    });
  }

  next();
}
