import express from 'express';
import { query } from 'express-validator';
import PDFDocument from 'pdfkit';
import { supabase } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/reports/daily
 * Daily attendance summary with stats from attendance_logs
 * Roles: incubation_head (all companies), company_admin (own company only)
 */
router.get(
  '/daily',
  authorize('incubation_head', 'company_admin'),
  [
    query('company_id').optional().isUUID(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
  ],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const { company_id, start_date, end_date } = req.query;

    // Sanitize company_id (frontend might send empty string or "null")
    const sanitizedCompanyId = (company_id && company_id !== 'null' && company_id !== '') ? company_id : null;

    // Determine effective company filter
    const effectiveCompanyId = role === 'company_admin' ? user_company_id : sanitizedCompanyId;

    // Date range defaults (last 7 days if not specified)
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all attendance logs for the period
    let logsQuery = supabase
      .from('attendance_logs')
      .select(`
        id,
        recorded_at,
        event_type,
        employee_id,
        company_id,
        employees!inner(id, name, employee_id),
        companies!inner(id, name),
        devices(device_uuid, location)
      `)
      .gte('recorded_at', `${startDate}T00:00:00Z`)
      .lte('recorded_at', `${endDate}T23:59:59Z`);

    // Apply company filter
    if (effectiveCompanyId) {
      logsQuery = logsQuery.eq('company_id', effectiveCompanyId);
    }

    logsQuery = logsQuery.order('recorded_at', { ascending: false }).limit(1000);

    const { data: logs, error } = await logsQuery;

    if (error) throw new Error(error.message);

    // Calculate summary stats
    const totalScans = logs.length;
    const uniqueEmployees = new Set(logs.filter(l => l.employee_id).map(l => l.employee_id)).size;
    
    // Count employees with at least one IN scan as present
    const employeesWithIN = new Set(
      logs.filter(l => l.event_type === 'IN' && l.employee_id).map(l => l.employee_id)
    ).size;
    
    const attendanceRate = uniqueEmployees > 0 
      ? Math.round((employeesWithIN / uniqueEmployees) * 100) 
      : 0;

    // Group by date for daily stats chart
    const dailyGroups = {};
    logs.forEach(log => {
      const date = log.recorded_at.split('T')[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = { total_scans: 0, employees: new Set() };
      }
      dailyGroups[date].total_scans += 1;
      if (log.employee_id) {
        dailyGroups[date].employees.add(log.employee_id);
      }
    });

    const dailyStats = Object.entries(dailyGroups)
      .map(([date, stats]) => ({
        date,
        total_scans: stats.total_scans,
        unique_employees: stats.employees.size
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Hourly distribution (for chart)
    const hourlyGroups = {};
    logs.forEach(log => {
      const hour = new Date(log.recorded_at).getHours();
      hourlyGroups[hour] = (hourlyGroups[hour] || 0) + 1;
    });

    const hourlyDistribution = Object.entries(hourlyGroups)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);

    // Find peak hour
    const peakHourEntry = hourlyDistribution.reduce((max, curr) => 
      curr.count > (max?.count || 0) ? curr : max, null
    );
    const peakHour = peakHourEntry ? `${peakHourEntry.hour}:00` : 'N/A';

    // Recent logs (top 20)
    const recentLogs = logs.slice(0, 20).map(log => ({
      employee_name: log.employees?.name || 'Unknown',
      company_name: log.companies?.name || 'Unknown',
      location: log.devices?.location || 'Unknown',
      recorded_at: log.recorded_at,
      event_type: log.event_type
    }));

    res.json({
      success: true,
      data: {
        summary: {
          total_scans: totalScans,
          unique_employees: uniqueEmployees,
          avg_attendance_rate: attendanceRate,
          peak_hour: peakHour
        },
        daily_stats: dailyStats,
        hourly_distribution: hourlyDistribution,
        recent_logs: recentLogs
      },
    });
  })
);

/**
 * GET /api/v1/reports/device-health
 * Device health status
 * Roles: All authenticated users
 */
router.get(
  '/device-health',
  asyncHandler(async (req, res) => {
    const { role, company_id } = req.user;

    let query = supabase
      .from('device_health')
      .select('*');

    // Company admins see only their devices
    if (role === 'company_admin' && company_id) {
      query = query.eq('company_id', company_id);
    }

    query = query.order('last_seen', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/v1/reports/export
 * Export attendance data as CSV or PDF
 * Roles: incubation_head, company_admin
 */
router.get(
  '/export',
  authorize('incubation_head', 'company_admin'),
  [
    query('company_id').optional().isUUID(),
    query('from').isISO8601(),
    query('to').isISO8601(),
    query('format').optional().isIn(['csv', 'pdf']),
  ],
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const { company_id, from, to, format = 'csv' } = req.query;

    // Sanitize company_id
    const sanitizedCompanyId = (company_id && company_id !== 'null' && company_id !== '') ? company_id : null;
    
    // Determine effective company filter (company_admin can only export their own)
    const effectiveCompanyId = role === 'company_admin' ? user_company_id : sanitizedCompanyId;

    let query = supabase
      .from('attendance_logs')
      .select(`
        recorded_at,
        event_type,
        employees!inner(name, employee_id),
        companies!inner(name),
        devices(device_uuid, location)
      `)
      .gte('recorded_at', `${from}T00:00:00Z`)
      .lte('recorded_at', `${to}T23:59:59Z`);

    // Apply company filter if specified
    if (effectiveCompanyId) {
      query = query.eq('company_id', effectiveCompanyId);
    }

    query = query.order('recorded_at', { ascending: true });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    if (format === 'pdf') {
      // Generate PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${from}_${to}.pdf"`);
      
      doc.pipe(res);

      // Title
      doc.fontSize(20).text('Attendance Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Period: ${from} to ${to}`, { align: 'center' });
      if (effectiveCompanyId && data.length > 0) {
        doc.text(`Company: ${data[0].companies?.name || 'Unknown'}`, { align: 'center' });
      }
      doc.moveDown(1);

      // Summary stats
      const totalRecords = data.length;
      const uniqueEmployees = new Set(data.map(d => d.employees?.name).filter(Boolean)).size;
      const inEvents = data.filter(d => d.event_type === 'IN').length;
      const outEvents = data.filter(d => d.event_type === 'OUT').length;

      doc.fontSize(10).text(`Total Records: ${totalRecords}`, { continued: true });
      doc.text(`   Unique Employees: ${uniqueEmployees}`, { continued: true });
      doc.text(`   IN: ${inEvents}`, { continued: true });
      doc.text(`   OUT: ${outEvents}`);
      doc.moveDown(1);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 140;
      const col3 = 200;
      const col4 = 270;
      const col5 = 340;
      const col6 = 430;

      doc.fontSize(9).fillColor('#333');
      doc.font('Helvetica-Bold');
      doc.text('Date/Time', col1, tableTop);
      doc.text('Event', col2, tableTop);
      doc.text('Employee', col3, tableTop);
      doc.text('ID', col4, tableTop);
      doc.text('Device', col5, tableTop);
      doc.text('Location', col6, tableTop);
      
      doc.moveTo(col1, tableTop + 15).lineTo(580, tableTop + 15).stroke();
      
      let y = tableTop + 20;
      doc.font('Helvetica').fontSize(8);

      // Table rows
      data.forEach((row, index) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        const timestamp = new Date(row.recorded_at).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const eventType = row.event_type || 'SCAN';
        const employeeName = (row.employees?.name || 'Unknown').substring(0, 15);
        const employeeId = (row.employees?.employee_id || '').substring(0, 12);
        const device = (row.devices?.device_uuid || '').substring(0, 15);
        const location = (row.devices?.location || '').substring(0, 20);

        doc.fillColor(index % 2 === 0 ? '#000' : '#555');
        doc.text(timestamp, col1, y, { width: 85 });
        doc.text(eventType, col2, y, { width: 55 });
        doc.text(employeeName, col3, y, { width: 65 });
        doc.text(employeeId, col4, y, { width: 65 });
        doc.text(device, col5, y, { width: 85 });
        doc.text(location, col6, y, { width: 150 });

        y += 18;
      });

      // Footer
      doc.fontSize(8).fillColor('#999');
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Total ${totalRecords} records`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

    } else {
      // Generate CSV
      const headers = ['Timestamp', 'Event Type', 'Employee', 'Employee ID', 'Company', 'Device', 'Location'];
      const rows = data.map(row => {
        const timestamp = new Date(row.recorded_at).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        return [
          timestamp,
          row.event_type || 'SCAN',
          row.employees?.name || 'Unknown',
          row.employees?.employee_id || '',
          row.companies?.name || 'Unknown',
          row.devices?.device_uuid || '',
          row.devices?.location || '',
        ];
      });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${from}_${to}.csv"`);
      res.send(csv);
    }
  })
);

export default router;
