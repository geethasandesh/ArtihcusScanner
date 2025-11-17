import { supabase } from './supabase';

/**
 * Create a leave request
 * @param {string} employeeId - Employee UUID
 * @param {Date} leaveDate - Date of leave
 * @param {string} leaveType - 'full_day', 'half_day_morning', 'half_day_afternoon'
 * @param {string} reason - Reason for leave
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function createLeaveRequest(employeeId, leaveDate, leaveType, reason = '') {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }
    
    const dateStr = leaveDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: employeeId,
        leave_date: dateStr,
        leave_type: leaveType,
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create leave request'
    };
  }
}

/**
 * Get leave requests for an employee
 * @param {string} employeeId - Employee UUID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getEmployeeLeaveRequests(employeeId, startDate, endDate) {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }
    
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('leave_date', startDate.toISOString().split('T')[0])
      .lte('leave_date', endDate.toISOString().split('T')[0])
      .order('leave_date', { ascending: false });
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get leave requests'
    };
  }
}

/**
 * Approve or reject a leave request (Admin only)
 * @param {string} leaveRequestId - Leave request UUID
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} approvedBy - Admin/Manager UUID
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function updateLeaveRequestStatus(leaveRequestId, status, approvedBy) {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }
    
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status,
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', leaveRequestId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to update leave request'
    };
  }
}

/**
 * Get all pending leave requests (Admin view)
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
export async function getPendingLeaveRequests() {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }
    
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .order('leave_date', { ascending: true });
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to get pending leave requests'
    };
  }
}

