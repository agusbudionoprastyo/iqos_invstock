import React, { useState, useEffect } from 'react';
import { X, QrCode, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import qrisService from '../services/qrisService';

const QRISPaymentModal = ({ isOpen, onClose, paymentData, onPaymentSuccess }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [statusMessage, setStatusMessage] = useState('Menunggu pembayaran...');
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    if (isOpen && paymentData) {
      generateQRCode();
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [isOpen, paymentData]);

  useEffect(() => {
    if (timeLeft > 0 && paymentStatus === 'pending') {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && paymentStatus === 'pending') {
      setPaymentStatus('expired');
      setStatusMessage('QR Code telah expired');
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }
  }, [timeLeft, paymentStatus]);

  const generateQRCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const orderId = qrisService.generateOrderId();
      const result = await qrisService.generateQRCode({
        orderId: orderId,
        amount: paymentData.totalAmount,
        description: `Pembayaran IQOS - ${paymentData.items.length} item`
      });

      if (result.success) {
        setQrData({
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          orderId: orderId
        });
        setPaymentStatus('pending');
        setStatusMessage('Silakan scan QR code untuk melakukan pembayaran');
        startStatusPolling(result.referenceNo, result.partnerReferenceNo);
      } else {
        setError(result.error);
        setPaymentStatus('failed');
        setStatusMessage('Gagal membuat QR code');
      }
    } catch (err) {
      setError(err.message);
      setPaymentStatus('failed');
      setStatusMessage('Terjadi kesalahan saat membuat QR code');
    } finally {
      setLoading(false);
    }
  };

  const startStatusPolling = (referenceNo, partnerReferenceNo) => {
    const interval = setInterval(async () => {
      try {
        const originalTransactionDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const result = await qrisService.checkPaymentStatus(
          referenceNo, 
          partnerReferenceNo, 
          originalTransactionDate
        );

        if (result.success) {
          const status = result.status;
          
          if (status === '00') { // Success
            setPaymentStatus('success');
            setStatusMessage('Pembayaran berhasil!');
            clearInterval(interval);
            setPollingInterval(null);
            
            // Call success callback after a short delay
            setTimeout(() => {
              onPaymentSuccess({
                referenceNo: result.referenceNo,
                amount: result.amount,
                paidTime: result.paidTime,
                approvalCode: result.approvalCode,
                customerName: result.customerName,
                issuerName: result.issuerName
              });
              onClose();
            }, 2000);
          } else if (status === '06') { // Failed
            setPaymentStatus('failed');
            setStatusMessage('Pembayaran gagal');
            clearInterval(interval);
            setPollingInterval(null);
          } else if (status === '05') { // Canceled
            setPaymentStatus('canceled');
            setStatusMessage('Pembayaran dibatalkan');
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      } catch (err) {
        console.error('Status polling error:', err);
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'failed':
      case 'expired':
      case 'canceled':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Clock className="w-8 h-8 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'success':
        return 'text-green-600';
      case 'failed':
      case 'expired':
      case 'canceled':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Pembayaran QRIS
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Payment Info */}
          <div className="mb-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Total Pembayaran
              </h3>
              <p className="text-3xl font-bold text-primary">
                Rp {paymentData.totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Detail Pembelian:
              </h4>
              {paymentData.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{item.productName} x{item.quantity}</span>
                  <span>Rp {item.total.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code Section */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">Membuat QR Code...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={generateQRCode}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
              >
                Coba Lagi
              </button>
            </div>
          ) : qrData ? (
            <div className="text-center">
              {/* QR Code */}
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4 inline-block">
                <div className="text-xs text-gray-500 mb-2">Scan QR Code dengan aplikasi pembayaran</div>
                <div className="font-mono text-xs break-all max-w-xs">
                  {qrData.qrContent}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center mb-4">
                {getStatusIcon()}
                <span className={`ml-2 font-medium ${getStatusColor()}`}>
                  {statusMessage}
                </span>
              </div>

              {/* Timer */}
              {paymentStatus === 'pending' && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Sisa waktu: {formatTime(timeLeft)}
                </div>
              )}
            </div>
          ) : null}

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Cara Pembayaran:
            </h4>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Buka aplikasi pembayaran (GoPay, OVO, DANA, dll)</li>
              <li>2. Pilih menu "Scan QR" atau "QRIS"</li>
              <li>3. Scan QR code di atas</li>
              <li>4. Konfirmasi pembayaran</li>
              <li>5. Tunggu konfirmasi pembayaran</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
          >
            Tutup
          </button>
          {paymentStatus === 'pending' && (
            <button
              onClick={generateQRCode}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
            >
              Refresh QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRISPaymentModal;
