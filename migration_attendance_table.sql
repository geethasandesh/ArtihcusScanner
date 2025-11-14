-- Attendance Table Migration
-- Run this SQL in your Supabase SQL Editor

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    department TEXT,
    check_in_time TIMESTAMPTZ NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanned_date DATE NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    qr_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to set scanned_date from scanned_at
CREATE OR REPLACE FUNCTION set_scanned_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.scanned_date := DATE(NEW.scanned_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set scanned_date
CREATE TRIGGER set_attendance_scanned_date
    BEFORE INSERT OR UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION set_scanned_date();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON attendance_records(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_time ON attendance_records(check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, scanned_date);

-- Create unique constraint to prevent duplicate attendance on the same day
-- This ensures one attendance record per employee per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_daily 
ON attendance_records(employee_id, scanned_date);

-- Enable Row Level Security
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access for the scanner website to view attendance records
-- In production, you may want to restrict this to authenticated users only
CREATE POLICY "Attendance records are viewable by all" ON attendance_records
    FOR SELECT USING (true);

-- Allow public insert for scanner website (with signature verification on application level)
-- The scanner website verifies QR signatures before inserting
-- In production, consider using service role key or restricting to authenticated scanners
CREATE POLICY "Scanner can insert attendance records" ON attendance_records
    FOR INSERT WITH CHECK (true);

-- Managers and admins can update attendance records
CREATE POLICY "Managers and admins can update attendance" ON attendance_records
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = auth.uid() 
            AND role IN ('manager', 'admin')
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

