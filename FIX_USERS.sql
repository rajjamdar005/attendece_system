-- Quick Fix: Run this SQL directly in Supabase SQL Editor
-- This will delete existing users and create test users with WORKING password hash

-- 1. Delete all existing users
DELETE FROM users;

-- 2. Insert test users with CORRECT password hash
-- Password for all: Admin@123
-- NEW WORKING Hash: $2b$10$kVa6HEpHhQQdE9lUPqA24uYBxwRbjIGRgYnb7dj9qSml0z.WDHcbu

-- Incubation Head (Super Admin)
INSERT INTO users (username, password_hash, email, role, company_id, is_active)
VALUES (
  'admin',
  '$2b$10$kVa6HEpHhQQdE9lUPqA24uYBxwRbjIGRgYnb7dj9qSml0z.WDHcbu',
  'admin@rfid-attendance.local',
  'incubation_head',
  NULL,
  true
);

-- Create test company if doesn't exist
INSERT INTO companies (id, name, address, contact_person, contact_email, is_active)
VALUES (
  'c1111111-1111-1111-1111-111111111111',
  'Test Company A',
  '123 Business Street',
  'John Doe',
  'john@companya.com',
  true
) ON CONFLICT (id) DO NOTHING;

-- Company Admin
INSERT INTO users (username, password_hash, email, role, company_id, is_active)
VALUES (
  'companyadmin',
  '$2b$10$kVa6HEpHhQQdE9lUPqA24uYBxwRbjIGRgYnb7dj9qSml0z.WDHcbu',
  'companyadmin@companya.com',
  'company_admin',
  'c1111111-1111-1111-1111-111111111111',
  true
);

-- Technician
INSERT INTO users (username, password_hash, email, role, company_id, is_active)
VALUES (
  'technician',
  '$2b$10$kVa6HEpHhQQdE9lUPqA24uYBxwRbjIGRgYnb7dj9qSml0z.WDHcbu',
  'technician@rfid-attendance.local',
  'technician',
  NULL,
  true
);

-- Verify users were created
SELECT username, email, role, is_active FROM users;
