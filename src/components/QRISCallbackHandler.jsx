import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import CryptoJS from 'crypto-js';

// QRIS Payment Callback Handler Component
const QRISCallbackHandler = () => {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Memproses notifikasi pembayaran...');
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const referenceNo = urlParams.get('referenceNo');
    const status = urlParams.get('status');
    
    if (referenceNo && status) {
      handleCallback(referenceNo, status);
    } else {
      setStatus('error');
      setMessage('Parameter callback tidak valid');
    }
  }, []);

  const handleCallback = async (referenceNo, status) => {
    try {
      // In a real implementation, you would:
      // 1. Verify the signature from Yokke
      // 2. Update the payment status in your database
      // 3. Send confirmation back to Yokke
      
      setPaymentData({ referenceNo, status });
      
      if (status === 'success') {
        setStatus('success');
        setMessage('Pembayaran berhasil diterima!');
        
        // Auto redirect after 3 seconds
        setTimeout(() => {
          window.location.href = '/sales';
        }, 3000);
      } else {
        setStatus('error');
        setMessage('Pembayaran gagal atau dibatalkan');
      }
    } catch (error) {
      console.error('Callback processing error:', error);
      setStatus('error');
      setMessage('Terjadi kesalahan saat memproses callback');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />;
      case 'processing':
        return <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />;
      default:
        return <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8 text-center">
        {getStatusIcon()}
        
        <h2 className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>
          {status === 'success' ? 'Pembayaran Berhasil!' : 
           status === 'error' ? 'Pembayaran Gagal' : 
           'Memproses Pembayaran'}
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {message}
        </p>
        
        {paymentData && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Detail Transaksi:
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>Reference No: {paymentData.referenceNo}</div>
              <div>Status: {paymentData.status}</div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/sales'}
            className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Kembali ke Penjualan
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Ke Dashboard
          </button>
        </div>
        
        {status === 'success' && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Anda akan diarahkan ke halaman penjualan dalam 3 detik...
          </p>
        )}
      </div>
    </div>
  );
};

export default QRISCallbackHandler;
