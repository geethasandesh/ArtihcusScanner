import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScanType } from 'html5-qrcode';
import { verifyQrSignature, isTimestampFresh, validateQrDataStructure } from '../utils/signatureVerification';
import { markAttendance } from '../services/supabase';

export default function QRScanner({ onScanSuccess, onScanError }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('Ready to scan');
  const [error, setError] = useState(null);
  const [scanHint, setScanHint] = useState('Position QR code within the frame');
  const [successData, setSuccessData] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scanAttemptsRef = useRef(0);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => {
          console.error('Error stopping scanner:', err);
        });
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      setStatus('Initializing camera...');
      
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      // Get viewport dimensions for scanning
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Use larger scanning area - scan most of the viewport for better detection
      const qrboxSize = Math.min(viewportWidth * 0.95, viewportHeight * 0.7, 800);

      // Try to get the best available camera
      const cameras = await Html5Qrcode.getCameras();
      console.log('Available cameras:', cameras);
      
      let cameraId = null;
      if (cameras && cameras.length > 0) {
        // Prefer back camera (environment)
        const backCamera = cameras.find(cam => cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('rear'));
        cameraId = backCamera ? backCamera.id : cameras[0].id;
        console.log('Using camera:', cameraId);
      }

      await html5QrCode.start(
        cameraId || { facingMode: "environment" }, // Use specific camera or fallback to facingMode
        {
          fps: 10, // Optimal FPS for detection
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0, // Square scanning area
          disableFlip: false, // Allow QR code in any orientation
          videoConstraints: {
            facingMode: "environment",
            // Higher resolution for better quality and detection
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          },
          // Additional config for better scanning
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        (decodedText, decodedResult) => {
          // Success callback - QR code detected
          console.log('QR Code detected:', decodedText);
          scanAttemptsRef.current = 0;
          setScanHint('QR code detected!');
          handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Error callback - provide helpful hints
          // Only log errors occasionally to avoid console spam
          if (scanAttemptsRef.current % 100 === 0) {
            console.log('Scanning... (this is normal when no QR code is visible)');
          }
          scanAttemptsRef.current += 1;
          
          // Update hint based on scan attempts
          if (scanAttemptsRef.current > 30) {
            setScanHint('Move closer to the QR code');
          } else if (scanAttemptsRef.current > 60) {
            setScanHint('Ensure QR code is well-lit and clear');
          } else if (scanAttemptsRef.current > 90) {
            setScanHint('Hold the phone steady and ensure QR code fills the frame');
          }
        }
      ).catch((err) => {
        // Handle initialization errors
        throw err;
      });

      setScanning(true);
      setStatus('Scanning... Point camera at QR code');
      console.log('Scanner started successfully');
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError(`Failed to start camera: ${err.message}. Please check permissions and try again.`);
      setStatus('Camera error');
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
      setScanning(false);
      setStatus('Scanner stopped');
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  };

  const handleScanSuccess = async (decodedText) => {
    try {
      // Stop scanning temporarily
      await stopScanning();
      setStatus('Processing QR code...');

      // Parse JSON from QR code
      let qrData;
      try {
        qrData = JSON.parse(decodedText);
      } catch (parseError) {
        throw new Error('Invalid QR code format');
      }

      // Validate structure
      if (!validateQrDataStructure(qrData)) {
        throw new Error('QR code missing required fields');
      }

      // Verify signature
      if (!verifyQrSignature(qrData)) {
        throw new Error('Invalid QR code signature. Code may be tampered with.');
      }

      // Check timestamp freshness
      if (!isTimestampFresh(qrData.checkInTime)) {
        throw new Error('QR code expired. Please generate a new one.');
      }

      // Mark attendance
      setStatus('Marking attendance...');
      const result = await markAttendance(qrData);

      if (result.success) {
        // Show success confirmation
        setSuccessData({
          employeeName: `${qrData.firstName} ${qrData.lastName}`,
          department: qrData.department || 'N/A',
          role: qrData.role
        });
        setStatus('Attendance marked successfully!');
        
        if (onScanSuccess) {
          onScanSuccess(result.data, qrData);
        }
        
        // Auto-restart scanning after 3 seconds
        setTimeout(() => {
          setSuccessData(null);
          scanAttemptsRef.current = 0;
          startScanning();
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(err.message || 'Failed to process QR code');
      setStatus('Error: ' + (err.message || 'Unknown error'));
      
      // Auto-restart scanning after 3 seconds
      setTimeout(() => {
        startScanning();
      }, 3000);
      
      if (onScanError) {
        onScanError(err);
      }
    }
  };

  return (
    <div className="w-full h-full relative">
      {/* Success Confirmation Overlay */}
      {successData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* Success Checkmark */}
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4">
                <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Attendance Marked!</h3>
              <p className="text-lg font-semibold text-primary-600 mb-1">{successData.employeeName}</p>
              <p className="text-sm text-gray-600 mb-4">{successData.department} • {successData.role}</p>
              <p className="text-sm text-gray-500">Scanning will resume automatically...</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Container */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
        <div 
          id="reader" 
          className="w-full h-full rounded-lg overflow-hidden bg-black"
        />
        
        {/* Scanning Overlay with Instructions */}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner Guides */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative" style={{ width: '85vw', maxWidth: '500px', aspectRatio: '1/1' }}>
                {/* Top Left Corner */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                {/* Top Right Corner */}
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                {/* Bottom Left Corner */}
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                {/* Bottom Right Corner */}
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-lg"></div>
              </div>
            </div>
            
            {/* Scan Hint at Bottom */}
            <div className="absolute bottom-8 left-0 right-0 px-4">
              <div className="bg-black bg-opacity-70 text-white rounded-lg px-4 py-3 text-center max-w-md mx-auto">
                <p className="text-sm font-medium">{scanHint}</p>
                <p className="text-xs mt-1 text-gray-300">Keep the QR code within the frame</p>
              </div>
            </div>
          </div>
        )}

        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
            <div className="text-center text-white">
              <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p className="text-xl font-medium">Camera not active</p>
              <p className="text-sm text-gray-300 mt-2">Click "Start Scanning" to begin</p>
            </div>
          </div>
        )}
      </div>

      {/* Status and Error Messages */}
      <div className="mt-4">
        <div className={`p-3 rounded-lg ${
          error 
            ? 'bg-red-50 text-red-800 border border-red-200' 
            : scanning 
              ? 'bg-blue-50 text-blue-800 border border-blue-200' 
              : 'bg-gray-50 text-gray-800 border border-gray-200'
        }`}>
          <p className="font-medium">{status}</p>
          {error && (
            <p className="text-sm mt-1">{error}</p>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4 mt-4">
        {!scanning ? (
          <button
            onClick={startScanning}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Start Scanning
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop Scanning
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Tips for better scanning:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Ensure good lighting and hold the QR code steady</li>
          <li>• Position the QR code within the white frame</li>
          <li>• Keep the phone screen at a comfortable distance (not too close or far)</li>
          <li>• QR codes expire after 60 seconds - make sure it's fresh</li>
        </ul>
      </div>
    </div>
  );
}

