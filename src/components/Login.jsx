import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { showToast } from '../utils/toast.jsx';
import { userService } from '../services/database';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
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
        showToast.error('Username atau password salah.', 'Login Gagal!');
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast.error('Terjadi kesalahan saat login.', 'Error!');
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
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background-color)',
      padding: isMobile ? '0.5rem' : '1rem',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        paddingTop: isMobile ? '1rem' : '0',
        maxHeight: isMobile ? 'calc(100vh - 3rem)' : '100%',
        overflow: isMobile ? 'hidden' : 'visible'
      }}>
        <div style={{
          background: isMobile ? 'transparent' : 'var(--card-background)',
          borderRadius: isMobile ? '0' : '1rem',
          boxShadow: isMobile ? 'none' : '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: isMobile ? '0.5rem' : '2rem',
          width: '100%',
          maxWidth: '400px',
          border: isMobile ? 'none' : '1px solid var(--border-color)',
          maxHeight: isMobile ? 'calc(100vh - 5rem)' : 'none',
          overflowY: isMobile ? 'auto' : 'visible',
          overflowX: 'hidden'
        }}>
        {/* Logo/Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? '1rem' : '2rem'
        }}>
          <h1 style={{
            fontSize: isMobile ? '1.25rem' : '1.5rem',
            fontWeight: '600',
            color: 'var(--text-color)',
            margin: 0
          }}>
            IQOS
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: isMobile ? '1rem' : '1.5rem' }}>
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
              <User style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: isMobile ? '1.1rem' : '1.25rem',
                height: isMobile ? '1.1rem' : '1.25rem',
                color: 'var(--secondary-color)'
              }} />
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
                  border: '1px solid var(--border-color)',
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
              <Lock style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: isMobile ? '1.1rem' : '1.25rem',
                height: isMobile ? '1.1rem' : '1.25rem',
                color: 'var(--secondary-color)'
              }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Masukkan password"
                required
                style={{
                  width: '100%',
                  padding: isMobile ? '0.6rem 3rem 0.6rem 3rem' : '0.75rem 3rem 0.75rem 3rem',
                  border: '1px solid var(--border-color)',
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
            className="liquid-glass-btn"
            style={{
              width: '100%',
              padding: isMobile ? '0.65rem' : '0.75rem',
              background: loading 
                ? 'rgba(108, 117, 125, 0.3)' 
                : 'linear-gradient(135deg, rgba(243, 6, 125, 0.25) 0%, rgba(244, 139, 185, 0.25) 100%)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: 'white',
              border: loading ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(243, 6, 125, 0.4)',
              borderRadius: '0.5rem',
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: loading 
                ? 'none' 
                : '0 4px 15px rgba(243, 6, 125, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(243, 6, 125, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(243, 6, 125, 0.6)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(243, 6, 125, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(243, 6, 125, 0.4)';
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
        padding: isMobile ? '0.5rem 1rem' : '1rem'
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
        
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        .liquid-glass-btn {
          position: relative;
        }
        
        .liquid-glass-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          transition: left 0.5s ease;
        }
        
        .liquid-glass-btn:not(:disabled):hover::before {
          left: 100%;
        }
        
        .liquid-glass-btn:not(:disabled):hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(243, 6, 125, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          border-color: rgba(243, 6, 125, 0.6) !important;
        }
        
        .liquid-glass-btn:not(:disabled):active {
          transform: translateY(0px) !important;
        }
      `}</style>
    </div>
  );
};

export default Login;