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

      // Configuration to prevent zoom and use wide angle
      const config = {
        fps: 10, // Optimal FPS for detection
        qrbox: { width: qrboxSize, height: qrboxSize },
        // Don't set aspectRatio - let camera use its natural aspect ratio
        disableFlip: false, // Allow QR code in any orientation
        videoConstraints: {
          facingMode: cameraId ? undefined : "environment",
          // Request wide angle by using lower resolution or no constraints
          // Lower resolution typically uses wider field of view
          width: { ideal: 640 },
          height: { ideal: 480 },
          // Explicitly disable zoom if supported
          zoom: false
        },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      };

      await html5QrCode.start(
        cameraId || { facingMode: "environment" },
        config,
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
      
      // Fix zoom issue by accessing video element directly after a short delay
      setTimeout(() => {
        const readerElement = document.getElementById('reader');
        if (readerElement) {
          const videoElement = readerElement.querySelector('video');
          if (videoElement) {
            // Ensure video uses contain (no zoom/crop) and full field of view
            videoElement.style.objectFit = 'contain';
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.transform = 'none';
            
            // Try to get the video track and disable zoom if possible
            const stream = videoElement.srcObject;
            if (stream) {
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack && videoTrack.getSettings) {
                const settings = videoTrack.getSettings();
                console.log('Camera settings:', settings);
                // If zoom is available, try to set it to minimum
                if (videoTrack.getCapabilities && 'zoom' in videoTrack.getCapabilities()) {
                  const capabilities = videoTrack.getCapabilities();
                  if (capabilities.zoom) {
                    videoTrack.applyConstraints({
                      advanced: [{ zoom: capabilities.zoom.min || 1 }]
                    }).catch(err => console.log('Could not set zoom:', err));
                  }
                }
              }
            }
          }
        }
      }, 500);
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
        // Show success confirmation with scan type
        const scanTypeLabels = {
          'check_in': 'Checked In',
          'lunch_out': 'Lunch Break Started',
          'lunch_in': 'Lunch Break Ended',
          'check_out': 'Checked Out'
        };
        
        setSuccessData({
          employeeName: `${qrData.firstName} ${qrData.lastName}`,
          department: qrData.department || 'N/A',
          role: qrData.role,
          scanType: scanTypeLabels[result.scanType] || result.scanType
        });
        setStatus(`${scanTypeLabels[result.scanType] || result.scanType} successfully!`);
        
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
              
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{successData.scanType || 'Attendance Marked'}!</h3>
              <p className="text-lg font-semibold text-primary-600 mb-1">{successData.employeeName}</p>
              <p className="text-sm text-gray-600 mb-4">{successData.department} • {successData.role}</p>
              <p className="text-sm text-gray-500">Scanning will resume automatically...</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Container - Simple, no borders */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 150px)', minHeight: '400px' }}>
        <div 
          id="reader" 
          className="w-full h-full overflow-hidden bg-black"
        />
        
        {/* Simple Status Text - Only when scanning */}
        {scanning && (
          <div className="absolute bottom-4 left-0 right-0 px-4 pointer-events-none">
            <div className="bg-black/60 text-white text-center py-2 px-4 rounded max-w-xs mx-auto">
              <p className="text-sm">{scanHint}</p>
            </div>
          </div>
        )}

        {!scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="text-center text-white">
              <p className="text-lg font-medium">Camera not active</p>
              <p className="text-sm text-gray-300 mt-1">Click "Start Scanning" to begin</p>
            </div>
          </div>
        )}
      </div>

      {/* Compact Status and Control */}
      <div className="mt-2 flex items-center gap-2">
        {/* Compact Status */}
        <div className={`flex-1 px-3 py-2 rounded text-sm ${
          error 
            ? 'bg-red-500/90 text-white' 
            : scanning 
              ? 'bg-blue-500/90 text-white' 
              : 'bg-gray-700 text-gray-200'
        }`}>
          <p>{status}</p>
        </div>

        {/* Compact Control Button */}
        {!scanning ? (
          <button
            onClick={startScanning}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Start
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

