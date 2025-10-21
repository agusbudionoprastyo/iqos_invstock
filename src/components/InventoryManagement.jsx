import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, Camera, CheckCircle } from 'lucide-react';
import { productService } from '../services/database';
import BarcodeScanner from './BarcodeScanner';
import Swal from 'sweetalert2';

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
        icon: 'error'
      });
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
              onClick={() => setScanningMode('stock_check')}
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
              Check Stock
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

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={scanningMode === 'assign' ? handleAssignScan : (scanningMode === 'check' ? handleStockCheckScan : handleBarcodeScan)}
        onClose={() => { setShowScanner(false); setScanningMode(null); setAssigningProductId(null); }}
      />
    </div>
  );
};

export default InventoryManagement;