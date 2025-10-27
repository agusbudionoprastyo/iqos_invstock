import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, Camera, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { productService, categoryService } from '../services/database';
import BarcodeScanner from './BarcodeScanner';
import { showToast } from '../utils/toast.jsx';
import { ref, get, push, set } from 'firebase/database';
import { database } from '../firebase/config';
import * as XLSX from 'xlsx';

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
  const [categories, setCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState('');
  
  // Stock Audit states
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditTime, setAuditTime] = useState(new Date().toTimeString().slice(0, 5));
  const [auditResults, setAuditResults] = useState([]);
  const [currentAuditProduct, setCurrentAuditProduct] = useState(null);
  const [auditMode, setAuditMode] = useState(null); // 'manual' | 'barcode' | null
  const [auditFilter, setAuditFilter] = useState('all'); // 'all' | 'balance' | 'variance'
  const [auditPage, setAuditPage] = useState(1);
  const itemsPerAuditPage = 2;
  
  // Excel Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Use super-optimized function that gets everything in 2 Firebase calls
      const productsWithStockData = await productService.getAllProductsWithStockData();
      
      // Extract data for state
      const products = productsWithStockData.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
        minStock: p.minStock,
        useBarcode: p.useBarcode,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));
      
      const barcodeCounts = {};
      const readyStocks = {};
      
      productsWithStockData.forEach(p => {
        barcodeCounts[p.id] = p.barcodeCount;
        readyStocks[p.id] = p.readyStock;
      });
      
      setProducts(products);
      setProductsWithBarcodeCount(barcodeCounts);
      setReadyStockCount(readyStocks);
      
      // Check for low stock products
      const lowStock = products.filter(product => product.stock <= product.minStock);
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      // Load categories from Firebase
      const firebaseCategories = await categoryService.getAllCategories();
      
      // Also get categories from existing products
      const productCategories = await categoryService.getCategoriesFromProducts();
      
      // Combine and deduplicate categories
      const allCategories = [...firebaseCategories, ...productCategories];
      const uniqueCategories = allCategories.reduce((acc, category) => {
        if (!acc.find(c => c.name === category.name)) {
          acc.push(category);
        }
        return acc;
      }, []);
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
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
      let categoryName = formData.category;
      
      // If custom category is provided, use it
      if (customCategory.trim()) {
        categoryName = customCategory.trim();
        
        // Check if this category already exists
        const existingCategory = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
        if (!existingCategory) {
          // Create new category in Firebase
          await categoryService.createCategory({ name: categoryName });
          // Reload categories to include the new one
          await loadCategories();
        }
      }

      const productData = {
        ...formData,
        category: categoryName,
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
      setCustomCategory('');
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
    const result = await showToast.confirm('Apakah Anda yakin ingin menghapus produk ini?', 'Hapus Produk?');

    if (result) {
      try {
        await productService.deleteProduct(productId);
        showToast.success('Produk berhasil dihapus.', 'Berhasil!');
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        showToast.error('Gagal menghapus produk.', 'Error!');
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
        showToast.warning('Barcode tidak terdaftar dalam sistem.', 'Produk Tidak Ditemukan');
      }
    } catch (error) {
      console.error('Error checking stock:', error);
      showToast.error('Gagal memeriksa stok.', 'Error!');
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
      showToast.success('Barcode berhasil di-assign.', 'Berhasil!');
      setAssigningProductId(null);
      setScanningMode(null);
      setShowScanner(false);
      loadProducts();
    } catch (e) {
      showToast.error(e.message || 'Gagal assign barcode', 'Error!');
      setAssigningProductId(null);
      setScanningMode(null);
      setShowScanner(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualBarcode.trim()) {
      showToast.warning('Masukkan barcode terlebih dahulu.', 'Perhatian!');
      return;
    }
    
    try {
      await productService.addBarcodeToProduct(assigningProductId, manualBarcode.trim());
      showToast.success('Barcode berhasil di-assign.', 'Berhasil!');
      setShowAssignBarcodeModal(false);
      setAssigningProductId(null);
      setManualBarcode('');
      loadProducts();
    } catch (e) {
      showToast.error(e.message || 'Gagal assign barcode', 'Error!');
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
      showToast.error(e.message || 'Gagal memulai audit.', 'Error!');
    }
  };


  const getFilteredAuditResults = () => {
    if (auditFilter === 'all') return auditResults;
    
    return auditResults.filter(result => {
      if (result.status !== 'completed') return false;
      
      const variance = result.physicalStock - result.databaseStock;
      
      if (auditFilter === 'balance') {
        return variance === 0;
      } else if (auditFilter === 'variance') {
        return variance !== 0;
      }
      
      return true;
    });
  };

  const handleProductClickForAudit = (product) => {
    // Find the product in audit results
    const auditResult = auditResults.find(r => r.id === product.id);
    if (!auditResult) return;

    // Set as current audit product
    setCurrentAuditProduct(auditResult);
    setAuditMode(auditResult.useBarcode !== false ? 'barcode' : 'manual');
  };

  const handleAuditBarcodeScan = async (barcode) => {
    try {
      const product = await productService.getProductByBarcode(barcode);
      if (!(product && currentAuditProduct && product.id === currentAuditProduct.id)) {
        showToast.warning('Barcode tidak sesuai produk yang diaudit.', 'Barcode Salah');
        setShowScanner(false);
        return;
      }

      // Fetch units for current product
      const unitsRef = ref(database, `productUnits/${product.id}`);
      const unitsSnap = await get(unitsRef);
      if (!unitsSnap.exists()) {
        showToast.warning('Tidak ada unit untuk produk ini.', 'Tidak Ada Unit');
        setShowScanner(false);
        return;
      }

      const unitsObj = unitsSnap.val();
      const targetEntry = Object.entries(unitsObj).find(([unitId, unit]) => unit.barcode === barcode && unit.status === 'in_stock');
      if (!targetEntry) {
        showToast.warning('Unit barcode tidak tersedia/in-stock.', 'Unit Tidak Ditemukan');
        setShowScanner(false);
        return;
      }

      const [unitId] = targetEntry;
      // Get existing scanned units from local state (persisted in result)
      const existing = auditResults.find((r) => r.id === currentAuditProduct.id);
      const scannedUnits = Array.isArray(existing?.scannedUnits) ? existing.scannedUnits.slice() : [];

      if (scannedUnits.includes(unitId)) {
        showToast.info('Unit ini sudah discan untuk produk ini.', 'Duplikat Scan');
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

      showToast.success(`Ter-scan: ${physicalCount} unit`, 'Tersimpan');
    } catch (error) {
      console.error('Error scanning barcode:', error);
      showToast.error('Gagal memindai barcode.', 'Error!');
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
      showToast.error(e.message || 'Gagal menyimpan hasil item.', 'Error!');
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
      showToast.error(e.message || 'Gagal menyelesaikan item.', 'Error!');
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

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
      // Generate numeric ID for audit
      const auditsRef = ref(database, 'counters/stockAudits');
      const counterSnap = await get(auditsRef);
      let currentCount = 0;
      if (counterSnap.exists()) {
        currentCount = counterSnap.val() || 0;
      }
      const auditId = (currentCount + 1).toString().padStart(6, '0');
      await set(auditsRef, currentCount + 1);
      
      const auditRef = ref(database, `stockAudits/${auditId}`);
      const payload = {
        id: auditId,
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
      await set(auditRef, payload);
      showToast.success('Laporan audit berhasil disimpan.', 'Tersimpan!');
    } catch (e) {
      showToast.error(e.message || 'Gagal menyimpan laporan audit.', 'Error!');
    }
  };


  // Excel Import Functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip header row and convert to product objects
        const products = jsonData.slice(1).map((row, index) => {
          if (!row[0] || !row[1] || !row[2]) return null; // Skip empty rows
          
          const categoryName = row[1]?.toString().trim() || '';
          
          return {
            name: row[0]?.toString().trim() || '',
            category: categoryName,
            price: parseFloat(row[2]) || 0,
            stock: parseInt(row[3]) || 0,
            minStock: parseInt(row[4]) || 0,
            useBarcode: row[5]?.toString().toLowerCase() === 'true' || false,
            rowIndex: index + 2 // +2 because we skip header and arrays are 0-indexed
          };
        }).filter(Boolean);

        setImportData(products);
      } catch (error) {
        showToast.error('Gagal membaca file Excel.', 'Error!');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateImportData = (data) => {
    const errors = [];
    data.forEach((product, index) => {
      if (!product.name) errors.push(`Baris ${product.rowIndex}: Nama produk kosong`);
      if (!product.category) errors.push(`Baris ${product.rowIndex}: Kategori kosong`);
      if (product.price <= 0) errors.push(`Baris ${product.rowIndex}: Harga harus lebih dari 0`);
      if (product.stock < 0) errors.push(`Baris ${product.rowIndex}: Stock tidak boleh negatif`);
      if (product.minStock < 0) errors.push(`Baris ${product.rowIndex}: Min stock tidak boleh negatif`);
    });
    return errors;
  };

  const importProducts = async () => {
    try {
      const errors = validateImportData(importData);
      if (errors.length > 0) {
        showToast.error(errors.slice(0, 5).join(', ') + (errors.length > 5 ? '...dan lainnya' : ''), 'Data Tidak Valid!');
        return;
      }

      setImportProgress({ current: 0, total: importData.length });
      
      // First, create any new categories that don't exist
      const uniqueCategories = [...new Set(importData.map(p => p.category))];
      for (const categoryName of uniqueCategories) {
        const existingCategory = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
        if (!existingCategory) {
          await categoryService.createCategory({ name: categoryName });
        }
      }
      
      // Reload categories after creating new ones
      await loadCategories();
      
      for (let i = 0; i < importData.length; i++) {
        const product = importData[i];
        await productService.createProduct({
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.useBarcode ? 0 : product.stock,
          minStock: product.minStock,
          useBarcode: product.useBarcode
        });
        
        setImportProgress({ current: i + 1, total: importData.length });
      }

      showToast.success(`${importData.length} produk berhasil diimpor.`, 'Berhasil!');

      setShowImportModal(false);
      setImportFile(null);
      setImportData([]);
      setImportProgress({ current: 0, total: 0 });
      loadProducts();
    } catch (error) {
      showToast.error(error.message || 'Gagal mengimpor produk.', 'Error!');
    }
  };

  return (
    <div style={{ 
      padding: window.innerWidth <= 768 ? '0.2rem' : '1.5rem' 
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-color)', margin: 0 }}>
          Manajemen Inventory
        </h1> */}
        {/* <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}> */}
        {/* </div> */}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error-color)',
          borderRadius: '1rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center'
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--error-color)', marginRight: '0.5rem' }} />
          <div>
            <h3 style={{ fontWeight: '500', color: 'var(--error-color)', margin: 0, fontSize: '0.875rem' }}>
              Stok Rendah!
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--error-color)', marginTop: '0.25rem', margin: 0 }}>
              {lowStockProducts.length} produk memiliki stok di bawah minimum
            </p>
          </div>
        </div>
      )}


      {/* Products Table */}
      <div style={{
        background: 'var(--card-background)',
        borderRadius: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {/* Table Header with Search and Actions */}
        <div style={{
          backgroundColor: 'var(--background-color)',
          padding: window.innerWidth <= 768 ? '1rem 1rem' : '1rem 1.5rem',
          // borderBottom: '1px solid var(--border-color)',
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
            color: 'var(--secondary-color)'
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
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              background: 'var(--card-background)',
              color: 'var(--text-color)'
            }}
          />
      </div>

          {/* Action Buttons */}
          {window.innerWidth <= 768 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Stock Audit - Full Width */}
              <button
                onClick={startStockAudit}
                style={{
                  backgroundColor: 'var(--success-color)',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  width: '100%'
                }}
              >
                <CheckCircle size={20} />
                Stock Audit
              </button>
              
              {/* Import Excel and Produk - Side by Side */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowImportModal(true)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-color)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    flex: 1
                  }}
                >
                  <Package size={20} />
                  Import Excel
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-color)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    flex: 1
                  }}
                >
                  <Plus size={20} />
                  Produk
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={startStockAudit}
                style={{
                  backgroundColor: 'var(--success-color)',
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
                  fontWeight: '500'
                }}
              >
                <CheckCircle size={20} />
                Stock Audit
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-color)',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                <Package size={20} />
                Import Excel
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-color)',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                <Plus size={20} />
                Produk
              </button>
            </div>
          )}
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
            <thead style={{ backgroundColor: 'var(--background-color)' }}>
              <tr>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Produk
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Ready Stock
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Kategori
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Stok
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Harga
                </th>
                <th style={{
                  padding: '0.75rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: 'var(--secondary-color)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Package size={20} style={{ color: 'var(--secondary-color)', marginRight: '0.75rem' }} />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                          {product.name}
                        </div>
                        {/* <div style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>
                          ID: {product.id}
                        </div> */}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontWeight: '600',
                        color: (product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)) > 0 ? 'var(--success-color)' : 'var(--error-color)'
                      }}>
                        {product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)}
                      </span>
                      <span style={{ color: 'var(--secondary-color)', marginLeft: '0.25rem' }}>
                        / {product.stock} unit
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', marginTop: '0.25rem' }}>
                      {product.useBarcode !== false ? 'Dengan barcode' : 'Tanpa barcode'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-color)' }}>
                    {product.category}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: product.stock <= product.minStock ? 'var(--error-color)' : 'var(--text-color)'
                      }}>
                        {product.stock}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginLeft: '0.25rem' }}>
                        / {product.minStock} min
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', marginTop: '0.25rem' }}>
                      {product.useBarcode !== false ? 'Dihitung dari unit' : 'Manual'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-color)' }}>
                    Rp {product.price.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleEdit(product)}
                        style={{
                          color: 'var(--primary-color)',
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
                            color: 'var(--success-color)',
                            background: 'none',
                            border: '1px dashed var(--success-color)',
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
                          color: 'var(--error-color)',
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              padding: '1rem'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: currentPage === 1 ? 'var(--background-color)' : 'var(--card-background)',
                  color: currentPage === 1 ? 'var(--secondary-color)' : 'var(--text-color)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--secondary-color)',
                minWidth: '100px',
                textAlign: 'center'
              }}>
                {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: currentPage === totalPages ? 'var(--background-color)' : 'var(--card-background)',
                  color: currentPage === totalPages ? 'var(--secondary-color)' : 'var(--text-color)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}>
          {paginatedProducts.map((product) => (
            <div key={product.id} style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  {/* <Package size={16} style={{ color: 'var(--secondary-color)', marginRight: '0.5rem' }} /> */}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>
                      {product.category}
                    </div>
                  </div>
                </div>
                {/* <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', marginBottom: '0.25rem' }}>
                  ID: {product.id}
                </div> */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: (product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)) > 0 ? 'var(--success-color)' : 'var(--error-color)'
                    }}>
                      Ready {product.useBarcode === false ? product.stock : (readyStockCount[product.id] || 0)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', marginLeft: '0.25rem' }}>
                      / {product.stock}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>
                    Rp {product.price.toLocaleString('id-ID')}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', marginTop: '0.25rem' }}>
                  {product.useBarcode !== false ? 'Dengan barcode' : 'Tanpa barcode'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1rem' }}>
                <button
                  onClick={() => handleEdit(product)}
                  style={{
                    color: 'var(--primary-color)',
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
                      color: 'var(--success-color)',
                      background: 'none',
                      border: '1px dashed var(--success-color)',
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
                    color: 'var(--error-color)',
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
          
          {/* Mobile Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              padding: '1rem'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: currentPage === 1 ? 'var(--background-color)' : 'var(--card-background)',
                  color: currentPage === 1 ? 'var(--secondary-color)' : 'var(--text-color)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--secondary-color)',
                minWidth: '100px',
                textAlign: 'center'
              }}>
                {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: currentPage === totalPages ? 'var(--background-color)' : 'var(--card-background)',
                  color: currentPage === totalPages ? 'var(--secondary-color)' : 'var(--text-color)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0, color: 'var(--text-color)' }}>
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
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                    <option value="custom">+ Tambah Kategori Baru</option>
                  </select>
                  
                  {formData.category === 'custom' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Masukkan nama kategori baru..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="form-input"
                        style={{ marginTop: '0.5rem' }}
                      />
                    </div>
                  )}
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
                    <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>
                      Centang jika produk menggunakan barcode untuk tracking unit
                    </span>
                  </div>
                  {formData.useBarcode && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid var(--primary-color)',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: 'var(--primary-color)'
                    }}>
                      <strong>Info:</strong> Stok akan dihitung otomatis dari jumlah unit yang memiliki barcode. Field "Stok Awal" akan di-disable.
                    </div>
                  )}
                  {!formData.useBarcode && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid var(--warning-color)',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      color: 'var(--warning-color)'
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
                        backgroundColor: formData.useBarcode ? 'var(--background-color)' : 'var(--card-background)',
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
                    setCustomCategory('');
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
          <div className="modal" style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowAssignBarcodeModal(false);
                setAssigningProductId(null);
                setManualBarcode('');
              }}
              aria-label="Tutup"
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                width: '24px',
                height: '24px',
                background: 'var(--card-background)',
                border: 'none',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                color: 'var(--secondary-color)',
                cursor: 'pointer'
              }}
            >
              <X size={12} />
            </button>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0, color: 'var(--text-color)' }}>
              Barcode
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
              backgroundColor: 'var(--background-color)',
              borderRadius: '.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', margin: '0 0 0.5rem 0' }}>
                Atau scan barcode dengan kamera
              </p>
              <button
                onClick={() => {
                  setShowAssignBarcodeModal(false);
                  setScanningMode('assign');
                  setShowScanner(true);
                }}
                style={{
                  backgroundColor: 'var(--success-color)',
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

            
          </div>
        </div>
      )}

      {/* Stock Check Modal */}
      {showStockCheckModal && checkedProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0, color: 'var(--text-color)' }}>
              Informasi Stok Produk
            </h3>
            
            <div style={{
              backgroundColor: checkedProduct.stock <= checkedProduct.minStock ? 'var(--error-color)' : 'var(--success-color)',
              border: `1px solid ${checkedProduct.stock <= checkedProduct.minStock ? 'var(--error-color)' : 'var(--success-color)'}`,
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <Package size={20} style={{ 
                  color: checkedProduct.stock <= checkedProduct.minStock ? 'var(--error-color)' : 'var(--success-color)',
                  marginRight: '0.5rem'
                }} />
                <h4 style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: checkedProduct.stock <= checkedProduct.minStock ? 'var(--error-color)' : 'var(--success-color)',
                  margin: 0
                }}>
                  {checkedProduct.name}
                </h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>Unit ID:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                    {checkedProduct.matchedUnitId || '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>Kategori:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                    {checkedProduct.category}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>Stok Saat Ini:</span>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    color: checkedProduct.stock <= checkedProduct.minStock ? 'var(--error-color)' : 'var(--success-color)'
                  }}>
                    {checkedProduct.stock} unit
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>Stok Minimum:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                    {checkedProduct.minStock} unit
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--secondary-color)' }}>Harga:</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-color)' }}>
                    Rp {checkedProduct.price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              
              {checkedProduct.stock <= checkedProduct.minStock && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: 'var(--error-color)',
                  border: '1px solid var(--error-color)',
                  borderRadius: '0.25rem'
                }}>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--error-color)', 
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
      {auditResults.length > 0 && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0, color: 'var(--text-color)' }}>
                Stock Audit Report
              </h3>
            </div>

            {/* Current Product Being Audited */}
            {currentAuditProduct && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                // border: '1px solid var(--primary-color)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', margin: 0, color: 'var(--text-color)' }}>
                  {currentAuditProduct.name}
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginBottom: '0.5rem', margin: 0 }}>
                  Stock : {currentAuditProduct.databaseStock}
                </p>
                
                {auditMode === 'manual' ? (
                  <div>
                    {/* <label className="form-label">Stock Fisik</label> */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Jumlah stock fisik"
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
                    <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginBottom: '0.5rem', margin: 0 }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--secondary-color)' }}>
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

            {/* Filter Options */}
            {auditResults.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() => setAuditFilter('all')}
                    className={`btn ${auditFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0 1rem', borderRadius: '2rem' }}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setAuditFilter('balance')}
                    className={`btn ${auditFilter === 'balance' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0 1rem', borderRadius: '2rem' }}
                  >
                    Balance
                  </button>
                  <button
                    onClick={() => setAuditFilter('variance')}
                    className={`btn ${auditFilter === 'variance' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0 1rem', borderRadius: '2rem' }}
                  >
                    Ada Selisih
                  </button>
                </div>
                {/* <div style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>
                  Menampilkan maksimal 2 per halaman ({getFilteredAuditResults().length} total)
                </div> */}
              </div>
            )}

            {/* Audit Results */}
            {auditResults.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: 'var(--text-color)' }}>
                  Hasil Audit ({auditResults.filter(r => r.status === 'completed').length}/{auditResults.length})
                </h4>
                  {/* Pagination for audit list */}
                  {Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage)) > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <button
                        onClick={() => setAuditPage(prev => Math.max(prev - 1, 1))}
                        disabled={auditPage === 1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.4rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: auditPage === 1 ? 'var(--secondary-color)' : 'var(--text-color)',
                          cursor: auditPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--secondary-color)',
                        minWidth: '60px',
                        textAlign: 'center'
                      }}>
                        {auditPage}/{Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage))}
                      </span>
                      
                      <button
                        onClick={() => setAuditPage(prev => Math.min(prev + 1, Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage))))}
                        disabled={auditPage === Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.4rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: auditPage === Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage)) ? 'var(--secondary-color)' : 'var(--text-color)',
                          cursor: auditPage === Math.max(1, Math.ceil(getFilteredAuditResults().length / itemsPerAuditPage)) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ maxHeight: '300px', padding: '0.25rem' }}>
                  {(() => {
                    const filtered = getFilteredAuditResults();
                    const start = (auditPage - 1) * itemsPerAuditPage;
                    const slice = filtered.slice(start, start + itemsPerAuditPage);
                    return slice.map((result) => {
                    const dbVsFisik = result.physicalStock !== null ? (result.physicalStock - result.databaseStock) : null;
                    const readyVsFisik = result.physicalStock !== null ? (result.physicalStock - result.readyStock) : null;
                    const hasDbDiscrepancy = dbVsFisik !== null && dbVsFisik !== 0;
                    const hasReadyDiscrepancy = readyVsFisik !== null && readyVsFisik !== 0;
                    const hasMinusVariance = (dbVsFisik !== null && dbVsFisik < 0) || (readyVsFisik !== null && readyVsFisik < 0);
                    const hasVariance = hasDbDiscrepancy || hasReadyDiscrepancy;
                    const isSelected = currentAuditProduct && currentAuditProduct.id === result.id;
                    
                    // Determine border left color based on status
                    let borderLeftColor;
                    if (result.status === 'pending') {
                      borderLeftColor = 'var(--warning-color)';
                    } else if (hasMinusVariance) {
                      borderLeftColor = 'var(--error-color)';
                    } else if (hasVariance) {
                      borderLeftColor = 'var(--warning-color)';
                    } else {
                      borderLeftColor = 'var(--success-color)';
                    }
                    
                    return (
                      <div 
                        key={result.id} 
                        onClick={() => handleProductClickForAudit(result)}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: result.status === 'pending' 
                            ? 'rgba(245, 158, 11, 0.1)' 
                            : (hasMinusVariance ? 'rgba(239, 68, 68, 0.1)' : hasVariance ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                          borderLeft: isSelected 
                            ? `5px solid ${borderLeftColor}` 
                            : `5px solid ${borderLeftColor}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          outline: isSelected ? '3px dashed var(--secondary-color)' : 'none',
                          outlineOffset: isSelected ? '2px' : '0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h5 style={{ fontSize: '0.8rem', fontWeight: '500', margin: 0, color: 'var(--text-color)' }}>
                              {result.name}
                            </h5>
                            <p style={{ fontSize: '0.7rem', color: 'var(--secondary-color)', margin: 0 }}>
                              {result.useBarcode !== false ? 'Barcode' : 'Manual'}
                            </p>
                            {result.status === 'pending' && (
                              <p style={{ fontSize: '0.65rem', color: 'var(--warning-color)', margin: '0.2rem 0 0 0', fontWeight: '500' }}>
                                Klik untuk audit
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--secondary-color)' }}>
                              Stock : {result.databaseStock}
                            </div>
                            {result.status === 'completed' ? (
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '500', color: 'var(--success-color)' }}>
                                  Fisik: {result.physicalStock}
                                </div>
                                {(hasDbDiscrepancy || hasReadyDiscrepancy) && (
                                  <div style={{ fontSize: '0.65rem', marginTop: '0.2rem' }}>
                                    {hasReadyDiscrepancy && (
                                      <span style={{ 
                                        color: readyVsFisik > 0 ? 'var(--success-color)' : 'var(--error-color)',
                                        fontWeight: '500'
                                      }}>
                                      {readyVsFisik > 0 ? '+' : ''}{readyVsFisik}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', fontWeight: '500', color: 'var(--warning-color)' }}>
                                Pending
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            {auditResults.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
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
                  Selesaikan Audit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0, color: 'var(--text-color)' }}>
              Import Produk dari Excel
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Format Excel:</label>
              <div style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginBottom: '1rem' }}>
                Kolom: Nama | Kategori | Harga | Stock | Min Stock | Use Barcode (true/false)
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
            </div>

            {importData.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Preview Data ({importData.length} produk)
                </h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
                  <table style={{ width: '100%', fontSize: '0.75rem' }}>
                    <thead style={{ backgroundColor: 'var(--background-color)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Nama</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Kategori</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Harga</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Stock</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 10).map((product, index) => (
                        <tr key={index}>
                          <td style={{ padding: '0.5rem' }}>{product.name}</td>
                          <td style={{ padding: '0.5rem' }}>{product.category}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{product.price.toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{product.stock}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{product.useBarcode ? 'Ya' : 'Tidak'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importData.length > 10 && (
                    <div style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--secondary-color)' }}>
                      ...dan {importData.length - 10} produk lainnya
                    </div>
                  )}
                </div>
              </div>
            )}

            {importProgress.total > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem' }}>Progress Import</span>
                  <span style={{ fontSize: '0.875rem' }}>{importProgress.current}/{importProgress.total}</span>
                </div>
                <div style={{ width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '0.25rem', height: '8px' }}>
                  <div 
                    style={{ 
                      width: `${(importProgress.current / importProgress.total) * 100}%`, 
                      backgroundColor: 'var(--success-color)', 
                      height: '100%', 
                      borderRadius: '0.25rem',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportData([]);
                  setImportProgress({ current: 0, total: 0 });
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button
                onClick={importProducts}
                disabled={importData.length === 0 || importProgress.total > 0}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {importProgress.total > 0 ? 'Mengimpor...' : 'Import Produk'}
              </button>
            </div>
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