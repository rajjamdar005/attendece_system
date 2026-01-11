import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, authorize, checkCompanyAccess } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/employees
 * Get employees (filtered by company for company_admin)
 * Roles: incubation_head (all), company_admin (own company only), technician (read-only)
 */
router.get(
  '/',
  authorize('incubation_head', 'company_admin', 'technician'),
  [query('company_id').optional().custom((val) => val === null || val === 'null' || val === '' ? true : /^\d+$/.test(val))],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    let { company_id, search, limit = 100, offset = 0 } = req.query;
    
    console.log('[EMPLOYEES] Role:', role, 'User Company:', user_company_id, 'Query Company:', company_id);
    
    // Normalize null/empty company_id
    if (!company_id || company_id === 'null' || company_id === '') {
      company_id = null;
    }

    let query = supabase
      .from('employees')
      .select(`
        *,
        companies (id, name),
        rfid_tags (id, uid)
      `, { count: 'exact' });

    // Filter by company based on role
    // company_admin can ONLY see their own company (ignore query params)
    if (role === 'company_admin' && user_company_id) {
      console.log('[EMPLOYEES] Applying company_admin filter for company:', user_company_id);
      query = query.eq('company_id', user_company_id);
    } else if (role === 'incubation_head') {
      // incubation_head can filter by company or see all
      if (company_id && company_id !== null) {
        console.log('[EMPLOYEES] Applying incubation_head filter for company:', company_id);
        query = query.eq('company_id', parseInt(company_id));
      }
    } else if (role === 'technician' && user_company_id) {
      // technician can only see their own company
      console.log('[EMPLOYEES] Applying technician filter for company:', user_company_id);
      query = query.eq('company_id', user_company_id);
    }

    // Search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    query = query
      .order('name')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count,
      },
    });
  })
);

/**
 * POST /api/v1/employees
 * Create new employee
 * Roles: incubation_head, company_admin (own company only)
 */
router.post(
  '/',
  authorize('incubation_head', 'company_admin'),
  [
    body('company_id').notEmpty().withMessage('Valid company_id required'),
    body('employee_id').notEmpty().withMessage('Employee ID required'),
    body('name').notEmpty().withMessage('Name required'),
    body('email').optional().isEmail(),
  ],
  checkCompanyAccess,
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

    const { company_id, name, email, phone, employee_id, designation, is_active } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .insert({
        company_id,
        name,
        employee_id,
        email,
        phone,
        designation,
        is_active: is_active ?? true,
      })
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
 * PUT /api/v1/employees/:id
 * Update employee
 * Roles: incubation_head, company_admin (own company only)
 */
router.put(
  '/:id',
  authorize('incubation_head', 'company_admin'),
  checkCompanyAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, employee_id, designation, is_active } = req.body;

    const updateData = {
      email,
      phone,
      designation,
      is_active
    };
    
    if (name) updateData.name = name;
    if (employee_id) updateData.employee_id = employee_id;

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
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
 * DELETE /api/v1/employees/:id
 * Delete employee
 * Roles: incubation_head, company_admin (own company only)
 */
router.delete(
  '/:id',
  authorize('incubation_head', 'company_admin'),
  checkCompanyAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  })
);

export default router;
