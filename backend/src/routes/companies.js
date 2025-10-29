import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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

export default router;
