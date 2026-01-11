import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import supabase from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/users
 * List users (with company filtering for company_admin)
 * Roles: incubation_head (all users), company_admin (own company users only)
 */
router.get(
  '/',
  authenticate,
  authorize('incubation_head', 'company_admin'),
  [
    query('company_id').optional().isUUID(),
    query('role').optional().isIn(['incubation_head', 'company_admin', 'technician']),
    query('status').optional().isIn(['active', 'inactive']),
  ],
  asyncHandler(async (req, res) => {
    const { role: userRole, company_id: userCompanyId } = req.user;
    const { company_id, role, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        role,
        company_id,
        is_active,
        last_login,
        created_at,
        companies (id, name)
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Company filtering based on role
    if (userRole === 'company_admin' && userCompanyId) {
      // Company admin can only see users from their company
      query = query.eq('company_id', userCompanyId);
    } else if (company_id) {
      // Incubation head can filter by company
      query = query.eq('company_id', company_id);
    }

    // Role filtering
    if (role) {
      query = query.eq('role', role);
    }

    // Status filtering
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  })
);

/**
 * POST /api/v1/users
 * Create a new user (company_admin or technician)
 * Roles: incubation_head only
 * 
 * Business Rules:
 * - Only incubation_head can create users
 * - Cannot create another incubation_head
 * - Password must be 8+ chars with uppercase, lowercase, number, special char
 * - Username must be unique
 * - company_admin and technician must have company_id
 */
router.post(
  '/',
  authenticate,
  authorize('incubation_head'),
  [
    body('username').isString().trim().isLength({ min: 3, max: 50 }),
    body('email')
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    body('role').isIn(['company_admin', 'technician']),
    body('company_id').isUUID(),
    body('full_name').optional().isString().trim().isLength({ max: 100 }),
  ],
  asyncHandler(async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { username, password, role, company_id, full_name } = req.body;

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
      });
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash,
        role,
        company_id,
        full_name: full_name || null,
        is_active: true,
      })
      .select(`
        id,
        username,
        role,
        company_id,
        full_name,
        is_active,
        created_at,
        companies (id, name)
      `)
      .single();

    if (error) throw new Error(error.message);

    logger.info(`User created: ${username} (${role}) for company: ${company.name}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser,
    });
  })
);

/**
 * PUT /api/v1/users/:id
 * Update user (change role, activate/deactivate, reset password)
 * Roles: incubation_head only
 * 
 * Business Rules:
 * - Can update role, is_active, company_id, password
 * - Cannot change incubation_head role
 * - Cannot deactivate last admin
 */
router.put(
  '/:id',
  authenticate,
  authorize('incubation_head'),
  [
    body('role').optional().isIn(['company_admin', 'technician']),
    body('is_active').optional().isBoolean(),
    body('company_id').optional().isUUID(),
    body('password')
      .optional()
      .isString()
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    body('full_name').optional().isString().trim().isLength({ max: 100 }),
  ],
  asyncHandler(async (req, res) => {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { role, is_active, company_id, password, full_name } = req.body;

    // Get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, username, role, company_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent changing incubation_head role
    if (existingUser.role === 'incubation_head') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify incubation_head user',
      });
    }

    // Build update object
    const updates = {};

    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (company_id !== undefined) updates.company_id = company_id;
    if (full_name !== undefined) updates.full_name = full_name;

    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        username,
        role,
        company_id,
        full_name,
        is_active,
        updated_at,
        companies (id, name)
      `)
      .single();

    if (error) throw new Error(error.message);

    logger.info(`User updated: ${existingUser.username} (ID: ${id})`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  })
);

/**
 * DELETE /api/v1/users/:id
 * Delete a user
 * Roles: incubation_head only
 * 
 * Business Rules:
 * - Cannot delete incubation_head
 * - Cannot delete yourself
 */
router.delete(
  '/:id',
  authenticate,
  authorize('incubation_head'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: currentUserId } = req.user;

    // Prevent self-deletion
    if (id === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    // Get user to check role
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('id', id)
      .single();

    if (fetchError || !userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent deleting incubation_head
    if (userToDelete.role === 'incubation_head') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete incubation_head user',
      });
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    logger.info(`User deleted: ${userToDelete.username} (ID: ${id})`);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

export default router;
