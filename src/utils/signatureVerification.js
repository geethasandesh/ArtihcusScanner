import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_QR_SECRET_KEY || 'artihcus_attendance_secret_2025';

/**
 * Verify the HMAC-SHA256 signature of QR code data
 * @param {Object} qrData - The QR code data object
 * @returns {boolean} - True if signature is valid
 */
export function verifyQrSignature(qrData) {
  try {
    const { employeeId, firstName, lastName, role, department, checkInTime, signature } = qrData;
    
    // Recreate the data string (same format as Flutter app)
    const dataToSign = `${employeeId}|${firstName}|${lastName}|${role}|${department || ''}|${checkInTime}`;
    
    // Generate HMAC-SHA256 signature
    const hmac = CryptoJS.HmacSHA256(dataToSign, SECRET_KEY);
    const expectedSignature = hmac.toString(CryptoJS.enc.Hex);
    
    // Compare signatures
    return expectedSignature === signature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Check if QR code timestamp is fresh (within 60 seconds)
 * @param {string} checkInTime - ISO 8601 timestamp string
 * @returns {boolean} - True if timestamp is fresh
 */
export function isTimestampFresh(checkInTime) {
  try {
    const qrTime = new Date(checkInTime);
    const now = new Date();
    const ageInSeconds = (now - qrTime) / 1000;
    
    // QR code is valid for 60 seconds
    return ageInSeconds >= 0 && ageInSeconds <= 60;
  } catch (error) {
    console.error('Error checking timestamp:', error);
    return false;
  }
}

/**
 * Validate QR code data structure
 * @param {Object} qrData - The QR code data object
 * @returns {boolean} - True if structure is valid
 */
export function validateQrDataStructure(qrData) {
  return (
    qrData &&
    typeof qrData === 'object' &&
    qrData.employeeId &&
    qrData.firstName &&
    qrData.lastName &&
    qrData.role &&
    qrData.checkInTime &&
    qrData.signature
  );
}

