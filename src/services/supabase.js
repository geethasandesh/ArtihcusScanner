import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables');
}

// Create Supabase client only if variables are available
// This prevents the app from crashing, but functions will fail gracefully
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Detect scan type based on existing scans for the day
 * @param {string} employeeId - Employee UUID
 * @param {Date} scanTime - Current scan time
 * @returns {Promise<{scanType: string, isLate: boolean, isEarly: boolean}>}
 */
async function detectScanType(employeeId, scanTime) {
  if (!supabase) {
    return { scanType: 'check_in', isLate: false, isEarly: false };
  }
  
  const today = scanTime.toISOString().split('T')[0];
  
  // Get all scans for today
  const { data: todayScans } = await supabase
    .from('attendance_records')
    .select('scan_type, scanned_at')
    .eq('employee_id', employeeId)
    .eq('scanned_date', today)
    .order('scanned_at', { ascending: true });
  
  const scanTypes = todayScans?.map(s => s.scan_type) || [];
  const hour = scanTime.getHours();
  const minutes = scanTime.getMinutes();
  const currentTime = hour * 60 + minutes; // Time in minutes from midnight
  
  // Define time thresholds (in minutes from midnight)
  const LUNCH_START = 12 * 60; // 12:00 PM
  const LUNCH_END = 14 * 60; // 2:00 PM
  const EXPECTED_CHECK_IN = 9 * 60; // 9:00 AM
  const EXPECTED_CHECK_OUT = 18 * 60; // 6:00 PM
  const LATE_THRESHOLD = 15; // 15 minutes late
  
  let scanType = 'check_in';
  let isLate = false;
  let isEarly = false;
  
  // Determine scan type based on existing scans
  if (!scanTypes.includes('check_in')) {
    scanType = 'check_in';
    // Check if late (after 9:15 AM)
    if (currentTime > EXPECTED_CHECK_IN + LATE_THRESHOLD) {
      isLate = true;
    }
  } else if (!scanTypes.includes('lunch_out') && currentTime >= LUNCH_START) {
    scanType = 'lunch_out';
  } else if (scanTypes.includes('lunch_out') && !scanTypes.includes('lunch_in')) {
    scanType = 'lunch_in';
  } else if (scanTypes.includes('lunch_in') && !scanTypes.includes('check_out')) {
    scanType = 'check_out';
    // Check if early departure (before 6:00 PM)
    if (currentTime < EXPECTED_CHECK_OUT) {
      isEarly = true;
    }
  } else {
    // All scans done, but allow re-scanning (will be handled as duplicate)
    scanType = 'check_out';
  }
  
  return { scanType, isLate, isEarly };
}

/**
 * Mark attendance in the database with automatic scan type detection
 * @param {Object} attendanceData - Attendance data from QR code
 * @returns {Promise<{success: boolean, data?: any, error?: string, scanType?: string}>}
 */
export async function markAttendance(attendanceData) {
  try {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please set environment variables.'
      };
    }
    
    const { employeeId, firstName, lastName, role, department, checkInTime, signature } = attendanceData;
    const scanTime = new Date();
    
    // Check if employee is on leave today
    const today = scanTime.toISOString().split('T')[0];
    const { data: leaveRequest } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_date', today)
      .eq('status', 'approved')
      .single();
    
    if (leaveRequest) {
      return {
        success: false,
        error: `You are on ${leaveRequest.leave_type === 'full_day' ? 'full day' : 'half day'} leave today`
      };
    }
    
    // Detect scan type automatically
    const { scanType, isLate, isEarly } = await detectScanType(employeeId, scanTime);
    
    // Check if this scan type already exists (prevent duplicates)
    const { data: existingScan } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('scanned_date', today)
      .eq('scan_type', scanType)
      .single();
    
    if (existingScan) {
      return {
        success: false,
        error: `${scanType.replace('_', ' ')} already recorded for today`
      };
    }
    
    // Determine if half day (only check-in or early check-out)
    const isHalfDay = scanType === 'check_in' && scanTime.getHours() < 12;
    
    // Insert attendance record
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        employee_name: `${firstName} ${lastName}`,
        employee_role: role,
        department: department || null,
        check_in_time: checkInTime,
        scanned_at: scanTime.toISOString(),
        scan_type: scanType,
        is_late: isLate,
        is_early_departure: isEarly,
        is_half_day: isHalfDay,
        signature_verified: true,
        qr_data: attendanceData
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error marking attendance:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark attendance'
      };
    }
    
    return {
      success: true,
      data,
      scanType
    };
  } catch (error) {
    console.error('Error marking attendance:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Get all attendance records
 * @param {number} limit - Maximum number of records to fetch
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getAttendanceRecords(limit = 100) {
  try {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please set environment variables.'
      };
    }
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching attendance records:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch attendance records'
      };
    }
    
    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}

/**
 * Get attendance records for a specific employee
 * @param {string} employeeId - Employee UUID
 * @param {number} limit - Maximum number of records to fetch
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getEmployeeAttendance(employeeId, limit = 50) {
  try {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please set environment variables.'
      };
    }
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching employee attendance:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch employee attendance'
      };
    }
    
    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}


