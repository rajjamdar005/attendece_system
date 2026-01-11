import express from 'express';
import { body } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, authorize, authenticateDevice } from '../middleware/auth.js';
import { generateDeviceToken, hashDeviceToken } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/v1/devices
 * List all devices (for admins)
 */
router.get(
  '/',
  authenticate,
  authorize('incubation_head', 'company_admin', 'technician'),
  asyncHandler(async (req, res) => {
    const { role, company_id: user_company_id } = req.user;
    const { limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('devices')
      .select(`
        *,
        companies (id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Company admins and technicians can only see their company's devices
    if ((role === 'company_admin' || role === 'technician') && user_company_id) {
      query = query.eq('company_id', user_company_id);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: devices, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: devices,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count,
      },
    });
  })
);

/**
 * POST /api/v1/devices/register
 * Register new device
 */
router.post(
  '/register',
  [
    body('device_uuid').notEmpty().withMessage('device_uuid required'),
    body('secret').notEmpty().withMessage('Provisioning secret required'),
  ],
  asyncHandler(async (req, res) => {
    logger.info('[DEVICE REGISTER] Request received', { 
      body: req.body,
      ip: req.ip,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
      }
    });

    const { device_uuid, secret, device_name, location } = req.body;

    // Verify provisioning secret (in production, use secure method)
    const PROVISIONING_SECRET = process.env.DEVICE_PROVISIONING_SECRET || 'change-me-in-production';
    
    logger.info('[DEVICE REGISTER] Checking secret', { 
      providedSecret: secret,
      expectedSecret: PROVISIONING_SECRET,
      match: secret === PROVISIONING_SECRET
    });

    if (secret !== PROVISIONING_SECRET) {
      logger.warn('[DEVICE REGISTER] Invalid secret', { device_uuid });
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_SECRET',
          message: 'Invalid provisioning secret',
        },
      });
    }

    // Check if device already exists
    logger.info('[DEVICE REGISTER] Checking if device exists', { device_uuid });
    const { data: existing, error: existingError } = await supabase
      .from('devices')
      .select('id')
      .eq('device_uuid', device_uuid)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      logger.error('[DEVICE REGISTER] Error checking existing device', { error: existingError });
    }

    if (existing) {
      logger.warn('[DEVICE REGISTER] Device already exists - generating new token', { device_uuid, existing });
      
      // Delete old tokens
      await supabase
        .from('device_tokens')
        .delete()
        .eq('device_id', existing.id);
      
      // Generate new device token
      const token = generateDeviceToken();
      const token_hash = await hashDeviceToken(token);

      // Store new token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (parseInt(process.env.DEVICE_TOKEN_EXPIRES_DAYS) || 365));

      await supabase
        .from('device_tokens')
        .insert({
          device_id: existing.id,
          token_hash,
          expires_at: expiresAt.toISOString(),
        });

      logger.info('[DEVICE REGISTER] New token generated for existing device', { device_uuid });

      return res.status(200).json({
        success: true,
        data: {
          device_id: existing.id,
          device_uuid,
          token,
          expires_at: expiresAt.toISOString(),
          reissued: true,
        },
      });
    }

    // Create device
    logger.info('[DEVICE REGISTER] Creating device', { device_uuid, location });
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        device_uuid,
        location,
      })
      .select()
      .single();

    if (deviceError) {
      throw new Error(deviceError.message);
    }

    // Generate device token
    const token = generateDeviceToken();
    const token_hash = await hashDeviceToken(token);

    // Store token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(process.env.DEVICE_TOKEN_EXPIRES_DAYS) || 365));

    await supabase
      .from('device_tokens')
      .insert({
        device_id: device.id,
        token_hash,
        expires_at: expiresAt.toISOString(),
      });

    logger.info(`Device registered: ${device_uuid}`);

    res.status(201).json({
      success: true,
      data: {
        device_id: device.id,
        device_uuid: device.device_uuid,
        token, // Only time token is revealed
        expires_at: expiresAt.toISOString(),
      },
    });
  })
);

/**
 * POST /api/v1/devices/event
 * Ingest attendance event from device
 */
router.post(
  '/event',
  authenticateDevice,
  [body('tag_uid').notEmpty().withMessage('tag_uid required')],
  asyncHandler(async (req, res) => {
    const { tag_uid, timestamp, rssi, raw } = req.body;
    const device = req.device;

    // Look up employee by tag (include employee name)
    const { data: tag } = await supabase
      .from('rfid_tags')
      .select('id, employee_id, employees(name, company_id)')
      .eq('uid', tag_uid)
      .eq('is_active', true)
      .single();

    // Validate and parse timestamp
    let recordedAt = new Date().toISOString();
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        recordedAt = parsed.toISOString();
      }
    }

    // Determine event type (IN or OUT) based on last event
    let eventType = 'IN'; // Default to IN
    if (tag?.employee_id) {
      // Check last event for this employee today
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const { data: lastEvent } = await supabase
        .from('attendance_logs')
        .select('event_type')
        .eq('employee_id', tag.employee_id)
        .gte('recorded_at', new Date(todayStart).toISOString())
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      // Toggle between IN and OUT
      if (lastEvent) {
        eventType = lastEvent.event_type === 'IN' ? 'OUT' : 'IN';
      }
    }

    // Insert attendance log
    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert({
        device_id: device.id,
        company_id: tag?.employees?.company_id || device.company_id,
        employee_id: tag?.employee_id || null,
        rfid_tag_id: tag?.id || null,
        event_type: eventType,
        recorded_at: recordedAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    logger.info(`Event recorded: ${eventType} - ${tag_uid} at ${device.device_uuid} - ${tag?.employees?.name || 'Unknown'}`);

    res.json({
      success: true,
      data: {
        log_id: log.id,
        recorded_at: log.recorded_at,
        event_type: eventType,
        employee_recognized: !!tag?.employee_id,
        employee_name: tag?.employees?.name || null,
      },
    });
  })
);

/**
 * POST /api/v1/devices/heartbeat
 * Device heartbeat
 */
router.post(
  '/heartbeat',
  authenticateDevice,
  asyncHandler(async (req, res) => {
    const { firmware_version, buffer_count } = req.body;
    const device = req.device;

    await supabase
      .from('devices')
      .update({
        last_seen: new Date().toISOString(),
        firmware_version,
        buffer_count: buffer_count || 0,
      })
      .eq('id', device.id);

    res.json({
      success: true,
      data: {
        server_time: new Date().toISOString(),
      },
    });
  })
);

export default router;
