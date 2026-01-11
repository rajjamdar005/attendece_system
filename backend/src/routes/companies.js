import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/companies
 * Get all companies (filtered by user role)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, company_id } = req.user;

    let query = supabase.from('companies').select('*');

    // Company admins can only see their own company
    if (role === 'company_admin' && company_id) {
      query = query.eq('id', company_id);
    }

    const { data, error } = await query.order('name');

    if (error) {
      throw new Error(error.message);
    }

    // Get employee counts for all companies
    const companyIds = (data || []).map(c => c.id);
    
    if (companyIds.length > 0) {
      const { data: employeeCounts } = await supabase
        .from('employees')
        .select('company_id')
        .in('company_id', companyIds);

      // Count employees per company
      const countMap = {};
      (employeeCounts || []).forEach(emp => {
        countMap[emp.company_id] = (countMap[emp.company_id] || 0) + 1;
      });

      // Add employee_count to each company
      const companies = (data || []).map(company => ({
        ...company,
        employee_count: countMap[company.id] || 0
      }));

      return res.json({
        success: true,
        data: companies,
      });
    }

    res.json({
      success: true,
      data: data || [],
    });
  })
);

/**
 * POST /api/v1/companies
 * Create new company (incubation_head only)
 */
router.post(
  '/',
  authorize('incubation_head'),
  [
    body('name').notEmpty().withMessage('Company name is required'),
    body('code').optional().isLength({ max: 20 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        },
      });
    }

    const { name, code, is_active } = req.body;

    const { data, error } = await supabase
      .from('companies')
      .insert({ name, code, is_active: is_active ?? true })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.status(201).json({
      success: true,
      data,
    });
  })
);

/**
 * POST /api/v1/companies/with-admin
 * Create new company with admin account (incubation_head only)
 */
router.post(
  '/with-admin',
  authorize('incubation_head'),
  [
    body('company.name').notEmpty().withMessage('Company name is required'),
    body('admin.username').notEmpty().trim().isLength({ min: 3 }).withMessage('Admin username required (min 3 chars)'),
    body('admin.email').isEmail().normalizeEmail().withMessage('Valid admin email required'),
    body('admin.password').isLength({ min: 8 }).withMessage('Admin password required (min 8 chars)'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.array()[0].msg,
          details: errors.array(),
        },
      });
    }

    const { company, admin } = req.body;

    // Start transaction by creating company first
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: company.name,
        address: company.address || null,
        contact_person: company.contact_person || null,
        contact_email: company.contact_email || null,
        contact_phone: company.contact_phone || null,
        is_active: true
      })
      .select()
      .single();

    if (companyError) {
      logger.error('Failed to create company:', companyError);
      throw new Error(companyError.message);
    }

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      
      // Debug logging
      logger.info(`Creating admin user: ${admin.username}`);
      logger.info(`Password to hash: ${admin.password}`);
      logger.info(`Generated hash: ${hashedPassword.substring(0, 20)}...`);

      // Create admin user account
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          username: admin.username.trim(),
          email: admin.email.trim().toLowerCase(),
          password_hash: hashedPassword,
          role: 'company_admin',
          company_id: companyData.id,
          is_active: true
        })
        .select('id, username, email, role, company_id')
        .single();

      if (userError) {
        // Rollback: delete the company if user creation fails
        await supabase.from('companies').delete().eq('id', companyData.id);
        
        if (userError.code === '23505') {
          // Unique constraint violation
          if (userError.message.includes('username')) {
            throw new Error('Username already exists');
          } else if (userError.message.includes('email')) {
            throw new Error('Email already registered');
          }
        }
        throw new Error(userError.message);
      }

      logger.info(`✅ Company created: ${companyData.name}`);
      logger.info(`✅ Admin created: ${userData.username} (${userData.email})`);
      logger.info(`✅ Password hash stored in DB`);

      res.status(201).json({
        success: true,
        data: {
          company: companyData,
          admin: userData
        },
      });
    } catch (err) {
      // Rollback: delete company if any error
      await supabase.from('companies').delete().eq('id', companyData.id);
      throw err;
    }
  })
);

/**
 * PUT /api/v1/companies/:id
 * Update company
 */
router.put(
  '/:id',
  authorize('incubation_head'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, code, is_active } = req.body;

    const { data, error } = await supabase
      .from('companies')
      .update({ name, code, is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * DELETE /api/v1/companies/:id
 * Delete company and associated users (incubation_head only)
 */
router.delete(
  '/:id',
  authorize('incubation_head'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First, get count of users to be deleted
    const { data: usersToDelete, error: countError } = await supabase
      .from('users')
      .select('id, username, email, role')
      .eq('company_id', id);

    if (countError) {
      logger.error('Failed to fetch company users:', countError);
    } else {
      logger.info(`Found ${usersToDelete?.length || 0} users to delete for company ${id}`);
      usersToDelete?.forEach(user => {
        logger.info(`  - Will delete: ${user.username} (${user.role}) - ${user.email}`);
      });
    }

    // Delete all users associated with this company
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('company_id', id);

    if (userDeleteError) {
      logger.error('Failed to delete company users:', userDeleteError);
      throw new Error('Failed to delete company users: ' + userDeleteError.message);
    }

    logger.info(`Successfully deleted ${usersToDelete?.length || 0} user(s)`);

    // Then delete the company
    const { error: companyDeleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (companyDeleteError) {
      throw new Error(companyDeleteError.message);
    }

    logger.info(`Company deleted successfully: ${id}`);

    res.json({
      success: true,
      message: 'Company and associated users deleted successfully',
    });
  })
);

export default router;
