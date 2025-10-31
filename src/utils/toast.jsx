import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

// Helper function to get toast background based on dark mode
const getToastBackground = () => {
  // Check if dark mode is active
  const isDarkMode = document.documentElement.classList.contains('dark-mode');
  
  if (isDarkMode) {
    // Dark mode: use card background with more transparency
    return 'rgba(52, 53, 59, 0.6)'; // card-background #34353b dengan opacity 0.6
  } else {
    // Light mode: use white with more transparency
    return 'rgba(255, 255, 255, 0.6)'; // White dengan opacity 0.6 (lebih transparan)
  }
};

// Custom toast styles - transparent blur without border, adaptive to dark/light mode
const getToastStyles = () => {
  const baseBackground = getToastBackground();
  
  return {
    success: {
      background: baseBackground,
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: 'none',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      color: 'var(--text-color)',
      fontWeight: '500',
      fontSize: '14px',
      padding: '24px 16px',
      // borderRadius: '12px',
    },
    error: {
      background: baseBackground,
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: 'none',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      color: 'var(--text-color)',
      fontWeight: '500',
      fontSize: '14px',
      padding: '24px 16px',
      // borderRadius: '12px',
    },
    warning: {
      background: baseBackground,
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: 'none',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      color: 'var(--text-color)',
      fontWeight: '500',
      fontSize: '14px',
      padding: '24px 16px',
      // borderRadius: '12px',
    },
    info: {
      background: baseBackground,
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: 'none',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      color: 'var(--text-color)',
      fontWeight: '500',
      fontSize: '14px',
      padding: '24px 16px',
      // borderRadius: '12px',
    },
    default: {
      background: baseBackground,
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
      border: 'none',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
      color: 'var(--text-color)',
      fontWeight: '500',
      fontSize: '14px',
      padding: '24px 16px',
      // borderRadius: '12px',
    },
  };
};

// Toast configuration
const toastConfig = {
  position: 'top-right',
  autoClose: 15000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

// Toast functions to replace SweetAlert2
export const showToast = {
  success: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    const toastStyles = getToastStyles();
    toast.success(content, {
      ...toastConfig,
      style: toastStyles.success,
      icon: <CheckCircle size={20} />,
    });
  },

  error: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    const toastStyles = getToastStyles();
    toast.error(content, {
      ...toastConfig,
      style: toastStyles.error,
      icon: <XCircle size={20} />,
    });
  },

  warning: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    const toastStyles = getToastStyles();
    toast.warning(content, {
      ...toastConfig,
      style: toastStyles.warning,
      icon: <AlertTriangle size={20} />,
    });
  },

  info: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    const toastStyles = getToastStyles();
    toast.info(content, {
      ...toastConfig,
      style: toastStyles.info,
      icon: <Info size={20} />,
    });
  },

  // For confirmation dialogs, we'll use a custom toast with action buttons
  confirm: async (message, title = 'Konfirmasi') => {
    return new Promise((resolve) => {
      const toastId = toast(
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', fontWeight: '600' }}>{title}</div>
          <div style={{ marginBottom: '16px' }}>{message}</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(true);
              }}
              style={{
                background: 'var(--success-color)',
                color: 'white',
                border: 'none',
                borderRadius: '1rem',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              Ya
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(false);
              }}
              style={{
                background: 'var(--error-color)',
                color: 'white',
                border: 'none',
                borderRadius: '1rem',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              Tidak
            </button>
          </div>
        </div>,
        {
          ...toastConfig,
          style: getToastStyles().default,
          autoClose: false,
          closeOnClick: false,
          draggable: false,
        }
      );
    });
  },

  // For input dialogs
  input: async (message, title = 'Input', placeholder = '') => {
    return new Promise((resolve) => {
      let inputValue = '';
      const toastId = toast(
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '12px', fontWeight: '600' }}>{title}</div>
          <div style={{ marginBottom: '12px' }}>{message}</div>
        <input
          type="text"
          placeholder={placeholder}
          onChange={(e) => (inputValue = e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: '1rem',
            background: 'var(--card-background)',
            color: 'var(--text-color)',
            marginBottom: '12px',
            fontSize: '14px',
          }}
          autoFocus
        />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(inputValue);
              }}
              style={{
                background: 'var(--success-color)',
                color: 'white',
                border: 'none',
                borderRadius: '1rem',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              OK
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(null);
              }}
              style={{
                background: 'var(--secondary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '1rem',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              Batal
            </button>
          </div>
        </div>,
        {
          ...toastConfig,
          style: getToastStyles().default,
          autoClose: false,
          closeOnClick: false,
          draggable: false,
        }
      );
    });
  },
};

export default showToast;