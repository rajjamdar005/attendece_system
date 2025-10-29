import express from 'express';
import { body } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticateDevice } from '../middleware/auth.js';
import { generateDeviceToken, hashDeviceToken } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

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
    const { device_uuid, secret, device_name, location } = req.body;

    // Verify provisioning secret (in production, use secure method)
    const PROVISIONING_SECRET = process.env.DEVICE_PROVISIONING_SECRET || 'change-me-in-production';
    
    if (secret !== PROVISIONING_SECRET) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_SECRET',
          message: 'Invalid provisioning secret',
        },
      });
    }

    // Check if device already exists
    const { data: existing } = await supabase
      .from('devices')
      .select('id')
      .eq('device_uuid', device_uuid)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DEVICE_EXISTS',
          message: 'Device already registered',
        },
      });
    }

    // Create device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        device_uuid,
        device_name: device_name || device_uuid,
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

    // Look up employee by tag
    const { data: tag } = await supabase
      .from('rfid_tags')
      .select('employee_id, employees(company_id)')
      .eq('uid', tag_uid)
      .eq('is_active', true)
      .single();

    // Insert attendance log
    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert({
        device_id: device.id,
        company_id: tag?.employees?.company_id || device.company_id,
        employee_id: tag?.employee_id || null,
        tag_uid,
        event_type: 'SCAN',
        device_timestamp: timestamp || null,
        rssi,
        raw_payload: raw || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    logger.info(`Event recorded: ${tag_uid} at ${device.device_uuid}`);

    res.json({
      success: true,
      data: {
        log_id: log.id,
        recorded_at: log.recorded_at,
        employee_recognized: !!tag?.employee_id,
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
