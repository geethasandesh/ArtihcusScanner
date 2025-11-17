-- Advanced Attendance Management System Migration
-- Run this SQL in your Supabase SQL Editor
-- This updates the attendance system to support multiple scans per day

-- Step 1: Drop the old unique constraint that prevents multiple scans
DROP INDEX IF EXISTS idx_attendance_unique_daily;

-- Step 2: Add scan_type column to attendance_records (handle existing data)
-- First, add column as nullable
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS scan_type TEXT;

-- Update existing records to have 'check_in' as default
UPDATE attendance_records 
SET scan_type = 'check_in' 
WHERE scan_type IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE attendance_records 
ALTER COLUMN scan_type SET DEFAULT 'check_in',
ALTER COLUMN scan_type SET NOT NULL;

-- Drop constraint if it exists, then add it
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS check_scan_type;

ALTER TABLE attendance_records 
ADD CONSTRAINT check_scan_type 
CHECK (scan_type IN ('check_in', 'lunch_out', 'lunch_in', 'check_out'));

-- Step 3: Add working hours calculation fields
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_early_departure BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing records to have default values
UPDATE attendance_records 
SET is_late = COALESCE(is_late, FALSE),
    is_early_departure = COALESCE(is_early_departure, FALSE),
    is_half_day = COALESCE(is_half_day, FALSE)
WHERE is_late IS NULL OR is_early_departure IS NULL OR is_half_day IS NULL;

-- Step 4: Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('full_day', 'half_day_morning', 'half_day_afternoon')),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, leave_date)
);

-- Step 5: Create indexes for leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_date ON leave_requests(leave_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Step 6: Update indexes for attendance_records with scan_type
CREATE INDEX IF NOT EXISTS idx_attendance_scan_type ON attendance_records(scan_type);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date_type ON attendance_records(employee_id, scanned_date, scan_type);

-- Step 7: Enable RLS on leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Step 8: Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Leave requests are viewable by authenticated users" ON leave_requests;
DROP POLICY IF EXISTS "Employees can create their own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Managers and admins can update leave requests" ON leave_requests;

-- RLS Policies for leave_requests
CREATE POLICY "Leave requests are viewable by authenticated users" ON leave_requests
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Employees can create their own leave requests" ON leave_requests
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Managers and admins can update leave requests" ON leave_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE id = auth.uid() 
            AND role IN ('manager', 'admin')
        )
    );

-- Step 9: Create function to calculate working hours for a day
CREATE OR REPLACE FUNCTION calculate_daily_working_hours(
    p_employee_id UUID,
    p_date DATE
)
RETURNS TABLE (
    check_in_time TIMESTAMPTZ,
    lunch_out_time TIMESTAMPTZ,
    lunch_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    total_hours DECIMAL,
    lunch_duration_minutes INTEGER,
    is_complete BOOLEAN,
    is_half_day BOOLEAN
) AS $$
DECLARE
    v_check_in TIMESTAMPTZ;
    v_lunch_out TIMESTAMPTZ;
    v_lunch_in TIMESTAMPTZ;
    v_check_out TIMESTAMPTZ;
    v_total_hours DECIMAL;
    v_lunch_minutes INTEGER;
    v_is_complete BOOLEAN;
    v_is_half_day BOOLEAN;
BEGIN
    -- Get all scans for the day
    SELECT MAX(CASE WHEN scan_type = 'check_in' THEN scanned_at END),
           MAX(CASE WHEN scan_type = 'lunch_out' THEN scanned_at END),
           MAX(CASE WHEN scan_type = 'lunch_in' THEN scanned_at END),
           MAX(CASE WHEN scan_type = 'check_out' THEN scanned_at END)
    INTO v_check_in, v_lunch_out, v_lunch_in, v_check_out
    FROM attendance_records
    WHERE employee_id = p_employee_id
      AND scanned_date = p_date;
    
    -- Calculate lunch duration
    IF v_lunch_out IS NOT NULL AND v_lunch_in IS NOT NULL THEN
        v_lunch_minutes := EXTRACT(EPOCH FROM (v_lunch_in - v_lunch_out)) / 60;
    ELSE
        v_lunch_minutes := 0;
    END IF;
    
    -- Calculate total working hours
    IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
        v_total_hours := (EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600) - (v_lunch_minutes / 60.0);
        v_is_complete := TRUE;
    ELSIF v_check_in IS NOT NULL THEN
        -- Only check-in, no check-out (half day or incomplete)
        v_total_hours := NULL;
        v_is_complete := FALSE;
        v_is_half_day := TRUE;
    ELSE
        v_total_hours := NULL;
        v_is_complete := FALSE;
        v_is_half_day := FALSE;
    END IF;
    
    RETURN QUERY SELECT 
        v_check_in,
        v_lunch_out,
        v_lunch_in,
        v_check_out,
        v_total_hours,
        v_lunch_minutes,
        v_is_complete,
        v_is_half_day;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create updated_at trigger for leave_requests (only if function exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON leave_requests;
        CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
