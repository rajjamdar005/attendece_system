-- Firmware table for OTA updates
CREATE TABLE IF NOT EXISTS firmware (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    release_notes TEXT,
    is_active BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one firmware can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_firmware_active ON firmware (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE firmware ENABLE ROW LEVEL SECURITY;

-- Policy: Technicians and incubation_head can manage firmware
CREATE POLICY firmware_select_policy ON firmware
    FOR SELECT
    USING (true);

CREATE POLICY firmware_insert_policy ON firmware
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('technician', 'incubation_head')
        )
    );

CREATE POLICY firmware_update_policy ON firmware
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('technician', 'incubation_head')
        )
    );

CREATE POLICY firmware_delete_policy ON firmware
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('technician', 'incubation_head')
        )
    );

-- Comment for documentation
COMMENT ON TABLE firmware IS 'Stores firmware versions for OTA updates to ESP32 devices';
