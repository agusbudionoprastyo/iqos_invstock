import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { productService, salesService } from '../services/database';
import { useResponsive } from '../hooks/useResponsive';

const Dashboard = () => {
  const { isMobile } = useResponsive();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalSales: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [productsWithStockData, sales] = await Promise.all([
        productService.getAllProductsWithStockData(),
        salesService.getAllSales()
      ]);
      
      // Extract just the products from the stock data
      const products = productsWithStockData;
      
      // Create a map of productId to category for quick lookup
      const productCategoryMap = {};
      products.forEach(product => {
        productCategoryMap[product.id] = product.category;
      });

      // Calculate stats
      const lowStockProducts = products.filter(product => product.stock <= product.minStock);
      const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

      setProducts(products);
      setStats({
        totalProducts: products.length,
        lowStockProducts: lowStockProducts.length,
        totalSales: sales.length,
        totalRevenue
      });

      // Get recent transactions and add category to each item
      const sortedSales = sales.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map(sale => ({
        ...sale,
        items: sale.items.map(item => ({
          ...item,
          category: productCategoryMap[item.productId] || 'Unknown'
        }))
      }));
      setRecentSales(sortedSales);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div style={{
      background: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
      display: 'flex',
      alignItems: 'center'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: color + '20', // Adding transparency (20 = ~12% opacity)
        marginRight: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} style={{ color: color }} />
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0 }}>
          {title}
        </p>
        <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
          {value}
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '16rem'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: window.innerWidth <= 768 ? '0.2rem' : '1.5rem',
      marginTop: '1rem'
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: '#6b7280', marginTop: '0.5rem', margin: 0 }}>
          Ringkasan sistem inventory IQOS
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: isMobile ? '1rem' : '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <StatCard
          title="Total Produk"
          value={stats.totalProducts}
          icon={Package}
          color="#3b82f6"
        />
        <StatCard
          title="Stok Rendah"
          value={stats.lowStockProducts}
          icon={AlertTriangle}
          color="#ef4444"
        />
        <StatCard
          title="Total Penjualan"
          value={stats.totalSales}
          icon={ShoppingCart}
          color="#10b981"
        />
        <StatCard
          title="Total Revenue"
          value={`Rp ${stats.totalRevenue.toLocaleString('id-ID')}`}
          icon={TrendingUp}
          color="#8b5cf6"
        />
      </div>

      {/* Recent Sales */}
        <div style={{
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              Penjualan Terbaru
            </h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {recentSales.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentSales.map((sale) => (
                  <div key={sale.id} style={{
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    
                    {/* Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sale.items.map((item, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.375rem'
                        }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#111827', margin: 0, textAlign: 'left' }}>
                              {item.productName}
                          </p>
                          <p style={{ fontSize: '0.625rem', color: '#6b7280', margin: 0, textAlign: 'left' }}>
                            {item.category} • Qty {item.quantity}
                          </p>
                          <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#059669', margin: 0, textAlign: 'left' }}>
                            Rp {item.total.toLocaleString('id-ID')}
                          </p>
                        </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'end', fontSize: '0.875rem' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0 }}>
                              {sale.customerName || 'Pelanggan Umum'}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                              {new Date(sale.createdAt).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem', margin: 0 }}>
                Belum ada penjualan
              </p>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;