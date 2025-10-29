import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const PaymentCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Memproses callback pembayaran...');

  useEffect(() => {
    // Simulate processing callback
    const processCallback = async () => {
      try {
        console.log('Payment Callback received:', location);
        
        // Extract callback data from URL params or state
        const urlParams = new URLSearchParams(location.search);
        const referenceNo = urlParams.get('referenceNo');
        const status = urlParams.get('status');
        const amount = urlParams.get('amount');
        
        console.log('Callback parameters:', { referenceNo, status, amount });
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (status === 'success' || status === '00') {
          setStatus('success');
          setMessage('Pembayaran berhasil diproses!');
          
          // Notify parent window if opened from modal
          if (window.opener) {
            window.opener.postMessage({
              type: 'PAYMENT_SUCCESS',
              data: {
                referenceNo,
                status: 'success',
                amount,
                paidTime: new Date().toISOString()
              }
            }, window.location.origin);
            
            // Close popup after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          } else {
            // Redirect to success page or back to app
            setTimeout(() => {
              navigate('/sales');
            }, 3000);
          }
        } else {
          setStatus('failed');
          setMessage('Pembayaran gagal diproses');
          
          // Notify parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'PAYMENT_FAILED',
              data: { referenceNo, status: 'failed' }
            }, window.location.origin);
            
            setTimeout(() => {
              window.close();
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage('Terjadi kesalahan saat memproses callback');
      }
    };

    processCallback();
  }, [location, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
      default:
        return <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {getStatusIcon()}
        
        <h2 className={`text-xl font-semibold mb-4 ${getStatusColor()}`}>
          {status === 'success' ? 'Pembayaran Berhasil!' :
           status === 'failed' ? 'Pembayaran Gagal' :
           'Memproses Pembayaran...'}
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {message}
        </p>
        
        {status === 'processing' && (
          <div className="text-sm text-gray-500">
            Mohon tunggu sebentar...
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-sm text-gray-500">
            Halaman ini akan tertutup otomatis dalam beberapa detik.
          </div>
        )}
        
        {status === 'failed' && (
          <div className="text-sm text-gray-500">
            Silakan coba lagi atau hubungi customer service.
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
