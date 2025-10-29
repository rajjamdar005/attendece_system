import express from 'express';
import { query } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/reports/daily
 * Daily attendance summary with IN/OUT inference
 */
router.get(
  '/daily',
  [
    query('company_id').isInt(),
    query('date').isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { company_id, date } = req.query;

    // Use the daily_attendance_summary view
    const { data, error } = await supabase
      .from('daily_attendance_summary')
      .select('*')
      .eq('company_id', company_id)
      .eq('attendance_date', date)
      .order('full_name');

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/v1/reports/device-health
 * Device health status
 */
router.get(
  '/device-health',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('device_health')
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/v1/reports/export
 * Export attendance data as CSV
 */
router.get(
  '/export',
  [
    query('company_id').isInt(),
    query('from').isISO8601(),
    query('to').isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { company_id, from, to } = req.query;

    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        recorded_at,
        tag_uid,
        event_type,
        employees (full_name, employee_code),
        devices (device_name, location)
      `)
      .eq('company_id', company_id)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at');

    if (error) throw new Error(error.message);

    // Convert to CSV
    const headers = ['Timestamp', 'Employee', 'Employee Code', 'Tag UID', 'Event', 'Device', 'Location'];
    const rows = data.map(row => [
      row.recorded_at,
      row.employees?.full_name || 'Unknown',
      row.employees?.employee_code || '',
      row.tag_uid,
      row.event_type,
      row.devices?.device_name || '',
      row.devices?.location || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${from}_${to}.csv`);
    res.send(csv);
  })
);

export default router;
