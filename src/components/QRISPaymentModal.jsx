import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, QrCode, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import qrisService from '../services/qrisService';
import QRCode from 'qrcode';
import qrisLogo from '../logo/512px-QRIS_Logo.png';

const QRISPaymentModal = ({ isOpen, onClose, paymentData, onPaymentSuccess }) => {
  const [qrData, setQrData] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [lastPaymentResult, setLastPaymentResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [statusMessage, setStatusMessage] = useState('Menunggu pembayaran...');
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [pollingInterval, setPollingInterval] = useState(null);
  const [showManualConfirm, setShowManualConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && paymentData) {
      // Reset previous state and service lock before generating new QR
      try {
        qrisService.resetGenerationLock?.();
      } catch {}
      setQrData(null);
      setQrImageUrl(null);
      setPaymentStatus('pending');
      setStatusMessage('Menunggu pembayaran...');
      generateQRCode();
    }
    // Lock body scroll while modal open
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow || '';
        // Cleanup QR image URL when modal closes
        setQrImageUrl(null);
      };
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
      // Calculate total amount from cart items
      const calculatedTotal = paymentData.items.reduce((total, item) => total + item.total, 0);
      
      console.log('Payment Data:', paymentData);
      console.log('Calculated Total:', calculatedTotal);
      console.log('Payment Total Amount:', paymentData.totalAmount);
      
      // Generate actual QR code
      const orderId = qrisService.generateOrderId();
      const result = await qrisService.generateQRCode({
        orderId: orderId,
        amount: calculatedTotal, // Use calculated total instead of paymentData.totalAmount
        description: `Pembayaran IQOS - ${paymentData.items.length} item`
      });

      if (result.success) {
        setQrData({
          qrContent: result.qrContent,
          referenceNo: result.referenceNo,
          partnerReferenceNo: result.partnerReferenceNo,
          orderId: orderId,
          callbackUrl: result.callbackUrl,
          externalId: result.externalId
        });
        
        // Generate QR code image
        try {
          const qrImageUrl = await QRCode.toDataURL(result.qrContent, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrImageUrl(qrImageUrl);
        } catch (qrError) {
          console.error('Error generating QR image:', qrError);
          setQrImageUrl(null);
        }
        
        setPaymentStatus('pending');
        setStatusMessage(`Silakan scan QR code untuk pembayaran Rp ${calculatedTotal.toLocaleString('id-ID')}`);
        
        // Show manual confirmation button for testing
        setShowManualConfirm(true);
      } else {
        setError(result.error);
        setPaymentStatus('failed');
        setStatusMessage('Gagal membuat QR code');
      }
      
    } catch (err) {
      setError(err.message);
      setPaymentStatus('failed');
      setStatusMessage('Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setLoading(false);
    }
  };

  const startStatusPolling = (referenceNo, partnerReferenceNo) => {
    const interval = setInterval(async () => {
      try {
        const originalTransactionDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        // For checkPaymentStatus, we need originalExternalId
        // Use referenceNo as originalExternalId (this is the external ID from QR generation)
        const result = await qrisService.checkPaymentStatus(
          referenceNo, 
          referenceNo, // Use referenceNo as originalExternalId
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

  const handleManualConfirm = () => {
    // Calculate total amount from cart items
    const calculatedTotal = paymentData.items.reduce((total, item) => total + item.total, 0);
    
    // Open callback URL in popup window for testing
    const callbackUrl = `${window.location.origin}/payment/callback?referenceNo=${qrData.referenceNo}&status=success&amount=${calculatedTotal}`;
    
    // Open popup window
    const popup = window.open(callbackUrl, 'paymentCallback', 'width=500,height=600,scrollbars=yes,resizable=yes');
    
    // Listen for message from popup
    const messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'PAYMENT_SUCCESS') {
        setPaymentStatus('success');
        setStatusMessage('Pembayaran berhasil!');
        setLastPaymentResult(event.data.data);
        onPaymentSuccess(event.data.data);
        window.removeEventListener('message', messageHandler);
      } else if (event.data.type === 'PAYMENT_FAILED') {
        setPaymentStatus('failed');
        setStatusMessage('Pembayaran gagal');
        window.removeEventListener('message', messageHandler);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Cleanup listener after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
    }, 30000);
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

  const handleCancelPayment = async () => {
    try {
      const calculatedTotal = paymentData.items.reduce((total, item) => total + item.total, 0);
      setLoading(true);
      setStatusMessage('Memproses pembatalan/refund...');

      const result = await qrisService.cancelPayment(
        qrData.referenceNo,
        qrData.partnerReferenceNo,
        qrData.externalId,
        'Customer request',
        calculatedTotal,
        lastPaymentResult?.approvalCode
      );

      if (result.success) {
        setStatusMessage('Transaksi berhasil dibatalkan / refund berhasil.');
        setPaymentStatus('refunded');
      } else {
        setStatusMessage(`Gagal membatalkan: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatusMessage(`Gagal membatalkan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAbortBeforePayment = async () => {
    try {
      // If we have QR references, try cancel endpoint; otherwise just close
      const calculatedTotal = paymentData.items.reduce((total, item) => total + item.total, 0);
      setLoading(true);
      setStatusMessage('Membatalkan transaksi yang belum dibayar...');

      if (qrData?.referenceNo && qrData?.partnerReferenceNo && qrData?.externalId) {
        const result = await qrisService.cancelPayment(
          qrData.referenceNo,
          qrData.partnerReferenceNo,
          qrData.externalId,
          'User cancelled before payment',
          calculatedTotal,
          undefined
        );

        if (result.success) {
          setStatusMessage('Transaksi dibatalkan.');
          setPaymentStatus('cancelled');
        } else {
          // Some gateways may not allow cancel before paid; treat as local cancel
          setStatusMessage('Tidak dapat batalkan via API, ditutup secara lokal.');
        }
      }
    } catch (err) {
      setStatusMessage('Tidak dapat batalkan via API, ditutup secara lokal.');
    } finally {
      setLoading(false);
      // Close modal after short delay
      setTimeout(() => {
        onClose?.();
      }, 500);
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

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ zIndex: 2147483647 }} onClick={onClose}>
      {loading && (
        <div className="qris-global-loading" onClick={(e) => e.stopPropagation()}>
          <div className="spinner"></div>
        </div>
      )}
      <div
        className="modal"
        style={{
          width: 'min(92vw, 360px)',
          maxWidth: '360px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          background: 'white',
          boxShadow: 'none',
          border: 'none',
          padding: 0,
          margin: '0 auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div>


      {/* QR Code Section */}
      {loading ? null : error ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      ) : qrData ? (
        <div className="qris-wrap">
          <div className="qris-overlay-header">
            <div className="qris-header-left"><img src={qrisLogo} alt="QRIS" className="qris-header-logo" /></div>
            <div className="qris-header-right">Hotel Dafam Semarang</div>
          </div>
          <div className="qris-card">
          <div className="qris-card-body">
            <div className="qris-user">
              <div className="qris-user-name">{paymentData?.customerName || 'Pelanggan'}</div>
              <div className="qris-user-bank">628{((paymentData?.customerPhone || '').slice(-4) || '0000').replace(/(\d{4})$/, '******')} {(paymentData?.customerPhone || '').slice(-4) || '  '}</div>
            </div>

            {qrImageUrl ? (
              <div className="qris-qr-wrapper">
                <img src={qrImageUrl} alt="QRIS" className="qris-qr-img" />
                <div className="qris-qr-code">{qrData?.referenceNo || ''}</div>
              </div>
            ) : null}
            <div className="qris-amount">Rp {Number(paymentData?.totalAmount || 0).toLocaleString('id-ID')}</div>
            <div className="qris-remark">
              {paymentData?.items?.length
                ? `${paymentData.items.map(i => `${i.productName} × ${i.quantity}`).join(', ')}`
                : '"Pembayaran"'}
            </div>

            <div className="qris-footer-note">
              <div>QR ini hanya untuk 1 kali transaksi</div>
              {paymentStatus === 'pending' && (
                <div className="qris-expire">Berakhir dalam {formatTime(timeLeft)}</div>
              )}
            </div>
          </div>
        </div>
        </div>
      ) : null}
        </div>
      </div>
      </div>,
    document.body
  );
};

export default QRISPaymentModal;
