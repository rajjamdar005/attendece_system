-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    designation VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, employee_id)
);

-- RFID Tags table
CREATE TABLE rfid_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid VARCHAR(100) NOT NULL UNIQUE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    note TEXT,
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_uuid VARCHAR(255) NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    location VARCHAR(255),
    last_seen TIMESTAMPTZ,
    firmware_version VARCHAR(50),
    buffer_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device tokens table (for authentication)
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (for dashboard access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('incubation_head', 'company_admin', 'technician')),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance logs table (partitioned for scale)
CREATE TABLE attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    rfid_tag_id UUID NOT NULL REFERENCES rfid_tags(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    event_type VARCHAR(50) DEFAULT 'scan',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_employees_company_id ON employees(company_id);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_rfid_tags_uid ON rfid_tags(uid);
CREATE INDEX idx_rfid_tags_employee_id ON rfid_tags(employee_id);
CREATE INDEX idx_devices_company_id ON devices(company_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
CREATE INDEX idx_attendance_logs_employee_id ON attendance_logs(employee_id);
CREATE INDEX idx_attendance_logs_company_id ON attendance_logs(company_id);
CREATE INDEX idx_attendance_logs_recorded_at ON attendance_logs(recorded_at);
CREATE INDEX idx_attendance_logs_company_recorded ON attendance_logs(company_id, recorded_at);
CREATE INDEX idx_attendance_logs_employee_recorded ON attendance_logs(employee_id, recorded_at);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_company_id ON users(company_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rfid_tags_updated_at BEFORE UPDATE ON rfid_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for backend API)
CREATE POLICY "Service role bypass" ON companies FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON employees FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON rfid_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON devices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON device_tokens FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON attendance_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON audit_logs FOR ALL USING (auth.role() = 'service_role');

-- Create views for reporting (fixed in separate migration)
-- Views are created with SECURITY INVOKER in 20260107000000_fix_security_definer_views.sql

-- Insert default admin user (password: Admin@123)
-- Password hash generated with bcrypt (10 rounds)
INSERT INTO users (username, password_hash, email, role, is_active) VALUES
('admin', '$2b$10$rF5K8gXLQ0YYPJQVQqYc0.yXqH0ZvGJ8R8F8YJ8FQJ8FQJ8FQJ8FQ', 'admin@rfid-attendance.local', 'incubation_head', true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON companies, employees, rfid_tags, devices, attendance_logs TO authenticated;

-- Comments for documentation
COMMENT ON TABLE companies IS 'Tenant organizations in the incubation center';
COMMENT ON TABLE employees IS 'Employees belonging to companies';
COMMENT ON TABLE rfid_tags IS 'RFID cards/tags for attendance tracking';
COMMENT ON TABLE devices IS 'ESP32 RFID reader devices';
COMMENT ON TABLE device_tokens IS 'Authentication tokens for devices';
COMMENT ON TABLE users IS 'Dashboard users with different roles';
COMMENT ON TABLE attendance_logs IS 'All RFID scan events';
COMMENT ON TABLE audit_logs IS 'System audit trail';
