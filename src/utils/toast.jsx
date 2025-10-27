import { toast } from 'react-toastify';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

// Custom toast styles with different colors for each type
const toastStyles = {
  success: {
    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(22, 163, 74, 0.95) 100%)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(34, 197, 94, 0.5)',
    boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
    color: '#ffffff',
    fontWeight: '500',
    fontSize: '14px',
    padding: '12px 16px',
  },
  error: {
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)',
    color: '#ffffff',
    fontWeight: '500',
    fontSize: '14px',
    padding: '12px 16px',
  },
  warning: {
    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.95) 0%, rgba(202, 138, 4, 0.95) 100%)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(234, 179, 8, 0.5)',
    boxShadow: '0 8px 32px rgba(234, 179, 8, 0.3)',
    color: '#ffffff',
    fontWeight: '500',
    fontSize: '14px',
    padding: '12px 16px',
  },
  info: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
    color: '#ffffff',
    fontWeight: '500',
    fontSize: '14px',
    padding: '12px 16px',
  },
  default: {
    background: 'var(--header-background)',
    backdropFilter: 'blur(15px)',
    WebkitBackdropFilter: 'blur(15px)',
    border: '1px solid var(--border-color)',
    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
    color: 'var(--text-color)',
    fontWeight: '500',
    fontSize: '14px',
    padding: '12px 16px',
  },
};

// Toast configuration
const toastConfig = {
  position: 'top-right',
  autoClose: 15000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

// Toast functions to replace SweetAlert2
export const showToast = {
  success: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.success(content, {
      ...toastConfig,
      style: toastStyles.success,
      icon: <CheckCircle size={20} />,
    });
  },

  error: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.error(content, {
      ...toastConfig,
      style: toastStyles.error,
      icon: <XCircle size={20} />,
    });
  },

  warning: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.warning(content, {
      ...toastConfig,
      style: toastStyles.warning,
      icon: <AlertTriangle size={20} />,
    });
  },

  info: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
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
          style: toastStyles.default,
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
          style: toastStyles.default,
          autoClose: false,
          closeOnClick: false,
          draggable: false,
        }
      );
    });
  },
};

export default showToast;


