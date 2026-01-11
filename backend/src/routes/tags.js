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
    const { assigned, company_id: query_company_id, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('rfid_tags')
      .select(`
        *,
        employees (
          id,
          name,
          company_id,
          companies (name)
        )
      `, { count: 'exact' });

    if (assigned === 'false') {
      query = query.is('employee_id', null);
    } else if (assigned === 'true') {
      query = query.not('employee_id', 'is', null);
    }

    // Filter by company for company admins and technicians
    // They can ONLY see their own company (ignore query params)
    if ((role === 'company_admin' || role === 'technician') && company_id) {
      query = query.eq('employees.company_id', company_id);
    } else if (role === 'incubation_head' && query_company_id) {
      // incubation_head can filter by company or see all
      query = query.eq('employees.company_id', query_company_id);
    }

    query = query
      .order('created_at', { ascending: false })
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
 * POST /api/v1/tags/assign
 * Assign tag to employee
 */
router.post(
  '/assign',
  [
    body('tag_uid').notEmpty(),
    body('employee_id').notEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const { tag_uid, employee_id, note } = req.body;

    // Get employee's company_id
    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('id', employee_id)
      .single();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found' }
      });
    }

    // Company admin can only assign tags to employees in their own company
    if (role === 'company_admin' && String(user_company_id) !== String(employee.company_id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this company' }
      });
    }

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
        .update({ 
          employee_id, 
          company_id: employee.company_id,
          note, 
          assigned_at: new Date().toISOString() 
        })
        .eq('uid', tag_uid)
        .select()
        .single();

      if (error) throw new Error(error.message);

      return res.json({ success: true, data });
    }

    // Create new tag
    const { data, error } = await supabase
      .from('rfid_tags')
      .insert({ 
        uid: tag_uid, 
        employee_id, 
        company_id: employee.company_id,
        note 
      })
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
