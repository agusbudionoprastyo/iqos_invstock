import React from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../contexts/DarkModeContext';

const Header = ({ onLogout }) => {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/inventory':
        return 'Inventory Management';
      case '/sales':
        return 'Sales Module';
      case '/export':
        return 'Export Report';
      default:
        return 'IQOS Inventory';
    }
  };

  const getPageDescription = () => {
    switch (location.pathname) {
      case '/':
        return 'Overview dan statistik sistem inventory';
      case '/inventory':
        return 'Kelola produk, stok, dan audit inventory';
      case '/sales':
        return 'Proses penjualan dan transaksi';
      case '/export':
        return 'Generate laporan dan export data';
      default:
        return 'Sistem manajemen inventory IQOS';
    }
  };

  return (
    <header style={{
      background: 'var(--header-background)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
      padding: '1rem 0',
      marginBottom: '1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      boxShadow: window.innerWidth <= 768 ? '0 8px 32px rgba(0, 0, 0, 0.15)' : 'none'
    }}
    className="header-responsive"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0 1rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-color)',
            margin: 0,
            marginBottom: '0.25rem'
          }}>
            {getPageTitle()}
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--secondary-color)',
            margin: 0
          }}>
            {getPageDescription()}
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}>
                <div className="desktop-only" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--secondary-color)'
                }}>
                  <span>Welcome,</span>
                  <span style={{
                    fontWeight: '600',
                    color: 'var(--text-color)'
                  }}>
                    {localStorage.getItem('userName') || 'User'}
                  </span>
                </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <button
              onClick={toggleDarkMode}
              style={{
                background: 'var(--card-background)',
                border: 'none',
                borderRadius: '1rem',
                padding: '0.5rem',
                color: isDarkMode ? '#f59e0b' : 'var(--secondary-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                fontSize: '0.875rem',
                alignSelf: 'flex-start',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
              onMouseOver={(e) => {
                e.target.style.background = 'var(--background-color)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = 'var(--card-background)';
                e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            
            <button
              onClick={onLogout}
              style={{
                background: 'var(--card-background)',
                border: 'none',
                borderRadius: '1rem',
                padding: '0.5rem',
                color: '#dc2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                fontSize: '0.875rem',
                alignSelf: 'flex-start',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            onMouseOver={(e) => {
              e.target.style.background = 'var(--background-color)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'var(--card-background)';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              e.target.style.transform = 'translateY(0)';
            }}
            title="Logout"
          >
            <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
