-- Fix SECURITY DEFINER vulnerability in views
-- Drop existing views and recreate with SECURITY INVOKER

DROP VIEW IF EXISTS unassigned_tags CASCADE;
DROP VIEW IF EXISTS device_health CASCADE;
DROP VIEW IF EXISTS daily_attendance_summary CASCADE;

-- Recreate views with SECURITY INVOKER to enforce RLS of querying user
CREATE VIEW daily_attendance_summary WITH (security_invoker=on) AS
SELECT 
    DATE(recorded_at) as date,
    company_id,
    employee_id,
    COUNT(*) as scan_count,
    MIN(recorded_at) as first_scan,
    MAX(recorded_at) as last_scan,
    CASE 
        WHEN COUNT(*) >= 2 THEN 'PRESENT'
        ELSE 'PARTIAL'
    END as status
FROM attendance_logs
GROUP BY DATE(recorded_at), company_id, employee_id;

CREATE VIEW device_health WITH (security_invoker=on) AS
SELECT 
    d.id,
    d.device_uuid,
    d.location,
    d.company_id,
    c.name as company_name,
    d.last_seen,
    d.firmware_version,
    d.buffer_count,
    CASE 
        WHEN d.last_seen IS NULL THEN 'offline'
        WHEN d.last_seen > NOW() - INTERVAL '10 minutes' THEN 'online'
        WHEN d.last_seen > NOW() - INTERVAL '1 hour' THEN 'warning'
        ELSE 'offline'
    END as status
FROM devices d
LEFT JOIN companies c ON d.company_id = c.id
WHERE d.is_active = true;

CREATE VIEW unassigned_tags WITH (security_invoker=on) AS
SELECT 
    t.id,
    t.uid,
    t.company_id,
    c.name as company_name,
    t.created_at
FROM rfid_tags t
LEFT JOIN companies c ON t.company_id = c.id
WHERE t.employee_id IS NULL AND t.is_active = true;
