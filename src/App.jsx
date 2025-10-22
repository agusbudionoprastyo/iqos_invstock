import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  BarChart3, 
  Settings,
  Home,
  FileText
} from 'lucide-react';
import InventoryManagement from './components/InventoryManagement';
import SalesModule from './components/SalesModule';
import Dashboard from './components/Dashboard';
import ExportReport from './components/ExportReport';

const Navigation = () => {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/sales', icon: ShoppingCart, label: 'Penjualan' },
    { path: '/export', icon: FileText, label: 'Report' }
  ];

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          {/* <Package size={24} /> */}
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
        </ul>
      </div>
    </nav>
  );
};

const App = () => {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <Navigation />
        
        <main className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<InventoryManagement />} />
            <Route path="/sales" element={<SalesModule />} />
            <Route path="/export" element={<ExportReport />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
