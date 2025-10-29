import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    company_id: user.company_id,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Hash password
 */
export async function hashPassword(password) {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  return await bcrypt.hash(password, rounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate secure device token
 */
export function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash device token for storage
 */
export async function hashDeviceToken(token) {
  const rounds = parseInt(process.env.DEVICE_TOKEN_SALT_ROUNDS) || 10;
  return await bcrypt.hash(token, rounds);
}

/**
 * Compare device token with hash
 */
export async function compareDeviceToken(token, hash) {
  return await bcrypt.compare(token, hash);
}

/**
 * Generate secure random string
 */
export function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}
