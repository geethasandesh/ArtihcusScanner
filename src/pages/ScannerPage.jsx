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
    <div className="min-h-screen bg-gray-900 py-2 px-2">
      <div className="max-w-4xl mx-auto">
        {/* Compact Header */}
        <div className="text-center mb-2">
          <h1 className="text-xl font-semibold text-white">Attendance Scanner</h1>
        </div>

        {/* Last Scan Result - Only show errors */}
        {lastScan && !lastScan.success && (
          <div className="mb-2 p-2 rounded bg-red-500/90 text-white text-sm">
            <p>Error: {lastScan.error}</p>
          </div>
        )}

        {/* Scanner Component - No borders */}
        <QRScanner 
          onScanSuccess={handleScanSuccess}
          onScanError={handleScanError}
        />
      </div>
    </div>
  );
}

