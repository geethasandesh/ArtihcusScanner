import { supabase } from './supabase';

/**
 * Get daily attendance summary for an employee
 * @param {string} employeeId - Employee UUID
 * @param {Date} date - Date to get summary for
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getDailySummary(employeeId, date) {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Get all scans for the day
    const { data: scans, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('scanned_date', dateStr)
      .order('scanned_at', { ascending: true });
    
    if (error) throw error;
    
    // Organize scans by type
    const checkIn = scans.find(s => s.scan_type === 'check_in');
    const lunchOut = scans.find(s => s.scan_type === 'lunch_out');
    const lunchIn = scans.find(s => s.scan_type === 'lunch_in');
    const checkOut = scans.find(s => s.scan_type === 'check_out');
    
    // Calculate working hours
    let totalHours = null;
    let lunchDuration = null;
    
    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn.scanned_at);
      const checkOutTime = new Date(checkOut.scanned_at);
      const totalMinutes = (checkOutTime - checkInTime) / (1000 * 60);
      
      if (lunchOut && lunchIn) {
        const lunchOutTime = new Date(lunchOut.scanned_at);
        const lunchInTime = new Date(lunchIn.scanned_at);
        lunchDuration = (lunchInTime - lunchOutTime) / (1000 * 60);
        totalHours = (totalMinutes - lunchDuration) / 60;
      } else {
        totalHours = totalMinutes / 60;
      }
    }
    
    // Check for leave
    const { data: leave } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('leave_date', dateStr)
      .eq('status', 'approved')
      .single();
    
    return {
      success: true,
      data: {
        date: dateStr,
        checkIn,
        lunchOut,
        lunchIn,
        checkOut,
        totalHours: totalHours ? parseFloat(totalHours.toFixed(2)) : null,
        lunchDuration: lunchDuration ? Math.round(lunchDuration) : null,
        isComplete: !!(checkIn && checkOut),
        isHalfDay: checkIn?.is_half_day || false,
        isLate: checkIn?.is_late || false,
        isEarlyDeparture: checkOut?.is_early_departure || false,
        leave: leave || null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get daily summary'
    };
  }
}

/**
 * Get weekly attendance summary for an employee
 * @param {string} employeeId - Employee UUID
 * @param {Date} weekStart - Start date of the week
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getWeeklySummary(employeeId, weekStart) {
  try {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const dailySummaries = [];
    let totalHours = 0;
    let workingDays = 0;
    let leaveDays = 0;
    
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const summary = await getDailySummary(employeeId, new Date(d));
      if (summary.success) {
        dailySummaries.push(summary.data);
        if (summary.data.totalHours) {
          totalHours += summary.data.totalHours;
          workingDays++;
        }
        if (summary.data.leave) {
          leaveDays++;
        }
      }
    }
    
    return {
      success: true,
      data: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        dailySummaries,
        totalHours: parseFloat(totalHours.toFixed(2)),
        workingDays,
        leaveDays,
        averageHours: workingDays > 0 ? parseFloat((totalHours / workingDays).toFixed(2)) : 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get weekly summary'
    };
  }
}

/**
 * Get monthly attendance summary for an employee
 * @param {string} employeeId - Employee UUID
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function getMonthlySummary(employeeId, year, month) {
  try {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const dailySummaries = [];
    let totalHours = 0;
    let workingDays = 0;
    let leaveDays = 0;
    let lateArrivals = 0;
    let earlyDepartures = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const summary = await getDailySummary(employeeId, new Date(d));
      if (summary.success) {
        dailySummaries.push(summary.data);
        if (summary.data.totalHours) {
          totalHours += summary.data.totalHours;
          workingDays++;
        }
        if (summary.data.leave) {
          leaveDays++;
        }
        if (summary.data.isLate) lateArrivals++;
        if (summary.data.isEarlyDeparture) earlyDepartures++;
      }
    }
    
    return {
      success: true,
      data: {
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        dailySummaries,
        totalHours: parseFloat(totalHours.toFixed(2)),
        workingDays,
        leaveDays,
        lateArrivals,
        earlyDepartures,
        averageHours: workingDays > 0 ? parseFloat((totalHours / workingDays).toFixed(2)) : 0,
        attendancePercentage: ((workingDays / (endDate.getDate() - leaveDays)) * 100).toFixed(1)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get monthly summary'
    };
  }
}

/**
 * Get all employees attendance for a date (Admin view)
 * @param {Date} date - Date to get attendance for
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getAllEmployeesAttendance(date) {
  try {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Get all attendance records for the date
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('scanned_date', dateStr)
      .order('scanned_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by employee
    const employeeMap = new Map();
    
    records.forEach(record => {
      if (!employeeMap.has(record.employee_id)) {
        employeeMap.set(record.employee_id, {
          employeeId: record.employee_id,
          employeeName: record.employee_name,
          department: record.department,
          role: record.employee_role,
          scans: []
        });
      }
      employeeMap.get(record.employee_id).scans.push(record);
    });
    
    // Calculate summary for each employee
    const employees = Array.from(employeeMap.values()).map(emp => {
      const checkIn = emp.scans.find(s => s.scan_type === 'check_in');
      const lunchOut = emp.scans.find(s => s.scan_type === 'lunch_out');
      const lunchIn = emp.scans.find(s => s.scan_type === 'lunch_in');
      const checkOut = emp.scans.find(s => s.scan_type === 'check_out');
      
      let totalHours = null;
      if (checkIn && checkOut) {
        const checkInTime = new Date(checkIn.scanned_at);
        const checkOutTime = new Date(checkOut.scanned_at);
        const totalMinutes = (checkOutTime - checkInTime) / (1000 * 60);
        
        if (lunchOut && lunchIn) {
          const lunchDuration = (new Date(lunchIn.scanned_at) - new Date(lunchOut.scanned_at)) / (1000 * 60);
          totalHours = (totalMinutes - lunchDuration) / 60;
        } else {
          totalHours = totalMinutes / 60;
        }
      }
      
      return {
        ...emp,
        checkIn,
        lunchOut,
        lunchIn,
        checkOut,
        totalHours: totalHours ? parseFloat(totalHours.toFixed(2)) : null,
        isComplete: !!(checkIn && checkOut),
        isLate: checkIn?.is_late || false,
        isEarlyDeparture: checkOut?.is_early_departure || false
      };
    });
    
    return {
      success: true,
      data: employees
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get employees attendance'
    };
  }
}

