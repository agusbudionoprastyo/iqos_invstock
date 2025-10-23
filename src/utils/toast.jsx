import { toast } from 'react-toastify';

// Custom toast styles with glass transparency effect
const glassToastStyle = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(15px)',
  WebkitBackdropFilter: 'blur(15px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '1.5rem',
  boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
  color: '#374151',
  fontWeight: '500',
  fontSize: '14px',
  padding: '12px 16px',
};

// Toast configuration
const toastConfig = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  style: glassToastStyle,
};

// Toast functions to replace SweetAlert2
export const showToast = {
  success: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.success(content, {
      ...toastConfig,
      icon: '✅',
    });
  },

  error: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.error(content, {
      ...toastConfig,
      icon: '❌',
    });
  },

  warning: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.warning(content, {
      ...toastConfig,
      icon: '⚠️',
    });
  },

  info: (message, title = '') => {
    const content = title ? `${title}\n${message}` : message;
    toast.info(content, {
      ...toastConfig,
      icon: 'ℹ️',
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
                background: 'rgba(34, 197, 94, 0.8)',
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
                background: 'rgba(239, 68, 68, 0.8)',
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
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#374151',
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
                background: 'rgba(34, 197, 94, 0.8)',
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
                background: 'rgba(107, 114, 128, 0.8)',
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
          autoClose: false,
          closeOnClick: false,
          draggable: false,
        }
      );
    });
  },
};

export default showToast;


