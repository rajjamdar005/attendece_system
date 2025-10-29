import express from 'express';
import { body } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, checkCompanyAccess } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/tags
 * Get all RFID tags
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, company_id } = req.user;
    const { assigned, company_id: query_company_id } = req.query;

    let query = supabase
      .from('rfid_tags')
      .select(`
        *,
        employees (
          id,
          full_name,
          company_id,
          companies (name)
        )
      `);

    if (assigned === 'false') {
      query = query.is('employee_id', null);
    } else if (assigned === 'true') {
      query = query.not('employee_id', 'is', null);
    }

    // Filter by company for company admins
    if (role === 'company_admin' && company_id) {
      query = query.eq('employees.company_id', company_id);
    } else if (query_company_id) {
      query = query.eq('employees.company_id', query_company_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

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
 * POST /api/v1/tags/assign
 * Assign tag to employee
 */
router.post(
  '/assign',
  [
    body('tag_uid').notEmpty(),
    body('employee_id').isInt(),
  ],
  checkCompanyAccess,
  asyncHandler(async (req, res) => {
    const { tag_uid, employee_id, note } = req.body;

    // Check if tag exists
    const { data: existingTag } = await supabase
      .from('rfid_tags')
      .select('id')
      .eq('uid', tag_uid)
      .single();

    if (existingTag) {
      // Update existing tag
      const { data, error } = await supabase
        .from('rfid_tags')
        .update({ employee_id, note, assigned_at: new Date().toISOString() })
        .eq('uid', tag_uid)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return res.json({ success: true, data });
    }

    // Create new tag
    const { data, error } = await supabase
      .from('rfid_tags')
      .insert({ uid: tag_uid, employee_id, note })
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.status(201).json({ success: true, data });
  })
);

/**
 * DELETE /api/v1/tags/:id/unassign
 * Unassign tag from employee
 */
router.delete(
  '/:id/unassign',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rfid_tags')
      .update({ employee_id: null, note: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    res.json({ success: true, data });
  })
);

export default router;
