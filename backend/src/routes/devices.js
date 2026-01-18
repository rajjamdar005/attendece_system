import express from 'express';
import { body } from 'express-validator';
import { supabase } from '../config/database.js';
import { authenticate, authorize, authenticateDevice } from '../middleware/auth.js';
import { generateDeviceToken, hashDeviceToken } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for firmware uploads
const FIRMWARE_DIR = process.env.FIRMWARE_DIR || './firmware';
if (!fs.existsSync(FIRMWARE_DIR)) {
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FIRMWARE_DIR),
  filename: (req, file, cb) => {
    const version = req.body.version || 'unknown';
    cb(null, `firmware-${version}-${Date.now()}.bin`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB max (ESP32 partition limit)
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.bin')) {
      cb(null, true);
    } else {
      cb(new Error('Only .bin files are allowed'));
    }
  }
});

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

/* ===================================================================
 *  FIRMWARE MANAGEMENT ENDPOINTS
 * =================================================================== */

/**
 * GET /api/v1/devices/firmware
 * Check for firmware update (called by ESP32)
 * Returns 304 if up to date, 200 with binary if update available
 */
router.get(
  '/firmware',
  asyncHandler(async (req, res) => {
    const { device_uuid, version } = req.query;

    logger.info('[FIRMWARE] Update check', { device_uuid, current_version: version });

    // Get active firmware
    const { data: firmware, error } = await supabase
      .from('firmware')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error || !firmware) {
      logger.info('[FIRMWARE] No active firmware available');
      return res.status(304).send(); // Not modified
    }

    // Compare versions (simple string comparison for now)
    if (version && version >= firmware.version) {
      logger.info('[FIRMWARE] Device is up to date', { device: version, server: firmware.version });
      return res.status(304).send(); // Not modified
    }

    // Send firmware binary
    const firmwarePath = path.join(FIRMWARE_DIR, firmware.filename);
    if (!fs.existsSync(firmwarePath)) {
      logger.error('[FIRMWARE] File not found', { path: firmwarePath });
      return res.status(404).json({
        success: false,
        error: { message: 'Firmware file not found' }
      });
    }

    logger.info('[FIRMWARE] Sending update', {
      device_uuid,
      from: version,
      to: firmware.version,
      size: firmware.file_size,
      md5: firmware.checksum
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', firmware.file_size);
    res.setHeader('X-Firmware-Version', firmware.version);
    res.setHeader('X-MD5', firmware.checksum);



    // Simpler approach: The current endpoint DOES serve the binary.
    // So we should provide the full URL to THIS endpoint.
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl.split('?')[0]}?device_uuid=${device_uuid}&version=0.0.0&force=true`; // force=true to skip version check

    res.setHeader('X-Binary-URL', fullUrl);

    const stream = fs.createReadStream(firmwarePath);
    stream.pipe(res);
  })
);

/**
 * GET /api/v1/devices/firmware/list
 * List all firmware versions (for technician dashboard)
 */
router.get(
  '/firmware/list',
  authenticate,
  authorize('technician', 'incubation_head'),
  asyncHandler(async (req, res) => {
    const { data: firmwares, error } = await supabase
      .from('firmware')
      .select(`
        *,
        users (username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: firmwares
    });
  })
);

/**
 * POST /api/v1/devices/firmware/upload
 * Upload new firmware (technician only)
 */
router.post(
  '/firmware/upload',
  authenticate,
  authorize('technician', 'incubation_head'),
  upload.single('firmware'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No firmware file uploaded' }
      });
    }

    const { version, release_notes, set_active } = req.body;

    if (!version) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: { message: 'Version is required' }
      });
    }

    // Check if version already exists
    const { data: existing } = await supabase
      .from('firmware')
      .select('id')
      .eq('version', version)
      .single();

    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: { message: `Version ${version} already exists` }
      });
    }

    // Calculate checksum
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // If set_active, deactivate other firmware first
    if (set_active === 'true' || set_active === true) {
      await supabase
        .from('firmware')
        .update({ is_active: false })
        .eq('is_active', true);
    }

    // Insert firmware record
    const { data: firmware, error } = await supabase
      .from('firmware')
      .insert({
        version,
        filename: req.file.filename,
        file_size: req.file.size,
        checksum,
        release_notes: release_notes || null,
        is_active: set_active === 'true' || set_active === true,
        uploaded_by: req.user.id
      })
      .select()
      .single();

    if (error) {
      fs.unlinkSync(req.file.path);
      throw new Error(error.message);
    }

    logger.info('[FIRMWARE] Uploaded', {
      version,
      size: req.file.size,
      by: req.user.username,
      active: firmware.is_active
    });

    res.status(201).json({
      success: true,
      data: firmware
    });
  })
);

/**
 * PUT /api/v1/devices/firmware/:id/activate
 * Set firmware as active (rollout to devices)
 */
router.put(
  '/firmware/:id/activate',
  authenticate,
  authorize('technician', 'incubation_head'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Deactivate all firmware
    await supabase
      .from('firmware')
      .update({ is_active: false })
      .eq('is_active', true);

    // Activate selected firmware
    const { data: firmware, error } = await supabase
      .from('firmware')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    logger.info('[FIRMWARE] Activated', { version: firmware.version, by: req.user.username });

    res.json({
      success: true,
      data: firmware
    });
  })
);

/**
 * DELETE /api/v1/devices/firmware/:id
 * Delete firmware version
 */
router.delete(
  '/firmware/:id',
  authenticate,
  authorize('technician', 'incubation_head'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get firmware to delete file
    const { data: firmware, error: fetchError } = await supabase
      .from('firmware')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !firmware) {
      return res.status(404).json({
        success: false,
        error: { message: 'Firmware not found' }
      });
    }

    if (firmware.is_active) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete active firmware. Activate another version first.' }
      });
    }

    // Delete file
    const firmwarePath = path.join(FIRMWARE_DIR, firmware.filename);
    if (fs.existsSync(firmwarePath)) {
      fs.unlinkSync(firmwarePath);
    }

    // Delete record
    const { error } = await supabase
      .from('firmware')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    logger.info('[FIRMWARE] Deleted', { version: firmware.version, by: req.user.username });

    res.json({
      success: true,
      message: `Firmware ${firmware.version} deleted`
    });
  })
);

export default router;
