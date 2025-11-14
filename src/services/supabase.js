import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Mark attendance in the database
 * @param {Object} attendanceData - Attendance data from QR code
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function markAttendance(attendanceData) {
  try {
    const { employeeId, firstName, lastName, role, department, checkInTime, signature } = attendanceData;
    
    // Check if attendance already exists for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingRecords } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('employee_id', employeeId)
      .gte('scanned_at', `${today}T00:00:00Z`)
      .lt('scanned_at', `${today}T23:59:59Z`)
      .limit(1);
    
    if (existingRecords && existingRecords.length > 0) {
      return {
        success: false,
        error: 'Attendance already marked for today'
      };
    }
    
    // Insert attendance record
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        employee_name: `${firstName} ${lastName}`,
        employee_role: role,
        department: department || null,
        check_in_time: checkInTime,
        scanned_at: new Date().toISOString(),
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
      data
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

