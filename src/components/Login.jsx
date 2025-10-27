import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, X } from 'lucide-react';
import { userService } from '../services/database';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeDefaultUser();
  }, []);

  const initializeDefaultUser = async () => {
    try {
      // Check if default user exists
      const existingUser = await userService.getUserByUsername('yaya');
      
      if (!existingUser) {
        // Create default user
        await userService.createUser({
          username: 'yaya',
          password: 'Ya7ya777',
          name: 'Administrator',
          role: 'admin',
          email: 'admin@iqos.com'
        });
        console.log('Default user created successfully');
      }
    } catch (error) {
      console.error('Error initializing default user:', error);
    } finally {
      setInitializing(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear previous errors

    try {
      // Validate input
      if (!formData.username.trim()) {
        setError('Username tidak boleh kosong');
        setLoading(false);
        return;
      }

      if (!formData.password.trim()) {
        setError('Password tidak boleh kosong');
        setLoading(false);
        return;
      }

      // Authenticate user from database
      const user = await userService.authenticateUser(formData.username, formData.password);
      
      if (user) {
        // Store login state in localStorage
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('username', user.username);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('userName', user.name);
        
        onLogin(true);
      } else {
        setError('Username atau password salah. Mohon periksa kembali.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Terjadi kesalahan saat login. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background-color)',
        padding: '1rem',
        boxSizing: 'border-box'
      }}>
        <div style={{
          background: window.innerWidth <= 768 ? 'transparent' : 'var(--card-background)',
          borderRadius: window.innerWidth <= 768 ? '0' : '1rem',
          boxShadow: window.innerWidth <= 768 ? 'none' : '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: window.innerWidth <= 768 ? '1rem' : '2rem',
          textAlign: 'center',
          border: window.innerWidth <= 768 ? 'none' : '1px solid var(--border-color)'
        }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: 'var(--secondary-color)' }}>Menginisialisasi sistem...</p>
        </div>
      </div>
    );
  }

  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background-color)',
      padding: isMobile ? '0.25rem' : '1rem',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: isMobile ? 'center' : 'center',
        justifyContent: 'center',
        paddingTop: isMobile ? '0' : '0',
        overflow: 'hidden'
      }}>
        <div style={{
          background: isMobile ? 'transparent' : 'var(--card-background)',
          borderRadius: isMobile ? '0' : '1rem',
          boxShadow: isMobile ? 'none' : '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: isMobile ? '2rem' : '2rem',
          width: '100%',
          maxWidth: '400px',
          border: isMobile ? 'none' : '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
        {/* Logo/Header */}
        <div style={{
          textAlign: 'right',
          marginBottom: isMobile ? '0.75rem' : '2rem'
        }}>
          <h1 style={{
            fontSize: isMobile ? '1.1rem' : '1.5rem',
            fontWeight: '600',
            color: 'var(--text-color)',
            margin: 0
          }}>
            IQOS
          </h1>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '0.5rem',
            padding: isMobile ? '0.5rem' : '1rem',
            marginBottom: isMobile ? '0.75rem' : '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <AlertCircle 
              size={20} 
              color="#dc2626" 
              style={{ 
                flexShrink: 0,
                marginTop: '2px'
              }} 
            />
            <div style={{ flex: 1 }}>
              <p style={{
                margin: 0,
                color: '#991b1b',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
                lineHeight: '1.4'
              }}>
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#991b1b',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '500',
              color: 'var(--text-color)',
              marginBottom: '0.5rem'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User 
                size={isMobile ? 18 : 20}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: error ? '#dc2626' : 'var(--secondary-color)'
                }} 
              />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Masukkan username"
                required
                style={{
                  width: '100%',
                  padding: isMobile ? '0.6rem 0.75rem 0.6rem 3rem' : '0.75rem 0.75rem 0.75rem 3rem',
                  border: error ? '1px solid #dc2626' : '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  fontSize: isMobile ? '0.8rem' : '0.875rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  backgroundColor: 'var(--card-background)',
                  color: 'var(--text-color)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary-color)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '500',
              color: 'var(--text-color)',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={isMobile ? 18 : 20}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: error ? '#dc2626' : 'var(--secondary-color)'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Masukkan password"
                required
                style={{
                  width: '100%',
                  padding: isMobile ? '0.5rem 3rem 0.5rem 3rem' : '0.75rem 3rem 0.75rem 3rem',
                  border: error ? '1px solid #dc2626' : '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  fontSize: isMobile ? '0.8rem' : '0.875rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  backgroundColor: 'var(--card-background)',
                  color: 'var(--text-color)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary-color)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? '#dc2626' : 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--secondary-color)',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? <EyeOff size={isMobile ? 18 : 20} /> : <Eye size={isMobile ? 18 : 20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: isMobile ? '0.5rem' : '0.75rem',
              background: loading ? 'var(--secondary-color)' : 'linear-gradient(135deg,rgb(243, 6, 125) 0%,rgb(244, 139, 185) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: isMobile ? '0.875rem' : '1rem',
                  height: isMobile ? '0.875rem' : '1rem',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Memproses...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: isMobile ? '0.25rem 1rem' : '1rem'
      }}>
        <p style={{
          fontSize: isMobile ? '0.7rem' : '0.75rem',
          color: 'var(--secondary-color)',
          margin: 0
        }}>
          © 2025 IQOS Inventory by AGU
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Login;