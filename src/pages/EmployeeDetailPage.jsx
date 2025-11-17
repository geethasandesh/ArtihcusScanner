import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDailySummary, getWeeklySummary, getMonthlySummary } from '../services/attendanceReports';

export default function EmployeeDetailPage() {
  const { employeeId } = useParams();
  const [view, setView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [view, selectedDate, selectedWeek, selectedMonth, employeeId]);

  const loadData = async () => {
    setLoading(true);
    let result;
    
    if (view === 'daily') {
      result = await getDailySummary(employeeId, new Date(selectedDate));
    } else if (view === 'weekly') {
      const weekStart = new Date(selectedWeek);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      result = await getWeeklySummary(employeeId, weekStart);
    } else {
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;
      result = await getMonthlySummary(employeeId, year, month);
    }
    
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Employee Attendance Details</h1>

        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('daily')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'daily' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'weekly' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Date Selectors */}
        <div className="mb-4">
          {view === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
          )}
          {view === 'weekly' && (
            <input
              type="date"
              value={selectedWeek.toISOString().split('T')[0]}
              onChange={(e) => setSelectedWeek(new Date(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
          )}
          {view === 'monthly' && (
            <input
              type="month"
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => setSelectedMonth(new Date(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : data && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {view === 'daily' && (
              <div>
                <h2 className="text-xl font-bold mb-4">Daily Summary - {selectedDate}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Check In</p>
                    <p className="text-2xl font-bold">{formatTime(data.checkIn?.scanned_at)}</p>
                    {data.isLate && <span className="text-xs text-red-600">Late</span>}
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">Lunch Out</p>
                    <p className="text-2xl font-bold">{formatTime(data.lunchOut?.scanned_at)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Lunch In</p>
                    <p className="text-2xl font-bold">{formatTime(data.lunchIn?.scanned_at)}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Check Out</p>
                    <p className="text-2xl font-bold">{formatTime(data.checkOut?.scanned_at)}</p>
                    {data.isEarlyDeparture && <span className="text-xs text-orange-600">Early</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-2xl font-bold">{data.totalHours || '-'}h</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Lunch Duration</p>
                    <p className="text-2xl font-bold">{data.lunchDuration || '-'} min</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="text-lg font-bold">
                      {data.isComplete ? 'Complete' : data.isHalfDay ? 'Half Day' : 'Incomplete'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {view === 'weekly' && (
              <div>
                <h2 className="text-xl font-bold mb-4">
                  Weekly Summary - {data.weekStart} to {data.weekEnd}
                </h2>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-2xl font-bold">{data.totalHours}h</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Working Days</p>
                    <p className="text-2xl font-bold">{data.workingDays}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">Leave Days</p>
                    <p className="text-2xl font-bold">{data.leaveDays}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Avg Hours/Day</p>
                    <p className="text-2xl font-bold">{data.averageHours}h</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.dailySummaries.map((day, idx) => (
                    <div key={idx} className="p-4 border rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium">{day.date}</p>
                        <p className="text-sm text-gray-600">
                          {formatTime(day.checkIn?.scanned_at)} - {formatTime(day.checkOut?.scanned_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{day.totalHours || '-'}h</p>
                        {day.isLate && <span className="text-xs text-red-600">Late</span>}
                        {day.isEarlyDeparture && <span className="text-xs text-orange-600">Early</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'monthly' && (
              <div>
                <h2 className="text-xl font-bold mb-4">
                  Monthly Summary - {data.monthName} {data.year}
                </h2>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-2xl font-bold">{data.totalHours}h</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600">Working Days</p>
                    <p className="text-2xl font-bold">{data.workingDays}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-600">Leave Days</p>
                    <p className="text-2xl font-bold">{data.leaveDays}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Attendance %</p>
                    <p className="text-2xl font-bold">{data.attendancePercentage}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-600">Late Arrivals</p>
                    <p className="text-2xl font-bold">{data.lateArrivals}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Early Departures</p>
                    <p className="text-2xl font-bold">{data.earlyDepartures}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


