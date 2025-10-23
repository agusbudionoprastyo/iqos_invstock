import React, { useState, useEffect } from 'react';
import { Download, FileText, BarChart3, Calendar, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { productService, salesService, stockMovementService, stockAuditService } from '../services/database';
import { useResponsive } from '../hooks/useResponsive';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const ExportReport = () => {
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [reportType, setReportType] = useState('sales'); // 'sales' | 'stock'
  const [salesData, setSalesData] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [stockAudits, setStockAudits] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    averageTransactionValue: 0
  });

  useEffect(() => {
    loadReportData();
  }, [selectedMonth, reportType]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      if (reportType === 'sales') {
        await loadSalesReport();
      } else {
        await loadStockAuditReport();
      }
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesReport = async () => {
    const [sales, productsWithStockData] = await Promise.all([
      salesService.getAllSales(),
      productService.getAllProductsWithStockData()
    ]);
    
    // Create a map of productId to category for quick lookup
    const productCategoryMap = {};
    productsWithStockData.forEach(product => {
      productCategoryMap[product.id] = product.category;
    });
    
    const [year, month] = selectedMonth.split('-');
    
    // Filter sales for selected month and add category to each item
    const monthlySales = sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return saleDate.getFullYear() == year && saleDate.getMonth() == month - 1;
    }).map(sale => ({
      ...sale,
      items: sale.items.map(item => ({
        ...item,
        category: productCategoryMap[item.productId] || 'Unknown'
      }))
    }));

    setSalesData(monthlySales);

    // Calculate monthly stats
    const totalRevenue = monthlySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = monthlySales.length;
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    setMonthlyStats({
      totalSales: monthlySales.reduce((sum, sale) => sum + sale.items.length, 0),
      totalRevenue,
      totalTransactions,
      averageTransactionValue
    });
  };

  const loadStockAuditReport = async () => {
    const [year, month] = selectedMonth.split('-');
    
    // Get stock audits for the selected month (from both sources)
    const audits = await stockAuditService.getStockAuditsByMonth(parseInt(year), parseInt(month));

    // Group audits by calendar date (YYYY-MM-DD) so same date => single page
    const byDate = {};
    for (const a of audits) {
      const dateObj = a.date ? new Date(a.date) : (a.createdAt ? new Date(a.createdAt) : null);
      const yyyy = dateObj ? dateObj.getFullYear() : year;
      const mm = dateObj ? String(dateObj.getMonth() + 1).padStart(2, '0') : String(month).padStart(2, '0');
      const dd = dateObj ? String(dateObj.getDate()).padStart(2, '0') : '01';
      const dateKey = `${yyyy}-${mm}-${dd}`;

      if (!byDate[dateKey]) {
        byDate[dateKey] = { date: dateKey, createdAt: a.createdAt || 0, results: {} };
      } else {
        // Keep the max createdAt as session timestamp
        byDate[dateKey].createdAt = Math.max(byDate[dateKey].createdAt, a.createdAt || 0);
      }

      // Merge results per product for this date, prefer latest by createdAt
      const ts = a.createdAt || 0;
      (a.results || []).forEach((r) => {
        if (!r || !r.productId) return;
        const existing = byDate[dateKey].results[r.productId];
        if (!existing || ts > (existing.__ts || 0)) {
          byDate[dateKey].results[r.productId] = { ...r, __ts: ts };
        }
      });
    }

    // Convert map to array sorted by date ascending
    const sessions = Object.values(byDate)
      .map((s) => ({
        date: s.date,
        createdAt: s.createdAt,
        results: Object.values(s.results)
      }))
      .sort((a, b) => (new Date(a.date)) - (new Date(b.date)));

    setStockAudits(sessions);

    // Get products and stock movements for additional context
    const [productsWithStockData, stockMovements] = await Promise.all([
      productService.getAllProductsWithStockData(),
      stockMovementService.getAllStockMovements()
    ]);
    
    // Extract just the products from the stock data
    const products = productsWithStockData;

    // Get current month's stock movements
    const monthlyMovements = stockMovements.filter(movement => {
      const movementDate = new Date(movement.createdAt);
      return movementDate.getFullYear() == year && movementDate.getMonth() == month - 1;
    });

    // Build dataset for ALL products (even without movements)
    const productMovements = {};

    // Initialize every product with empty movements
    products.forEach((p) => {
      productMovements[p.id] = { product: p, movements: [] };
    });

    // Attach movements where available
    monthlyMovements.forEach((movement) => {
      if (!productMovements[movement.productId]) {
        const product = products.find((p) => p.id === movement.productId) || null;
        productMovements[movement.productId] = { product, movements: [] };
      }
      productMovements[movement.productId].movements.push(movement);
    });

    setStockData(Object.values(productMovements));
  };

  // Get audit result for a specific product
  const getAuditResult = (productId) => {
    return stockAudits.find(audit => 
      audit.results && audit.results.some(result => result.productId === productId)
    )?.results?.find(result => result.productId === productId);
  };

  const getAuditDateString = (productId) => {
    const res = getAuditResult(productId);
    if (res && typeof res.__ts === 'number') {
      try {
        return new Date(res.__ts).toLocaleDateString('id-ID');
      } catch (_) {
        return '-';
      }
    }
    return '-';
  };

  const exportToCSV = async (data, filename) => {
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    // Ensure latest data just before export (handles recent audits)
    if (reportType === 'stock') {
      await loadStockAuditReport();
      // Use freshly computed data
      data = stockData;
    } else if (reportType === 'sales') {
      await loadSalesReport();
      data = salesData;
    }

    let csvContent = '';
    
    if (reportType === 'sales') {
      // Sales report CSV
      csvContent = 'Tanggal,ID Transaksi,Pelanggan,Total Item,Total Harga,Metode Pembayaran\n';
      data.forEach(sale => {
        const date = new Date(sale.createdAt).toLocaleDateString('id-ID');
        const customerName = sale.customerName || 'Pelanggan Umum';
        const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        csvContent += `${date},${sale.id},${customerName},${totalItems},${sale.totalAmount},${sale.paymentMethod}\n`;
      });
    } else {
      // Stock audit CSV
      csvContent = 'Produk,Kategori,Stok Sistem,Stok Fisik,Selisih,Stok Masuk,Stok Keluar,Tanggal Audit,Status Audit,Status Stok\n';
      data.forEach(item => {
        if (item.product) {
          const inMovements = item.movements.filter(m => m.type === 'in');
          const outMovements = item.movements.filter(m => m.type === 'out');
          const totalIn = inMovements.reduce((sum, m) => sum + m.quantity, 0);
          const totalOut = outMovements.reduce((sum, m) => sum + m.quantity, 0);
          const systemStock = item.product.stock;
          const auditResult = getAuditResult(item.product.id);
          const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
          const physicalStockValue = hasPhysical ? auditResult.physicalStock : '-';
          const variance = hasPhysical ? (auditResult.physicalStock - systemStock) : '-';
          const auditStatus = auditResult ? auditResult.status : 'Belum Diaudit';
          const auditDateStr = getAuditDateString(item.product.id);
          const isLowStock = systemStock <= item.product.minStock;
          
          // Determine stock status for CSV
          let stockStatus;
          if (!auditResult || !hasPhysical) {
            stockStatus = isLowStock ? 'Stok Rendah' : 'Normal';
          } else {
            if (variance > 0) {
              stockStatus = 'Lebih (+' + variance + ')';
            } else if (variance < 0) {
              stockStatus = 'Kurang (' + variance + ')';
            } else {
              stockStatus = isLowStock ? 'Stok Rendah' : 'Sesuai';
            }
          }
          
          csvContent += `${item.product.name},${item.product.category},${systemStock},${physicalStockValue},${variance},${totalIn},${totalOut},${auditDateStr},${auditStatus},${stockStatus}\n`;
        }
      });
    }

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const exportToPDF = async () => {
    try {
      setLoading(true);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('LAPORAN IQOS', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${reportType === 'sales' ? 'Laporan Penjualan' : 'Audit Stok'} - ${getMonthName(selectedMonth)}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Report type specific content
      if (reportType === 'sales') {
        await generateSalesPDF(pdf, pageWidth, pageHeight, yPosition);
      } else {
        await generateStockAuditPDF(pdf, pageWidth, pageHeight, yPosition);
      }

      // Save PDF
      const filename = `${reportType === 'sales' ? 'laporan_penjualan' : 'audit_stok'}_${selectedMonth}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Gagal membuat PDF');
    } finally {
      setLoading(false);
    }
  };

  const generateSalesPDF = async (pdf, pageWidth, pageHeight, startY) => {
    let yPosition = startY;
    
    // Stats section
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RINGKASAN BULANAN', 20, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Transaksi: ${monthlyStats.totalTransactions}`, 20, yPosition);
    yPosition += 6;
    pdf.text(`Total Item Terjual: ${monthlyStats.totalSales}`, 20, yPosition);
    yPosition += 6;
    pdf.text(`Total Revenue: ${formatCurrency(monthlyStats.totalRevenue)}`, 20, yPosition);
    yPosition += 6;
    pdf.text(`Rata-rata Transaksi: ${formatCurrency(monthlyStats.averageTransactionValue)}`, 20, yPosition);
    yPosition += 15;

    // Sales data table
    if (salesData.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETAIL TRANSAKSI', 20, yPosition);
      yPosition += 10;

      // Table headers
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const headers = ['Tanggal', 'ID', 'Pelanggan', 'Item', 'Total'];
      const colWidths = [30, 25, 50, 20, 30];
      let xPosition = 20;

      headers.forEach((header, index) => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += 5;

      // Draw line
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 3;

      // Table data
      pdf.setFont('helvetica', 'normal');
      salesData.slice(0, 20).forEach((sale) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }

        xPosition = 20;
        const date = new Date(sale.createdAt).toLocaleDateString('id-ID');
        const customerName = sale.customerName || 'Pelanggan Umum';
        const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        
        const rowData = [
          date,
          sale.id.slice(0, 8) + '...',
          customerName.length > 20 ? customerName.substring(0, 20) + '...' : customerName,
          totalItems.toString(),
          formatCurrency(sale.totalAmount)
        ];

        rowData.forEach((data, index) => {
          pdf.text(data, xPosition, yPosition);
          xPosition += colWidths[index];
        });
        yPosition += 5;
      });
    } else {
      pdf.setFontSize(10);
      pdf.text('Tidak ada data penjualan untuk bulan ini', 20, yPosition);
    }
  };

  const generateStockAuditPDF = async (pdf, pageWidth, pageHeight, startY) => {
    let yPosition = startY;
    
    // Iterate audit sessions by date; one session per page
    const sessions = stockAudits || [];
    if (!sessions.length) {
      pdf.setFontSize(10);
      pdf.text('Tidak ada data stok untuk bulan ini', 20, yPosition);
      return;
    }

    for (let idx = 0; idx < sessions.length; idx++) {
      const session = sessions[idx];
      const sessionDate = session.date
        ? new Date(session.date).toLocaleDateString('id-ID')
        : (session.createdAt ? new Date(session.createdAt).toLocaleDateString('id-ID') : '-');
      if (idx > 0) {
        pdf.addPage();
        yPosition = 20;
      }

      // Header for session page
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`AUDIT STOK - ${sessionDate}`, 20, yPosition);
      yPosition += 10;

      // Build a map for quick lookup of audit results in this session
      const resultByProduct = {};
      (session.results || []).forEach((r) => { if (r && r.productId) resultByProduct[r.productId] = r; });

      // Table
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const headers = ['Produk', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Status'];
      const colWidths = [60, 25, 25, 20, 30];
      let xPosition = 20;
      headers.forEach((h, i) => { pdf.text(h, xPosition, yPosition); xPosition += colWidths[i]; });
      yPosition += 5;
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 3;

      pdf.setFont('helvetica', 'normal');
      for (const item of stockData) {
        if (yPosition > pageHeight - 30) { pdf.addPage(); yPosition = 20; }
        if (!item.product) continue;
        const res = resultByProduct[item.product.id];
        const hasPhysical = res && typeof res.physicalStock === 'number';
        const physical = hasPhysical ? res.physicalStock : '-';
        const variance = hasPhysical ? (res.physicalStock - item.product.stock) : '-';
        let status;
        if (!hasPhysical) status = item.product.stock <= item.product.minStock ? 'Stok Rendah' : 'Normal';
        else if (variance > 0) status = `Lebih (+${variance})`;
        else if (variance < 0) status = `Kurang (${variance})`;
        else status = item.product.stock <= item.product.minStock ? 'Stok Rendah' : 'Sesuai';

        xPosition = 20;
        const row = [
          (item.product.name.length > 28 ? item.product.name.slice(0, 28) + '...' : item.product.name),
          String(item.product.stock),
          (physical === '-' ? '-' : String(physical)),
          (variance === '-' ? '-' : (variance > 0 ? '+' + variance : String(variance))),
          status
        ];
        row.forEach((d, i) => { pdf.text(d, xPosition, yPosition); xPosition += colWidths[i]; });
        yPosition += 5;
      }
    }
  };

  const getMonthName = (monthString) => {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
  };

  return (
    <div style={{ 
      padding: isMobile ? '0.5rem' : '1.5rem',
      marginTop: '1rem'
    }}>

      {/* Report Type Selection */}
      <div style={{
        background: 'white',
        borderRadius: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0, marginBottom: '1rem' }}>
          Pilih Jenis Laporan
        </h3>
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? '1rem' : '1rem', 
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap' 
        }}>
          {/* Month Input */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? '0' : '1rem', 
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto'
          }}>
            {!isMobile && <span>Month</span>}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '1rem',
                width: isMobile ? '100%' : 'auto'
              }}
            />
          </div>
          
          {/* Report Type Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto'
          }}>
            <button
              onClick={() => setReportType('sales')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: reportType === 'sales' ? '#3b82f6' : 'white',
                color: reportType === 'sales' ? 'white' : '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: '500',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              <BarChart3 size={18} />
              Laporan Penjualan
            </button>
            <button
              onClick={() => setReportType('stock')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: reportType === 'stock' ? '#3b82f6' : 'white',
                color: reportType === 'stock' ? 'white' : '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: '500',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              <Package size={18} />
              Audit Stok
            </button>
          </div>
        </div>
      </div>

      {/* Report Stats */}
      {reportType === 'sales' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Total Transaksi
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {monthlyStats.totalTransactions}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Total Item Terjual
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {monthlyStats.totalSales}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Total Revenue
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {formatCurrency(monthlyStats.totalRevenue)}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Rata-rata Transaksi
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {formatCurrency(monthlyStats.averageTransactionValue)}
            </p>
          </div>
        </div>
      )}

      {/* Stock Audit Summary */}
      {reportType === 'stock' && stockData.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Total Produk
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {stockData.length}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Sudah Diaudit
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#059669', margin: 0 }}>
              {stockData.filter(item => getAuditResult(item.product?.id)).length}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Ada Selisih
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f59e0b', margin: 0 }}>
              {stockData.filter(item => {
                const auditResult = getAuditResult(item.product?.id);
                return auditResult && (auditResult.physicalStock - item.product.stock !== 0);
              }).length}
            </p>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', margin: 0, marginBottom: '0.5rem' }}>
              Total Audit
            </h4>
            <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>
              {stockAudits.length}
            </p>
          </div>
        </div>
      )}

      {/* Export Button */}
      <div style={{
        background: 'white',
          borderRadius: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0, marginBottom: '0.25rem' }}>
              Export Data
            </h3>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
              Download laporan dalam format CSV atau PDF
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => exportToCSV(
                reportType === 'sales' ? salesData : stockData,
                `${reportType === 'sales' ? 'laporan_penjualan' : 'audit_stok'}_${selectedMonth}.csv`
              )}
              disabled={loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0) ? '#9ca3af' : '#10b981',
                color: 'white',
                cursor: loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500',
                fontSize: '0.875rem'
              }}
            >
              <Download size={18} />
              {loading ? 'Loading...' : 'CSV'}
            </button>
            <button
              onClick={exportToPDF}
              disabled={loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0) ? '#9ca3af' : '#dc2626',
                color: 'white',
                cursor: loading || (reportType === 'sales' ? salesData.length === 0 : stockData.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '500',
                fontSize: '0.875rem'
              }}
            >
              <FileText size={18} />
              {loading ? 'Loading...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Preview */}
      <div style={{
        background: 'white',
        borderRadius: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 }}>
            Preview Data
          </h3>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
              <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading data...</p>
            </div>
          ) : reportType === 'sales' ? (
            salesData.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                {/* Desktop Table */}
                {!isMobile ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Tanggal
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Produk
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Kategori
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Qty
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Harga
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.slice(0, 10).map((sale) => 
                      sale.items.map((item, itemIndex) => (
                        <tr key={`${sale.id}-${itemIndex}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                            {new Date(sale.createdAt).toLocaleDateString('id-ID')}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                            {item.productName}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            {item.category}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'center' }}>
                            {item.quantity}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'right', fontWeight: '500' }}>
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                ) : (
                  /* Mobile Table - 2 columns only */
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          Item
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          Harga
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.slice(0, 10).map((sale) => 
                        sale.items.map((item, itemIndex) => (
                          <tr key={`${sale.id}-${itemIndex}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                            <div>
                              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                {item.productName}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                                {item.category}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Qty: {item.quantity}
                              </div>
                            </div>
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'right', fontWeight: '500' }}>
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
                {salesData.reduce((total, sale) => total + sale.items.length, 0) > 10 && (
                  <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '1rem', fontSize: '0.875rem' }}>
                    Menampilkan 10 dari {salesData.reduce((total, sale) => total + sale.items.length, 0)} item
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <FileText size={48} color="#9ca3af" />
                <p style={{ color: '#6b7280', marginTop: '1rem' }}>Tidak ada data penjualan untuk bulan ini</p>
              </div>
            )
          ) : (
            stockData.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                {/* Desktop Table */}
                {!isMobile ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Produk
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Kategori
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Stok Sistem
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Stok Fisik
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Selisih
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Stok Masuk
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Stok Keluar
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Tgl Audit
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Status Audit
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                        Status Stok
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData
                      .filter(item => {
                        if (!item.product) return false;
                        const auditResult = getAuditResult(item.product.id);
                        const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                        if (!hasPhysical) return false;
                        const systemStock = item.product.stock;
                        const variance = auditResult.physicalStock - systemStock;
                        return variance !== 0; // Only show products with variance
                      })
                      .slice(0, 10)
                      .map((item, index) => {
                      if (!item.product) return null;
                      
                      const inMovements = item.movements.filter(m => m.type === 'in');
                      const outMovements = item.movements.filter(m => m.type === 'out');
                      const totalIn = inMovements.reduce((sum, m) => sum + m.quantity, 0);
                      const totalOut = outMovements.reduce((sum, m) => sum + m.quantity, 0);
                      const systemStock = item.product.stock;
                      const auditResult = getAuditResult(item.product.id);
                      const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                      const physicalStockValue = hasPhysical ? auditResult.physicalStock : '-';
                      const variance = hasPhysical ? (auditResult.physicalStock - systemStock) : '-';
                      const auditDateStr = getAuditDateString(item.product.id);
                      const auditStatus = auditResult ? auditResult.status : 'Belum Diaudit';
                      const isLowStock = systemStock <= item.product.minStock;
                      
                      // Determine stock status based on audit variance and low stock
                      let stockStatus, stockStatusColor, stockStatusBg;
                      if (!auditResult) {
                        stockStatus = isLowStock ? 'Stok Rendah' : 'Normal';
                        stockStatusColor = isLowStock ? '#dc2626' : '#059669';
                        stockStatusBg = isLowStock ? '#fef2f2' : '#f0fdf4';
                      } else {
                        if (variance > 0) {
                          stockStatus = 'Lebih (+' + variance + ')';
                          stockStatusColor = '#f59e0b';
                          stockStatusBg = '#fffbeb';
                        } else if (variance < 0) {
                          stockStatus = 'Kurang (' + variance + ')';
                          stockStatusColor = '#dc2626';
                          stockStatusBg = '#fef2f2';
                        } else {
                          stockStatus = isLowStock ? 'Stok Rendah' : 'Sesuai';
                          stockStatusColor = isLowStock ? '#dc2626' : '#059669';
                          stockStatusBg = isLowStock ? '#fef2f2' : '#f0fdf4';
                        }
                      }
                      
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                            {item.product.name}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                            {item.product.category}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'center', fontWeight: '500' }}>
                            {systemStock}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'center', fontWeight: '500' }}>
                            {physicalStockValue}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {auditResult ? (
                              <span style={{
                                color: variance > 0 ? '#059669' : variance < 0 ? '#dc2626' : '#6b7280',
                                fontWeight: '500',
                                fontSize: '0.875rem'
                              }}>
                                {variance > 0 ? '+' : ''}{variance}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#059669', textAlign: 'center' }}>
                            {totalIn}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#dc2626', textAlign: 'center' }}>
                            {totalOut}
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151', textAlign: 'center' }}>
                            {auditDateStr}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              background: auditStatus === 'completed' ? '#f0fdf4' : '#fef2f2',
                              color: auditStatus === 'completed' ? '#059669' : '#dc2626'
                            }}>
                              {auditStatus === 'completed' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                              {auditStatus === 'completed' ? 'Selesai' : 'Belum Diaudit'}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              background: stockStatusBg,
                              color: stockStatusColor
                            }}>
                              {variance > 0 ? <AlertTriangle size={12} /> : variance < 0 ? <AlertTriangle size={12} /> : isLowStock ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                              {stockStatus}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                ) : (
                  /* Mobile Table - 2 columns only */
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          Produk
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                          Selisih
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockData
                        .filter(item => {
                          if (!item.product) return false;
                          const auditResult = getAuditResult(item.product.id);
                          const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                          if (!hasPhysical) return false;
                          const systemStock = item.product.stock;
                          const variance = auditResult.physicalStock - systemStock;
                          return variance !== 0; // Only show products with variance
                        })
                        .slice(0, 10)
                        .map((item, index) => {
                        if (!item.product) return null;
                        
                        const systemStock = item.product.stock;
                        const auditResult = getAuditResult(item.product.id);
                        const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                        const variance = hasPhysical ? (auditResult.physicalStock - systemStock) : '-';
                        
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                              <div>
                                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                  {item.product.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  {item.product.category}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                  Sistem: {systemStock} | Fisik: {hasPhysical ? auditResult.physicalStock : '-'}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {auditResult ? (
                                <span style={{
                                  color: variance > 0 ? '#059669' : variance < 0 ? '#dc2626' : '#6b7280',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.375rem',
                                  background: variance > 0 ? '#f0fdf4' : variance < 0 ? '#fef2f2' : '#f9fafb'
                                }}>
                                  {variance > 0 ? '+' : ''}{variance}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {stockData.filter(item => {
                  if (!item.product) return false;
                  const auditResult = getAuditResult(item.product.id);
                  const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                  if (!hasPhysical) return false;
                  const systemStock = item.product.stock;
                  const variance = auditResult.physicalStock - systemStock;
                  return variance !== 0;
                }).length > 10 && (
                  <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '1rem', fontSize: '0.875rem' }}>
                    Menampilkan 10 dari {stockData.filter(item => {
                      if (!item.product) return false;
                      const auditResult = getAuditResult(item.product.id);
                      const hasPhysical = auditResult && typeof auditResult.physicalStock === 'number';
                      if (!hasPhysical) return false;
                      const systemStock = item.product.stock;
                      const variance = auditResult.physicalStock - systemStock;
                      return variance !== 0;
                    }).length} produk dengan selisih
                  </p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Package size={48} color="#9ca3af" />
                <p style={{ color: '#6b7280', marginTop: '1rem' }}>Tidak ada data stok untuk bulan ini</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportReport;
