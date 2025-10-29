import express from 'express';
import { query } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/attendance
 * Get attendance logs with filtering
 */
router.get(
  '/',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('company_id').optional().isInt(),
    query('employee_id').optional().isInt(),
  ],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const {
      from,
      to,
      company_id,
      employee_id,
      limit = 100,
      offset = 0,
    } = req.query;

    let query = supabase
      .from('attendance_logs')
      .select(`
        *,
        employees (id, full_name, employee_code),
        devices (device_uuid, device_name, location),
        companies (name)
      `);

    // Apply company filter based on role
    if (role === 'company_admin' && user_company_id) {
      query = query.eq('company_id', user_company_id);
    } else if (company_id) {
      query = query.eq('company_id', company_id);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (from) {
      query = query.gte('recorded_at', from);
    }

    if (to) {
      query = query.lte('recorded_at', to);
    }

    query = query
      .order('recorded_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

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

export default router;
