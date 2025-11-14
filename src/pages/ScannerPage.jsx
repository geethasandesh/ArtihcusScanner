import { useState } from 'react';
import { Link } from 'react-router-dom';
import QRScanner from '../components/QRScanner';

export default function ScannerPage() {
  const [lastScan, setLastScan] = useState(null);

  const handleScanSuccess = (attendanceData, qrData) => {
    setLastScan({
      employee: qrData.firstName + ' ' + qrData.lastName,
      department: qrData.department || 'N/A',
      time: new Date().toLocaleTimeString(),
      success: true
    });
  };

  const handleScanError = (error) => {
    setLastScan({
      error: error.message,
      time: new Date().toLocaleTimeString(),
      success: false
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Attendance Scanner</h1>
          <p className="text-gray-600">Scan QR codes to mark employee attendance</p>
        </div>

        {/* Last Scan Result - Only show errors here, success is shown in overlay */}
        {lastScan && !lastScan.success && (
          <div className="mb-4 p-4 rounded-lg shadow-md bg-red-50 border border-red-200">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <div>
                <p className="font-semibold text-red-800">Scan Failed</p>
                <p className="text-sm text-red-700">{lastScan.error} - {lastScan.time}</p>
              </div>
            </div>
          </div>
        )}

        {/* Scanner Component */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <QRScanner 
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
          />
        </div>
      </div>
    </div>
  );
}

