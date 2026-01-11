import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/database.js';
import { generateToken, hashPassword, comparePassword } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    const { username, password } = req.body;

    // Fetch user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    // Debug logging
    logger.info(`Login attempt for username: ${username}`);
    if (error) {
      logger.error(`Supabase error fetching user: ${error.message}`, error);
    }
    if (!user) {
      logger.warn(`User not found: ${username}`);
    } else {
      logger.info(`User found: ${user.username}, role: ${user.role}, active: ${user.is_active}`);
    }

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is inactive',
        },
      });
    }

    // Verify password
    logger.info(`Verifying password for user: ${username}`);
    logger.info(`Password hash from DB: ${user.password_hash?.substring(0, 20)}...`);
    const isValidPassword = await comparePassword(password, user.password_hash);
    logger.info(`Password verification result: ${isValidPassword}`);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    // Update last_login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Fetch company name if user has a company
    let companyName = null;
    if (user.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', user.company_id)
        .single();
      companyName = companyData?.name || null;
    }

    // Generate token
    const token = generateToken(user);

    logger.info(`User ${username} logged in successfully`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          company_id: user.company_id,
          company_name: companyName,
        },
      },
    });
  })
);

/**
 * POST /api/v1/auth/register
 * Register new user (admin only in production)
 */
router.post(
  '/register',
  [
    body('username').notEmpty().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').notEmpty().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['incubation_head', 'company_admin', 'technician']).withMessage('Invalid role'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array(),
        },
      });
    }

    const { username, password, full_name, email, role, company_id } = req.body;

    // Check if username exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USERNAME_EXISTS',
          message: 'Username already exists',
        },
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash,
        full_name,
        email,
        role,
        company_id: company_id || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    logger.info(`New user registered: ${username}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          full_name: newUser.full_name,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  })
);

/**
 * GET /api/v1/auth/me
 * Get current user info (for debugging)
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  })
);

export default router;
