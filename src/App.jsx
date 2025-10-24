import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  BarChart3, 
  Settings,
  Home,
  FileText,
  LogOut
} from 'lucide-react';
import InventoryManagement from './components/InventoryManagement';
import SalesModule from './components/SalesModule';
import Dashboard from './components/Dashboard';
import ExportReport from './components/ExportReport';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import { DarkModeProvider, useDarkMode } from './contexts/DarkModeContext';

// Component to update PWA theme color based on dark mode
const PWAThemeUpdater = () => {
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    const updateThemeColor = () => {
      const themeColor = isDarkMode ? '#2d2e34' : '#ffffff';
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      const metaMsTileColor = document.querySelector('meta[name="msapplication-TileColor"]');
      const manifestLink = document.querySelector('link[rel="manifest"]');
      
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeColor);
      }
      if (metaMsTileColor) {
        metaMsTileColor.setAttribute('content', themeColor);
      }
      if (manifestLink) {
        manifestLink.setAttribute('href', isDarkMode ? '/manifest.json' : '/manifest-light.json');
      }
    };

    updateThemeColor();
  }, [isDarkMode]);

  return null;
};

const Navigation = ({ onLogout }) => {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/export', icon: FileText, label: 'Report' },
    { path: '/sales', icon: ShoppingCart, label: 'Penjualan' }
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    onLogout();
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <span className="mobile-hidden">IQOS</span>
          </Link>
          <ul className="nav-menu">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {/* Desktop logout button */}
            {/* <li className="desktop-only">
              <button
                onClick={handleLogout}
                className="nav-link"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.color = '#ef4444';
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.target.style.color = '#6b7280';
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut size={18} />
                Logout
              </button>
            </li> */}
          </ul>
        </div>
      </nav>
    </>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(authStatus);
    setLoading(false);
  }, []);

  const handleLogin = (success) => {
    setIsAuthenticated(success);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--background-color)',
        color: 'var(--text-color)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <DarkModeProvider>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--background-color)' }}>
          <PWAThemeUpdater />
          <Navigation onLogout={handleLogout} />
          
          <main className="container">
            <Header onLogout={handleLogout} />
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute>
                  <InventoryManagement />
                </ProtectedRoute>
              } />
              <Route path="/sales" element={
                <ProtectedRoute>
                  <SalesModule />
                </ProtectedRoute>
              } />
              <Route path="/export" element={
                <ProtectedRoute>
                  <ExportReport />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
          
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            style={{
              fontSize: '14px',
            }}
          />
        </div>
      </Router>
    </DarkModeProvider>
  );
};

export default App;
