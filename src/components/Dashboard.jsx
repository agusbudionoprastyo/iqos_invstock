import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, Truck, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { productService, salesService, procurementService } from '../services/database';
import { useResponsive } from '../hooks/useResponsive';

const Dashboard = () => {
  const { isMobile } = useResponsive();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    totalSales: 0,
    totalProcurements: 0,
    totalRevenue: 0,
    totalCost: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState([]);
  const [recentProcurements, setRecentProcurements] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [products, sales, procurements] = await Promise.all([
        productService.getAllProducts(),
        salesService.getAllSales(),
        procurementService.getAllProcurements()
      ]);

      // Calculate stats
      const lowStockProducts = products.filter(product => product.stock <= product.minStock);
      const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      const totalCost = procurements.reduce((sum, procurement) => sum + procurement.totalAmount, 0);

      setStats({
        totalProducts: products.length,
        lowStockProducts: lowStockProducts.length,
        totalSales: sales.length,
        totalProcurements: procurements.length,
        totalRevenue,
        totalCost
      });

      // Get recent transactions
      const sortedSales = sales.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
      const sortedProcurements = procurements.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

      setRecentSales(sortedSales);
      setRecentProcurements(sortedProcurements);

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
        padding: '0.75rem',
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: '1rem'
      }}>
        <Icon size={24} style={{ color: 'white' }} />
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
    <div style={{ padding: '1.5rem' }}>
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
          title="Total Pengadaan"
          value={stats.totalProcurements}
          icon={Truck}
          color="#8b5cf6"
        />
      </div>

      {/* Financial Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1rem', margin: 0 }}>
            Ringkasan Keuangan
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6b7280' }}>Total Pendapatan</span>
              <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#059669' }}>
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6b7280' }}>Total Biaya</span>
              <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#dc2626' }}>
                Rp {stats.totalCost.toLocaleString('id-ID')}
              </span>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#111827', fontWeight: '500' }}>Laba Bersih</span>
                <span style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: stats.totalRevenue - stats.totalCost >= 0 ? '#059669' : '#dc2626'
                }}>
                  Rp {(stats.totalRevenue - stats.totalCost).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1rem', margin: 0 }}>
            Status Stok
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.lowStockProducts > 0 ? (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                <AlertTriangle size={20} style={{ color: '#dc2626', marginRight: '0.5rem' }} />
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#991b1b', margin: 0 }}>
                    {stats.lowStockProducts} produk memiliki stok rendah
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', margin: 0 }}>
                    Segera lakukan pengadaan untuk produk-produk tersebut
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Package size={20} style={{ color: '#059669', marginRight: '0.5rem' }} />
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#065f46', margin: 0 }}>
                    Semua produk memiliki stok yang cukup
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem', margin: 0 }}>
                    Tidak ada produk dengan stok rendah
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem'
      }}>
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', margin: 0 }}>
                        {sale.customerName || 'Pelanggan Umum'}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                        {new Date(sale.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669', margin: 0 }}>
                        Rp {sale.totalAmount.toLocaleString('id-ID')}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                        {sale.items.length} item
                      </p>
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

        {/* Recent Procurements */}
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
              Pengadaan Terbaru
            </h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {recentProcurements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentProcurements.map((procurement) => (
                  <div key={procurement.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', margin: 0 }}>
                        {procurement.supplierName}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                        {new Date(procurement.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2563eb', margin: 0 }}>
                        Rp {procurement.totalAmount.toLocaleString('id-ID')}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                        {procurement.status === 'pending' ? 'Menunggu' : 'Diterima'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem', margin: 0 }}>
                Belum ada pengadaan
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;