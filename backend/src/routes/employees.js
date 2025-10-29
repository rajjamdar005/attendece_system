import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, checkCompanyAccess } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/employees
 * Get employees (filtered by company for company_admin)
 */
router.get(
  '/',
  [query('company_id').optional().isInt()],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const { company_id, search, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('employees')
      .select(`
        *,
        companies (id, name),
        rfid_tags (id, uid)
      `);

    // Filter by company based on role
    if (role === 'company_admin' && user_company_id) {
      query = query.eq('company_id', user_company_id);
    } else if (company_id) {
      query = query.eq('company_id', company_id);
    }

    // Search filter
    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    query = query
      .order('full_name')
      .range(offset, offset + limit - 1);

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
 */
router.post(
  '/',
  [
    body('company_id').isInt().withMessage('Valid company_id required'),
    body('full_name').notEmpty().withMessage('Full name required'),
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

    const { company_id, full_name, email, phone, employee_code, photo_url } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .insert({
        company_id,
        full_name,
        email,
        phone,
        employee_code,
        photo_url,
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
 */
router.put(
  '/:id',
  checkCompanyAccess,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone, employee_code, photo_url, is_active } = req.body;

    const { data, error } = await supabase
      .from('employees')
      .update({ full_name, email, phone, employee_code, photo_url, is_active })
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

export default router;
