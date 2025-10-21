import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, Camera, CheckCircle } from 'lucide-react';
import { productService } from '../services/database';
import BarcodeScanner from './BarcodeScanner';
import Swal from 'sweetalert2';
import { ref, get, push, set } from 'firebase/database';
import { database } from '../firebase/config';

const InventoryManagement = () => {
  const [products, setProducts] = useState([]);
  const [productsWithBarcodeCount, setProductsWithBarcodeCount] = useState({});
  const [readyStockCount, setReadyStockCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [showAssignBarcodeModal, setShowAssignBarcodeModal] = useState(false);
  const [scanningMode, setScanningMode] = useState(null); // 'check' | 'assign' | null
  const [assigningProductId, setAssigningProductId] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [checkedProduct, setCheckedProduct] = useState(null);
  
  // Stock Audit states
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditTime, setAuditTime] = useState(new Date().toTimeString().slice(0, 5));
  const [auditResults, setAuditResults] = useState([]);
  const [currentAuditProduct, setCurrentAuditProduct] = useState(null);
  const [auditMode, setAuditMode] = useState(null); // 'manual' | 'barcode' | null

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    minStock: '',
    useBarcode: true
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await productService.getAllProducts();
      setProducts(productsData);
      
      // Load barcode count and ready stock for each product
      const barcodeCounts = {};
      const readyStocks = {};
      for (const product of productsData) {
        barcodeCounts[product.id] = await productService.getUnitsWithBarcodeCount(product.id);
        readyStocks[product.id] = await productService.getReadyStock(product.id);
      }
      setProductsWithBarcodeCount(barcodeCounts);
      setReadyStockCount(readyStocks);
      
      // Check for low stock products
      const lowStock = productsData.filter(product => product.stock <= product.minStock);
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: formData.useBarcode ? 0 : parseInt(formData.stock), // Only use manual stock if barcode is disabled
        minStock: parseInt(formData.minStock)
      };

      if (showEditModal && selectedProduct) {
        await productService.updateProduct(selectedProduct.id, productData);
      } else {
        await productService.createProduct(productData);
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setFormData({
        name: '',
        category: '',
        price: '',
        stock: '',
        minStock: '',
        useBarcode: true
      });
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      useBarcode: product.useBarcode !== false
    });
    setShowEditModal(true);
  };

  const handleDelete = async (productId) => {
    const result = await Swal.fire({
      title: 'Hapus Produk?',
      text: 'Apakah Anda yakin ingin menghapus produk ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await productService.deleteProduct(productId);
        await Swal.fire({
          title: 'Berhasil!',
          text: 'Produk berhasil dihapus.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        await Swal.fire({
          title: 'Error!',
          text: 'Gagal menghapus produk.',
          icon: 'error'
        });
      }
    }
  };

  const handleBarcodeScan = (barcode) => {
    // No longer needed since barcode is not part of product form
    setShowScanner(false);
    setScanningMode(null);
  };

  const handleStockCheckScan = async (barcode) => {
    try {
      const product = await productService.getProductByBarcode(barcode);
      if (product) {
        setCheckedProduct(product);
        setShowStockCheckModal(true);
      } else {
        await Swal.fire({
          title: 'Produk Tidak Ditemukan',
          text: 'Barcode tidak terdaftar dalam sistem.',
          icon: 'warning'
        });
      }
    } catch (error) {
      console.error('Error checking stock:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Gagal memeriksa stok.',
        icon: 'error'
      });
    }
    setShowScanner(false);
    setScanningMode(null);
  };

  const handleAssignBarcode = (productId) => {
    setAssigningProductId(productId);
    setManualBarcode('');
    setShowAssignBarcodeModal(true);
  };

  const handleAssignScan = async (barcode) => {
    try {
      if (!assigningProductId) return;
      await productService.addBarcodeToProduct(assigningProductId, barcode);
      await Swal.fire({
        title: 'Berhasil!',
        text: 'Barcode berhasil di-assign.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      setAssigningProductId(null);
      setScanningMode(null);
      setShowScanner(false);
      loadProducts();
    } catch (e) {
      await Swal.fire({
        title: 'Error!',
        text: e.message || 'Gagal assign barcode',
        icon: 'error'
      });
      setAssigningProductId(null);
      setScanningMode(null);
      setShowScanner(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualBarcode.trim()) {
      await Swal.fire({
        title: 'Perhatian!',
        text: 'Masukkan barcode terlebih dahulu.',
        icon: 'warning'
      });
      return;
    }
    
    try {
      await productService.addBarcodeToProduct(assigningProductId, manualBarcode.trim());
      await Swal.fire({
        title: 'Berhasil!',
        text: 'Barcode berhasil di-assign.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      setShowAssignBarcodeModal(false);
      setAssigningProductId(null);
      setManualBarcode('');
      loadProducts();
    } catch (e) {
      await Swal.fire({
        title: 'Error!',
        text: e.message || 'Gagal assign barcode',
      });
    }
  };

  const startStockAudit = async () => {
    try {
      const sessionRef = ref(database, `stockAuditsByDate/${auditDate}`);
      const snap = await get(sessionRef);
      let initialResults = [];

      if (snap.exists()) {
        const data = snap.val() || {};
        const existingResults = data.results || {};
        initialResults = products.map((product) => {
          const existing = existingResults[product.id];
          const isCompleted = !!existing;
          return {
            ...product,
            physicalStock: existing?.physicalStock ?? null,
            databaseStock: product.stock,
            readyStock: readyStockCount[product.id] || 0,
            status: isCompleted ? 'completed' : 'pending'
          };
        });
      } else {
        // create meta for new session
        await set(ref(database, `stockAuditsByDate/${auditDate}/meta`), {
          date: auditDate,
          createdAt: Date.now()
        });
        initialResults = products.map((product) => ({
          ...product,
          physicalStock: null,
          databaseStock: product.stock,
          readyStock: readyStockCount[product.id] || 0,
          status: 'pending'
        }));
      }

      setAuditResults(initialResults);
      const next = initialResults.find((r) => r.status === 'pending') || null;
      setCurrentAuditProduct(next);
      setAuditMode(next ? (next.useBarcode !== false ? 'barcode' : 'manual') : null);
    } catch (e) {
      await Swal.fire({ title: 'Error!', text: e.message || 'Gagal memulai audit.', icon: 'error' });
    }
  };

  const handleAuditBarcodeScan = async (barcode) => {
    try {
      const product = await productService.getProductByBarcode(barcode);
      if (!(product && currentAuditProduct && product.id === currentAuditProduct.id)) {
        await Swal.fire({ title: 'Barcode Salah', text: 'Barcode tidak sesuai produk yang diaudit.', icon: 'warning' });
        setShowScanner(false);
        return;
      }

      // Fetch units for current product
      const unitsRef = ref(database, `productUnits/${product.id}`);
      const unitsSnap = await get(unitsRef);
      if (!unitsSnap.exists()) {
        await Swal.fire({ title: 'Tidak Ada Unit', text: 'Tidak ada unit untuk produk ini.', icon: 'warning' });
        setShowScanner(false);
        return;
      }

      const unitsObj = unitsSnap.val();
      const targetEntry = Object.entries(unitsObj).find(([unitId, unit]) => unit.barcode === barcode && unit.status === 'in_stock');
      if (!targetEntry) {
        await Swal.fire({ title: 'Unit Tidak Ditemukan', text: 'Unit barcode tidak tersedia/in-stock.', icon: 'warning' });
        setShowScanner(false);
        return;
      }

      const [unitId] = targetEntry;
      // Get existing scanned units from local state (persisted in result)
      const existing = auditResults.find((r) => r.id === currentAuditProduct.id);
      const scannedUnits = Array.isArray(existing?.scannedUnits) ? existing.scannedUnits.slice() : [];

      if (scannedUnits.includes(unitId)) {
        await Swal.fire({ title: 'Duplikat Scan', text: 'Unit ini sudah discan untuk produk ini.', icon: 'info' });
        setShowScanner(false);
        return;
      }

      scannedUnits.push(unitId);
      const physicalCount = scannedUnits.length;

      // Persist in-progress result (status pending until user finishes item)
      const resultPayload = {
        productId: product.id,
        name: product.name,
        useBarcode: product.useBarcode !== false,
        databaseStock: currentAuditProduct.databaseStock,
        readyStock: currentAuditProduct.readyStock,
        physicalStock: physicalCount,
        scannedUnits,
        status: 'pending',
        updatedAt: Date.now()
      };
      await set(ref(database, `stockAuditsByDate/${auditDate}/results/${product.id}`), resultPayload);

      // Update local state, keep item active for more scans
      const updatedResults = auditResults.map((r) =>
        r.id === currentAuditProduct.id ? { ...r, physicalStock: physicalCount, scannedUnits, status: 'pending' } : r
      );
      setAuditResults(updatedResults);

      // Keep currentAuditProduct in sync for UI counters
      setCurrentAuditProduct((prev) => prev && prev.id === product.id ? { ...prev, physicalStock: physicalCount, scannedUnits } : prev);

      await Swal.fire({
        title: 'Tersimpan',
        text: `Ter-scan: ${physicalCount} unit`,
        icon: 'success',
        timer: 1200,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error scanning barcode:', error);
      await Swal.fire({ title: 'Error!', text: 'Gagal memindai barcode.', icon: 'error' });
    }
    setShowScanner(false);
  };

  const handleManualStockInput = async (productId, physicalStock) => {
    try {
      const target = auditResults.find((r) => r.id === productId);
      if (!target) return;

      const resultPayload = {
        productId,
        name: target.name,
        useBarcode: target.useBarcode !== false,
        databaseStock: target.databaseStock,
        readyStock: target.readyStock,
        physicalStock: parseInt(physicalStock),
        status: 'completed',
        updatedAt: Date.now()
      };
      await set(ref(database, `stockAuditsByDate/${auditDate}/results/${productId}`), resultPayload);

      const updatedResults = auditResults.map((r) =>
        r.id === productId ? { ...r, physicalStock: parseInt(physicalStock), status: 'completed' } : r
      );
      setAuditResults(updatedResults);

      const nextProduct = updatedResults.find((r) => r.status === 'pending');
      if (nextProduct) {
        setCurrentAuditProduct(nextProduct);
        setAuditMode(nextProduct.useBarcode !== false ? 'barcode' : 'manual');
      } else {
        setCurrentAuditProduct(null);
        setAuditMode(null);
      }
    } catch (e) {
      await Swal.fire({ title: 'Error!', text: e.message || 'Gagal menyimpan hasil item.', icon: 'error' });
    }
  };

  const handleFinalizeBarcodeAudit = async () => {
    try {
      if (!currentAuditProduct) return;
      const target = auditResults.find((r) => r.id === currentAuditProduct.id);
      const physicalCount = Array.isArray(target?.scannedUnits) ? target.scannedUnits.length : (target?.physicalStock ?? 0);

      const resultPayload = {
        productId: currentAuditProduct.id,
        name: currentAuditProduct.name,
        useBarcode: currentAuditProduct.useBarcode !== false,
        databaseStock: currentAuditProduct.databaseStock,
        readyStock: currentAuditProduct.readyStock,
        physicalStock: physicalCount,
        scannedUnits: Array.isArray(target?.scannedUnits) ? target.scannedUnits : [],
        status: 'completed',
        updatedAt: Date.now()
      };
      await set(ref(database, `stockAuditsByDate/${auditDate}/results/${currentAuditProduct.id}`), resultPayload);

      const updatedResults = auditResults.map((r) =>
        r.id === currentAuditProduct.id ? { ...r, physicalStock: physicalCount, status: 'completed' } : r
      );
      setAuditResults(updatedResults);

      const nextProduct = updatedResults.find((r) => r.status === 'pending');
      if (nextProduct) {
        setCurrentAuditProduct(nextProduct);
        setAuditMode(nextProduct.useBarcode !== false ? 'barcode' : 'manual');
      } else {
        setCurrentAuditProduct(null);
        setAuditMode(null);
      }
    } catch (e) {
      await Swal.fire({ title: 'Error!', text: e.message || 'Gagal menyelesaikan item.', icon: 'error' });
    }
  };

  const filteredProducts = products.filter(product => {
    // Safety checks for undefined/null values
    if (!product || !product.name || !product.category) {
      return false;
    }
    
    const term = searchTerm.toLowerCase();
    const inName = product.name.toLowerCase().includes(term);
    const inCategory = product.category.toLowerCase().includes(term);
    return inName || inCategory;
  });

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

  const saveAuditReport = async () => {
    try {
      const auditsRef = ref(database, 'stockAudits');
      const newAuditRef = push(auditsRef);
      const payload = {
        id: newAuditRef.key,
        date: auditDate,
        time: auditTime,
        createdAt: Date.now(),
        results: auditResults.map(r => ({
          productId: r.id,
          name: r.name,
          useBarcode: r.useBarcode !== false,
          databaseStock: r.databaseStock,
          readyStock: r.readyStock,
          physicalStock: r.physicalStock,
          status: r.status
        }))
      };
      await set(newAuditRef, payload);
      await Swal.fire({
        title: 'Tersimpan!',
        text: 'Laporan audit berhasil disimpan.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      await Swal.fire({
        title: 'Error!',
        text: e.message || 'Gagal menyimpan laporan audit.',
        icon: 'error'
      });
    }
  };

  const exportAuditPDF = () => {
    try {
      const title = `Laporan Stock Audit - ${auditDate} ${auditTime}`;
      const printableRows = auditResults.map((r) => {
        const dbVsFisik = r.physicalStock !== null ? (r.physicalStock - r.databaseStock) : null;
        const readyVsFisik = r.physicalStock !== null ? (r.physicalStock - r.readyStock) : null;
        const dbVsFisikText = dbVsFisik !== null ? (dbVsFisik > 0 ? `+${dbVsFisik}` : `${dbVsFisik}`) : '-';
        const readyVsFisikText = readyVsFisik !== null ? (readyVsFisik > 0 ? `+${readyVsFisik}` : `${readyVsFisik}`) : '-';
        
        return `
          <tr>
            <td>${r.name || '-'}</td>
            <td style="text-align:center;">${r.useBarcode !== false ? 'Barcode' : 'Manual'}</td>
            <td style="text-align:right;">${r.databaseStock ?? '-'}</td>
            <td style="text-align:right;">${r.readyStock ?? '-'}</td>
            <td style="text-align:right;">${r.physicalStock ?? '-'}</td>
            <td style="text-align:right;">${dbVsFisikText}</td>
            <td style="text-align:right;">${readyVsFisikText}</td>
            <td style="text-align:center;">${r.status}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
              body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 24px; }
              h1 { font-size: 18px; margin: 0 0 4px 0; }
              p { margin: 0 0 16px 0; color: #6b7280; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
              th { background: #f3f4f6; text-align: left; }
              tfoot td { font-weight: 600; }
              .meta { margin-bottom: 16px; }
              @media print {
                @page { size: A4; margin: 16mm; }
              }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p class="meta">Total item selesai: ${auditResults.filter(r => r.status === 'completed').length}/${auditResults.length}</p>
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th style="text-align:center;">Mode</th>
                  <th style="text-align:right;">DB</th>
                  <th style="text-align:right;">Ready</th>
                  <th style="text-align:right;">Fisik</th>
                  <th style="text-align:right;">DB vs Fisik</th>
                  <th style="text-align:right;">Ready vs Fisik</th>
                  <th style="text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${printableRows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=1024,height=768');
      if (!printWindow) return;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Delay print to ensure styles render
      setTimeout(() => {
        printWindow.print();
      }, 300);
    } catch (e) {
      Swal.fire({ title: 'Error!', text: e.message || 'Gagal mengekspor PDF.', icon: 'error' });
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>
          Manajemen Inventory
        </h1> */}
        {/* <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}> */}
        {/* </div> */}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center'
        }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', marginRight: '0.5rem' }} />
          <div>
            <h3 style={{ fontWeight: '500', color: '#991b1b', margin: 0, fontSize: '0.875rem' }}>
              Stok Rendah!
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', margin: 0 }}>
              {lowStockProducts.length} produk memiliki stok di bawah minimum
            </p>
          </div>
        </div>
      )}


      {/* Products Table */}
      <div style={{
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Table Header with Search and Actions */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
      {/* Search Bar */}
          <div style={{ 
            position: 'relative',
            flex: window.innerWidth <= 768 ? 'none' : '1',
            maxWidth: window.innerWidth <= 768 ? 'none' : '300px'
          }}>
          <Search size={20} style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af'
          }} />
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingRight: '1rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}
          />
      </div>

          {/* Action Buttons */}
      <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            width: window.innerWidth <= 768 ? '100%' : 'auto'
          }}>
            <button
              onClick={() => setShowAuditModal(true)}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                flex: window.innerWidth <= 768 ? '1' : 'none',
                minWidth: window.innerWidth <= 768 ? '0' : 'auto'
              }}
            >
              <CheckCircle size={20} />
              Stock Audit
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                backgroundColor: 'transparent',
                color: '#111827',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                flex: window.innerWidth <= 768 ? '1' : 'none',
                minWidth: window.innerWidth <= 768 ? '0' : 'auto'
              }}
            >
              <Plus size={20} />
              Produk
            </button>
          </div>
        </div>
        {/* Desktop Table */}
        <div style={{ 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: window.innerWidth <= 768 ? 'none' : 'block'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '600px'
          }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Produk
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Ready Stock
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Kategori
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Stok
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Harga
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Package size={20} style={{ color: '#9ca3af', marginRight: '0.75rem' }} />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                          {product.name}
                        </div>
                        {/* <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          ID: {product.id}
                        </div> */}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontWeight: '600',
                        color: (product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)) > 0 ? '#059669' : '#dc2626'
                      }}>
                        {product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)}
                      </span>
                      <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>
                        / {product.stock} unit
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {product.useBarcode !== false ? 'Dengan barcode' : 'Tanpa barcode'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#111827' }}>
                    {product.category}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: product.stock <= product.minStock ? '#dc2626' : '#111827'
                      }}>
                        {product.stock}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                        / {product.minStock} min
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {product.useBarcode !== false ? 'Dihitung dari unit' : 'Manual'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#111827' }}>
                    Rp {product.price.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleEdit(product)}
                        style={{
                          color: '#2563eb',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem'
                        }}
                      >
                        <Edit size={16} />
                      </button>
                      {product.useBarcode !== false && (
                        <button
                          onClick={() => handleAssignBarcode(product.id)}
                          style={{
                            color: '#10b981',
                            background: 'none',
                            border: '1px dashed #10b981',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem'
                          }}
                          title="Assign barcode via scan"
                        >
                          <Camera size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(product.id)}
                        style={{
                          color: '#dc2626',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}>
          {filteredProducts.map((product) => (
            <div key={product.id} style={{
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  {/* <Package size={16} style={{ color: '#9ca3af', marginRight: '0.5rem' }} /> */}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {product.category}
                    </div>
                  </div>
                </div>
                {/* <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  ID: {product.id}
                </div> */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: (product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)) > 0 ? '#059669' : '#dc2626'
                    }}>
                      Ready {product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>
                      / {product.stock}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Rp {product.price.toLocaleString('id-ID')}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {product.useBarcode !== false ? 'Dengan barcode' : 'Tanpa barcode'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1rem' }}>
                <button
                  onClick={() => handleEdit(product)}
                  style={{
                    color: '#2563eb',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '0.75rem'
                  }}
                  title="Edit"
                >
                  <Edit size={14} />
                </button>
                {product.useBarcode !== false && (
                  <button
                    onClick={() => handleAssignBarcode(product.id)}
                    style={{
                      color: '#10b981',
                      background: 'none',
                      border: '1px dashed #10b981',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      fontSize: '0.75rem'
                    }}
                    title="Assign Barcode"
                  >
                    <Camera size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(product.id)}
                  style={{
                    color: '#dc2626',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '0.75rem'
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
              {showAddModal ? 'Tambah Produk' : 'Edit Produk'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">
                    Nama Produk
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Kategori
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="form-select"
                  >
                    <option value="">Pilih Kategori</option>
                    <option value="IQOS Device">IQOS Device</option>
                    <option value="HEETS">HEETS</option>
                    <option value="Aksesoris">Aksesoris</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>


                <div>
                  <label className="form-label">
                    Harga
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="Harga jual produk"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Gunakan Barcode
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      name="useBarcode"
                      checked={formData.useBarcode}
                      onChange={handleInputChange}
                      style={{ width: '1rem', height: '1rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Centang jika produk menggunakan barcode untuk tracking unit
                    </span>
                  </div>
                  {formData.useBarcode && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: '#0369a1'
                    }}>
                      <strong>Info:</strong> Stok akan dihitung otomatis dari jumlah unit yang memiliki barcode. Field "Stok Awal" akan di-disable.
                    </div>
                  )}
                  {!formData.useBarcode && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #fbbf24',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: '#92400e'
                    }}>
                      <strong>Info:</strong> Produk tanpa barcode menggunakan input stok manual. Field "Stok Awal" akan di-enable untuk input manual.
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">
                      Stok Awal
                    </label>
                    <input
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleInputChange}
                      required={!formData.useBarcode}
                      disabled={formData.useBarcode}
                      min="0"
                      className="form-input"
                      placeholder={formData.useBarcode ? "Dihitung otomatis" : "Jumlah stok awal"}
                      style={{
                        opacity: formData.useBarcode ? 0.6 : 1,
                        backgroundColor: formData.useBarcode ? '#f9fafb' : 'white',
                        cursor: formData.useBarcode ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label">
                      Stok Minimum
                    </label>
                    <input
                      type="number"
                      name="minStock"
                      value={formData.minStock}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="form-input"
                      placeholder="Minimum stock untuk alert"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setFormData({
                      name: '',
                      category: '',
                      price: '',
                      stock: '',
                      minStock: '',
                      useBarcode: true
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {showAddModal ? 'Tambah' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Barcode Modal */}
      {showAssignBarcodeModal && assigningProductId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
              Assign Barcode ke Unit
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                Input Barcode Manual
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Masukkan barcode..."
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleManualAssign}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Assign
                </button>
              </div>
            </div>

            <div style={{ 
              textAlign: 'center', 
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                Atau scan barcode dengan kamera
              </p>
              <button
                onClick={() => {
                  setShowAssignBarcodeModal(false);
                  setScanningMode('assign');
                  setShowScanner(true);
                }}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  margin: '0 auto'
                }}
              >
                <Camera size={16} />
                Scan Barcode
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setShowAssignBarcodeModal(false);
                  setAssigningProductId(null);
                  setManualBarcode('');
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Check Modal */}
      {showStockCheckModal && checkedProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
              Informasi Stok Produk
            </h3>
            
            <div style={{
              backgroundColor: checkedProduct.stock <= checkedProduct.minStock ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${checkedProduct.stock <= checkedProduct.minStock ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <Package size={20} style={{ 
                  color: checkedProduct.stock <= checkedProduct.minStock ? '#dc2626' : '#059669',
                  marginRight: '0.5rem'
                }} />
                <h4 style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: checkedProduct.stock <= checkedProduct.minStock ? '#991b1b' : '#065f46',
                  margin: 0
                }}>
                  {checkedProduct.name}
                </h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Unit ID:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                    {checkedProduct.matchedUnitId || '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Kategori:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                    {checkedProduct.category}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Stok Saat Ini:</span>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: checkedProduct.stock <= checkedProduct.minStock ? '#dc2626' : '#059669'
                  }}>
                    {checkedProduct.stock} unit
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Stok Minimum:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                    {checkedProduct.minStock} unit
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Harga:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827' }}>
                    Rp {checkedProduct.price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              
              {checkedProduct.stock <= checkedProduct.minStock && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.25rem'
                }}>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: '#991b1b', 
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <AlertTriangle size={14} style={{ marginRight: '0.25rem' }} />
                    Stok rendah! Segera lakukan restocking.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setShowStockCheckModal(false);
                  setCheckedProduct(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setShowStockCheckModal(false);
                  setCheckedProduct(null);
                  setShowScanner(true);
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Scan Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Audit Modal */}
      {showAuditModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
              Stock Audit Report
            </h3>
            
            {/* Date and Time Input */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Tanggal Audit</label>
                <input
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Waktu Audit</label>
                <input
                  type="time"
                  value={auditTime}
                  onChange={(e) => setAuditTime(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* Start Audit Button */}
            {auditResults.length === 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Tutup
                </button>
                <button
                  onClick={startStockAudit}
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Mulai Stock Audit
                </button>
              </div>
            )}

            {/* Current Product Being Audited */}
            {currentAuditProduct && (
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', margin: 0 }}>
                  Sedang Audit: {currentAuditProduct.name}
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', margin: 0 }}>
                  Database Stock: {currentAuditProduct.databaseStock} | Ready Stock: {currentAuditProduct.readyStock}
                </p>
                
                {auditMode === 'manual' ? (
                  <div>
                    <label className="form-label">Stock Fisik:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Masukkan jumlah fisik"
                        className="form-input"
                        style={{ flex: 1 }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const value = e.target.value;
                            if (value) {
                              handleManualStockInput(currentAuditProduct.id, value);
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.target.previousElementSibling;
                          if (input.value) {
                            handleManualStockInput(currentAuditProduct.id, input.value);
                            input.value = '';
                          }
                        }}
                        className="btn btn-primary"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', margin: 0 }}>
                      Scan barcode untuk menghitung stock fisik
                    </p>
                    <button
                      onClick={() => setShowScanner(true)}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      <Camera size={20} style={{ marginRight: '0.5rem' }} />
                      Scan Barcode
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      <span>Ter-scan: {Array.isArray(currentAuditProduct.scannedUnits) ? currentAuditProduct.scannedUnits.length : (currentAuditProduct.physicalStock ?? 0)} unit</span>
                      <span>
                        Var: {(() => {
                          const count = Array.isArray(currentAuditProduct.scannedUnits) ? currentAuditProduct.scannedUnits.length : (currentAuditProduct.physicalStock ?? 0);
                          const diff = count - (currentAuditProduct.databaseStock ?? 0);
                          return `${diff > 0 ? '+' : ''}${diff}`;
                        })()}
                      </span>
                    </div>
                    <button
                      onClick={handleFinalizeBarcodeAudit}
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                    >
                      Selesaikan Item
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Audit Results */}
            {auditResults.length > 0 && (
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
                  Hasil Audit ({auditResults.filter(r => r.status === 'completed').length}/{auditResults.length})
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {auditResults.map((result) => {
                    const dbVsFisik = result.physicalStock !== null ? (result.physicalStock - result.databaseStock) : null;
                    const readyVsFisik = result.physicalStock !== null ? (result.physicalStock - result.readyStock) : null;
                    const hasDbDiscrepancy = dbVsFisik !== null && dbVsFisik !== 0;
                    const hasReadyDiscrepancy = readyVsFisik !== null && readyVsFisik !== 0;
                    
                    return (
                      <div key={result.id} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        backgroundColor: result.status === 'completed' ? '#f0fdf4' : '#fefce8',
                        borderLeft: hasDbDiscrepancy || hasReadyDiscrepancy ? '4px solid #ef4444' : '4px solid #10b981'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h5 style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
                              {result.name}
                            </h5>
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                              {result.useBarcode !== false ? 'Barcode' : 'Manual'}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              DB: {result.databaseStock} | Ready: {result.readyStock}
                            </div>
                            {result.status === 'completed' ? (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '500', color: '#059669' }}>
                                  Fisik: {result.physicalStock}
                                </div>
                                {(hasDbDiscrepancy || hasReadyDiscrepancy) && (
                                  <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                    {hasDbDiscrepancy && (
                                      <span style={{ 
                                        color: dbVsFisik > 0 ? '#059669' : '#ef4444',
                                        fontWeight: '500'
                                      }}>
                                        DB: {dbVsFisik > 0 ? '+' : ''}{dbVsFisik}
                                      </span>
                                    )}
                                    {hasDbDiscrepancy && hasReadyDiscrepancy && <span style={{ margin: '0 0.25rem' }}>|</span>}
                                    {hasReadyDiscrepancy && (
                                      <span style={{ 
                                        color: readyVsFisik > 0 ? '#059669' : '#ef4444',
                                        fontWeight: '500'
                                      }}>
                                        Ready: {readyVsFisik > 0 ? '+' : ''}{readyVsFisik}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', fontWeight: '500', color: '#f59e0b' }}>
                                Pending
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            {auditResults.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    setShowAuditModal(false);
                    setAuditResults([]);
                    setCurrentAuditProduct(null);
                    setAuditMode(null);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Tutup
                </button>
                <button
                  onClick={exportAuditPDF}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Export PDF
                </button>
                <button
                  onClick={async () => {
                    await set(ref(database, `stockAuditsByDate/${auditDate}/meta/`), {
                      date: auditDate,
                      updatedAt: Date.now()
                    });
                    await saveAuditReport();
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Simpan Laporan
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={scanningMode === 'assign' ? handleAssignScan : (scanningMode === 'check' ? handleStockCheckScan : handleAuditBarcodeScan)}
        onClose={() => { setShowScanner(false); setScanningMode(null); setAssigningProductId(null); }}
      />
    </div>
  );
};

export default InventoryManagement;