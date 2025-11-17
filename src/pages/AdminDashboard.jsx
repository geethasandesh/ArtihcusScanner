import { useState, useEffect } from 'react';
import { getAllEmployeesAttendance, getDailySummary } from '../services/attendanceReports';
import { getPendingLeaveRequests, updateLeaveRequestStatus } from '../services/leaveManagement';
import { supabase } from '../services/supabase';

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'leaves'
  const [employeeMap, setEmployeeMap] = useState(new Map());

  useEffect(() => {
    loadEmployeeMap();
    if (activeTab === 'attendance') {
      loadAttendance();
    } else {
      loadLeaveRequests();
    }
  }, [selectedDate, activeTab]);

  const loadEmployeeMap = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, users!inner(first_name, last_name)');
      
      if (data) {
        const map = new Map();
        data.forEach(emp => {
          const user = emp.users;
          if (user) {
            map.set(emp.id, `${user.first_name} ${user.last_name}`);
          }
        });
        setEmployeeMap(map);
      }
    } catch (error) {
      // Fallback: try direct query if join fails
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, first_name, last_name');
        
        if (usersData) {
          const map = new Map();
          usersData.forEach(user => {
            map.set(user.id, `${user.first_name} ${user.last_name}`);
          });
          setEmployeeMap(map);
        }
      } catch (err) {
        console.error('Error loading employees:', err);
      }
    }
  };

  const loadAttendance = async () => {
    setLoading(true);
    const date = new Date(selectedDate);
    const result = await getAllEmployeesAttendance(date);
    
    if (result.success) {
      setAttendance(result.data || []);
    }
    setLoading(false);
  };

  const loadLeaveRequests = async () => {
    setLoading(true);
    const result = await getPendingLeaveRequests();
    
    if (result.success) {
      setLeaveRequests(result.data || []);
    }
    setLoading(false);
  };

  const handleLeaveAction = async (leaveId, status) => {
    // In real app, you'd get the admin ID from auth
    const result = await updateLeaveRequestStatus(leaveId, status, 'admin-id');
    if (result.success) {
      loadLeaveRequests();
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'attendance'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Daily Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'leaves'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Leave Requests
          </button>
        </div>

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <>
            <div className="mb-4 flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={loadAttendance}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">Loading...</div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lunch Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lunch In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {attendance.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{emp.employeeName}</div>
                          <div className="text-sm text-gray-500">{emp.department}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {formatTime(emp.checkIn?.scanned_at)}
                          {emp.isLate && <span className="ml-2 text-red-600 text-xs">Late</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">{formatTime(emp.lunchOut?.scanned_at)}</td>
                        <td className="px-6 py-4 text-sm">{formatTime(emp.lunchIn?.scanned_at)}</td>
                        <td className="px-6 py-4 text-sm">
                          {formatTime(emp.checkOut?.scanned_at)}
                          {emp.isEarlyDeparture && <span className="ml-2 text-orange-600 text-xs">Early</span>}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {emp.totalHours ? `${emp.totalHours}h` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {emp.isComplete ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Complete</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Incomplete</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Leave Requests Tab */}
        {activeTab === 'leaves' && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {loading ? (
              <div className="text-center py-12">Loading...</div>
            ) : leaveRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No pending leave requests</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leaveRequests.map((leave) => (
                      <tr key={leave.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">
                          {employeeMap.get(leave.employee_id) || leave.employee_id}
                        </td>
                      <td className="px-6 py-4">{new Date(leave.leave_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                          {leave.leave_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{leave.reason || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLeaveAction(leave.id, 'approved')}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleLeaveAction(leave.id, 'rejected')}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

