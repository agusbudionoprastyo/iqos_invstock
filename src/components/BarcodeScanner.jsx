import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';

const BarcodeScanner = ({ onScan, onClose, isOpen, title = 'Scan Barcode' }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef(null);
  const scannerContainerIdRef = useRef(`html5qr-${Math.random().toString(36).slice(2)}`);
  const lastScannedRef = useRef('');
  const scanProcessedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      clearState();
      initializeScanner();
    } else {
      clearState();
      stopScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const clearState = () => {
    setScannedCode('');
    setError('');
    setManualCode('');
    setIsScanning(false);
    setHasPermission(false);
    lastScannedRef.current = '';
    scanProcessedRef.current = false;
  };

  const initializeScanner = async () => {
    try {
      setError('');
      setHasPermission(false);

      // Prepare html5-qrcode instance
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerIdRef.current, /* verbose= */ false);
      }

      // Try to get cameras and prefer back camera
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setError('Kamera tidak ditemukan.');
        return;
      }
      const backCamera = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[0];

      const config = {
        fps: 10,
        // Remove qrbox restriction to allow scanning anywhere in camera view
        aspectRatio: 1.777,
        rememberLastUsedCamera: true,
        // Better focus and scanning - optimized for inventory use
        focusMode: 'continuous(maxFocusAreas=1)',
        focusDistance: 0.1, // Auto-focus for better barcode detection at various distances
        // Support common barcodes used in retail
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await scannerRef.current.start(
        backCamera.id,
        config,
        (decodedText /*, result*/ ) => {
          if (!decodedText) return;
          
          // Prevent duplicate scans of the same barcode
          if (lastScannedRef.current === decodedText && scanProcessedRef.current) {
            return;
          }
          
          // Mark as processed and store last scanned
          lastScannedRef.current = decodedText;
          scanProcessedRef.current = true;
          
          setScannedCode(decodedText);
          onScan(decodedText);
          
          // Auto close after successful scan
          setTimeout(() => {
            handleClose();
          }, 1000);
        },
        (err) => {
          // Ignore frequent decode errors while scanning
        }
      );
      setHasPermission(true);
      setIsScanning(true);
    } catch (err) {
      console.error('Scanner init error:', err);
      setError('Tidak dapat memulai pemindai: ' + (err?.message || String(err)));
    }
  };

  const startScanning = () => {
    // No-op with html5-qrcode; scanning starts in initializeScanner
  };

  const stopScanner = async () => {
    setIsScanning(false);
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (e) {
      // ignore stop errors
    }
  };

  const handleClose = () => {
    clearState();
    stopScanner();
    onClose();
  };

  const handleRetry = () => {
    clearState();
    initializeScanner();
  };


  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--card-background)',
        borderRadius: '1.5rem',
        padding: '1rem',
        width: '100%',
        maxWidth: '28rem',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>

        {/* Scanner Container (html5-qrcode mounts here) */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          backgroundColor: 'var(--background-color)',
          borderRadius: '1rem',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <div id={scannerContainerIdRef.current} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error-color)',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center'
          }}>
            <AlertCircle size={20} style={{ color: 'var(--error-color)', marginRight: '0.5rem' }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--error-color)', margin: 0 }}>
                {error}
              </p>
              <button
                onClick={handleRetry}
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--error-color)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {scannedCode && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--success-color)',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center'
          }}>
            <CheckCircle size={20} style={{ color: 'var(--success-color)', marginRight: '0.5rem' }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--success-color)', margin: 0 }}>
                Barcode berhasil dipindai!
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--success-color)', marginTop: '0.25rem', margin: 0 }}>
                {scannedCode}
              </p>
            </div>
          </div>
        )}

        {/* Instructions for iOS */}
        {/* <div style={{
          backgroundColor: 'var(--card-background)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem'
        }}> */}
          {/* <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', margin: 0 }}>
            Tips untuk iPhone:
          </h4> */}
          {/* <ul style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0, paddingLeft: '1rem' }}>
            <li>Pastikan barcode dalam kondisi baik dan tidak rusak</li>
            <li>Jaga jarak yang tepat antara kamera dan barcode</li>
            <li>Pastikan pencahayaan cukup terang</li>
            <li>Jika tidak berhasil, coba refresh halaman</li>
          </ul>
        </div> */}

        {/* Manual Input Fallback */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)', marginBottom: '0.5rem', display: 'block' }}>
            Atau masukkan barcode secara manual:
          </label>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Masukkan kode barcode"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              backgroundColor: 'var(--card-background)',
              color: 'var(--text-color)'
            }}
          />
          {manualCode && (
            <button
              onClick={() => {
                if (manualCode && manualCode !== lastScannedRef.current) {
                  lastScannedRef.current = manualCode;
                  scanProcessedRef.current = true;
                  onScan(manualCode);
                }
                setManualCode('');
                handleClose();
              }}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                backgroundColor: 'var(--success-color)',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Gunakan Kode Manual
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              backgroundColor: 'var(--secondary-color)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Tutup
          </button>
          {scannedCode && (
            <button
              onClick={() => {
                if (!scanProcessedRef.current) {
                  onScan(scannedCode);
                  scanProcessedRef.current = true;
                }
                setScannedCode('');
                handleClose();
              }}
              style={{
                flex: 1,
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Gunakan
            </button>
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;