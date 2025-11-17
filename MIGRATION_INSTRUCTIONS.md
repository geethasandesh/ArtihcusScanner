# Migration Instructions for Advanced Attendance System

## Step-by-Step Guide

### 1. Open Supabase SQL Editor
- Go to your Supabase project dashboard
- Navigate to **SQL Editor** (left sidebar)
- Click **New Query**

### 2. Run the Migration
- Copy the entire contents of `migration_attendance_advanced.sql`
- Paste it into the SQL Editor
- Click **Run** (or press Ctrl+Enter)

### 3. Verify the Migration
After running, verify the changes:

```sql
-- Check if columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'attendance_records'
AND column_name IN ('scan_type', 'is_late', 'is_early_departure', 'is_half_day', 'notes');

-- Check if leave_requests table exists
SELECT * FROM leave_requests LIMIT 1;

-- Check if constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'attendance_records'
AND constraint_name = 'check_scan_type';
```

### 4. Expected Results

After migration, you should see:
- ✅ `scan_type` column added to `attendance_records`
- ✅ `is_late`, `is_early_departure`, `is_half_day`, `notes` columns added
- ✅ `leave_requests` table created
- ✅ All indexes created
- ✅ RLS policies set up

### 5. Common Issues & Solutions

#### Issue: "column already exists"
**Solution**: The migration uses `IF NOT EXISTS`, so this shouldn't happen. If it does, the column already exists and you can skip that step.

#### Issue: "constraint already exists"
**Solution**: The migration drops the constraint first, then recreates it. If you see this error, the constraint might have a different name. Check with:
```sql
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'attendance_records' AND constraint_type = 'CHECK';
```

#### Issue: "function update_updated_at_column does not exist"
**Solution**: This function should exist from your original schema. If not, create it:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 6. Test the Migration

After migration, test by scanning a QR code:
1. The scanner should work without errors
2. Check the attendance_records table - new records should have `scan_type` set
3. Try scanning multiple times in a day - should create different scan types

### 7. Rollback (if needed)

If you need to rollback:

```sql
-- Remove new columns
ALTER TABLE attendance_records 
DROP COLUMN IF EXISTS scan_type,
DROP COLUMN IF EXISTS is_late,
DROP COLUMN IF EXISTS is_early_departure,
DROP COLUMN IF EXISTS is_half_day,
DROP COLUMN IF EXISTS notes;

-- Drop leave_requests table
DROP TABLE IF EXISTS leave_requests CASCADE;

-- Recreate unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_daily 
ON attendance_records(employee_id, scanned_date);
```

## Need Help?

If you encounter any errors, check:
1. Supabase project is active
2. You have proper permissions
3. The `attendance_records` table exists
4. The `employees` table exists (for foreign key reference)

