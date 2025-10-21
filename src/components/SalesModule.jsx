import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Camera, Search, Receipt } from 'lucide-react';
import { productService, salesService } from '../services/database';
import BarcodeScanner from './BarcodeScanner';
import Swal from 'sweetalert2';

const SalesModule = () => {
  const [products, setProducts] = useState([]);
  const [readyStockData, setReadyStockData] = useState({});
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningMode, setScanningMode] = useState(null); // 'add' | 'increase' | null
  const [scanningProductId, setScanningProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeFilter, setBarcodeFilter] = useState('all'); // 'all' | 'barcode' | 'manual'
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await productService.getAllProducts();
      
      // Load ready stock for each product
      const readyStocks = {};
      for (const product of productsData) {
        readyStocks[product.id] = await productService.getReadyStock(product.id);
      }
      setReadyStockData(readyStocks);
      
      // Only show products with ready stock > 0
      const availableProducts = productsData.filter(product => readyStocks[product.id] > 0);
      setProducts(availableProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = async (barcode) => {
    try {
      const product = await productService.getProductByBarcode(barcode);
      if (product) {
        if (scanningMode === 'add') {
          // Mode add to cart
          addToCart(product);
        } else if (scanningMode === 'increase' && scanningProductId) {
          // Mode increase quantity
          increaseQuantity(scanningProductId);
        } else {
          // Default mode - add to cart
          addToCart(product);
        }
      } else {
        await Swal.fire({
          title: 'Produk Tidak Ditemukan',
          text: 'Barcode tidak terdaftar dalam sistem.',
          icon: 'warning'
        });
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Gagal memindai barcode.',
        icon: 'error'
      });
    }
    setShowScanner(false);
    setScanningMode(null);
    setScanningProductId(null);
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      // If product already in cart, increase quantity
      increaseQuantity(product.id);
    } else {
      const readyStock = readyStockData[product.id] || 0;
      if (readyStock <= 0) {
        Swal.fire({
          title: 'Stok Habis',
          text: 'Stok siap jual untuk produk ini habis.',
          icon: 'warning'
        });
        return;
      }
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const increaseQuantity = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const readyStock = readyStockData[productId] || 0;
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
      if (existingItem.quantity >= readyStock) {
        Swal.fire({
          title: 'Stok Tidak Cukup',
          text: `Maksimal quantity: ${readyStock}`,
          icon: 'warning'
        });
        return;
      }
      
      const newQuantity = existingItem.quantity + 1;
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    }
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const readyStock = readyStockData[productId] || 0;
    if (newQuantity > readyStock) {
      Swal.fire({
        title: 'Stok Tidak Cukup',
        text: `Maksimal quantity: ${readyStock}`,
        icon: 'warning'
      });
      return;
    }
    
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    ));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.total, 0);
  };

  const handleAddToCart = (product) => {
    if (product.useBarcode !== false) {
      // Product uses barcode - require scanning
      setScanningMode('add');
      setScanningProductId(product.id);
      setShowScanner(true);
    } else {
      // Product doesn't use barcode - direct add
      addToCart(product);
    }
  };

  const handleIncreaseQuantity = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product && product.useBarcode !== false) {
      // Product uses barcode - require scanning
      setScanningMode('increase');
      setScanningProductId(productId);
      setShowScanner(true);
    } else {
      // Product doesn't use barcode - direct increase
      increaseQuantity(productId);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      await Swal.fire({
        title: 'Keranjang Kosong',
        text: 'Tambahkan produk ke keranjang terlebih dahulu.',
        icon: 'warning'
      });
      return;
    }

    try {
      const saleData = {
        items: cart,
        totalAmount: getTotalAmount(),
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        paymentMethod: paymentMethod
      };

      const sale = await salesService.createSale(saleData);
      setLastSale(sale);
      setShowReceipt(true);
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      setPaymentMethod('cash');
      
      // Reload products to update stock
      loadProducts();
    } catch (error) {
      console.error('Error creating sale:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Gagal melakukan penjualan.',
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
    
    // Apply search filter
    const matchesSearch = inName || inCategory;
    
    // Apply barcode filter
    let matchesBarcodeFilter = true;
    if (barcodeFilter === 'barcode') {
      matchesBarcodeFilter = product.useBarcode !== false;
    } else if (barcodeFilter === 'manual') {
      matchesBarcodeFilter = product.useBarcode === false;
    }
    
    return matchesSearch && matchesBarcodeFilter;
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
      {/* <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>
          Penjualan
        </h1>
        <button
          onClick={() => setShowScanner(true)}
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
            fontWeight: '500'
          }}
        >
          <Camera size={20} />
          Scan Barcode
        </button>
      </div> */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '2fr 1fr',
        gap: '1rem'
      }}>
        {/* Products List */}
        <div>
          <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
                Daftar Produk
              </h2>
              <button
                onClick={() => setShowScanner(true)}
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
                  fontWeight: '500'
                }}
              >
                <Camera size={20} />
                Scan Barcode
              </button>
            </div>
            {/* Search Bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
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
              
              {/* Barcode Filter */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setBarcodeFilter('all')}
                  style={{
                    backgroundColor: barcodeFilter === 'all' ? '#3b82f6' : '#f3f4f6',
                    color: barcodeFilter === 'all' ? 'white' : '#374151',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  Semua
                </button>
                <button
                  onClick={() => setBarcodeFilter('barcode')}
                  style={{
                    backgroundColor: barcodeFilter === 'barcode' ? '#3b82f6' : '#f3f4f6',
                    color: barcodeFilter === 'barcode' ? 'white' : '#374151',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  Dengan Barcode
                </button>
                <button
                  onClick={() => setBarcodeFilter('manual')}
                  style={{
                    backgroundColor: barcodeFilter === 'manual' ? '#3b82f6' : '#f3f4f6',
                    color: barcodeFilter === 'manual' ? 'white' : '#374151',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              maxHeight: window.innerWidth <= 768 ? '20rem' : '24rem',
              overflowY: 'auto'
            }}>
              {filteredProducts.map((product) => (
                <div key={product.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  transition: 'box-shadow 0.2s'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <h3 style={{ fontWeight: '500', color: '#111827', margin: 0, fontSize: '0.875rem' }}>
                      {product.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {product.category}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                      Barcode: {product.useBarcode !== false ? 'Per unit' : (product.barcode || '-')}
                    </p>
                    <span style={{
                      fontSize: '0.625rem',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '0.25rem',
                      backgroundColor: product.useBarcode !== false ? '#dbeafe' : '#f3f4f6',
                      color: product.useBarcode !== false ? '#1e40af' : '#6b7280',
                      fontWeight: '500'
                    }}>
                      {product.useBarcode !== false ? 'Dengan Barcode' : 'Manual'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '0.875rem' }}>
                      Rp {product.price.toLocaleString('id-ID')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        color: (readyStockData[product.id] || 0) > 0 ? '#059669' : '#dc2626'
                      }}>
                        Ready: {readyStockData[product.id] || 0}
                      </span>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={(readyStockData[product.id] || 0) <= 0}
                        style={{
                          backgroundColor: (readyStockData[product.id] || 0) <= 0 ? '#d1d5db' : '#3b82f6',
                          color: 'white',
                          padding: '0.25rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          cursor: (readyStockData[product.id] || 0) <= 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                        title={(readyStockData[product.id] || 0) <= 0 ? 'Stok habis' : (product.useBarcode !== false ? 'Scan barcode untuk menambah' : 'Tambah ke keranjang')}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shopping Cart */}
        <div>
          <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '1rem',
              margin: 0,
              display: 'flex',
              alignItems: 'center'
            }}>
              <ShoppingCart size={20} style={{ marginRight: '0.5rem' }} />
              Keranjang
            </h2>

            {/* Cart Items */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1rem',
              maxHeight: '16rem',
              overflowY: 'auto'
            }}>
              {cart.map((item) => (
                <div key={item.productId} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '0.75rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <h4 style={{ fontWeight: '500', fontSize: '0.75rem', color: '#111827', margin: 0 }}>
                      {item.productName}
                    </h4>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      style={{
                        color: '#dc2626',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        style={{
                          backgroundColor: '#e5e7eb',
                          color: '#374151',
                          padding: '0.25rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                        aria-label="Kurangi qty (akan menghapus item)"
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleIncreaseQuantity(item.productId)}
                        disabled={item.quantity >= (readyStockData[item.productId] || 0)}
                        style={{
                          backgroundColor: item.quantity >= (readyStockData[item.productId] || 0) ? '#e5e7eb' : '#3b82f6',
                          color: item.quantity >= (readyStockData[item.productId] || 0) ? '#9ca3af' : 'white',
                          padding: '0.25rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          cursor: item.quantity >= (readyStockData[item.productId] || 0) ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                        title={item.quantity >= (readyStockData[item.productId] || 0) ? 'Stok tidak cukup' : 'Tambah quantity'}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                      Rp {item.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">
                  Nama
                </label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
              <div>
                <label className="form-label">
                  No. HP
                </label>
                <input
                  type="text"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  className="form-input"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
              <div>
                <label className="form-label">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '0.75rem' }}
                >
                  <option value="cash">Tunai</option>
                  <option value="qris">QRIS</option>
                  <option value="card">Kartu</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>

            {/* Total */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>Total</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#2563eb' }}>
                  Rp {getTotalAmount().toLocaleString('id-ID')}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                style={{
                  width: '100%',
                  backgroundColor: cart.length === 0 ? '#d1d5db' : '#10b981',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                {/* <Receipt size={20} /> */}
               Checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => { 
          setShowScanner(false); 
          setScanningMode(null); 
          setScanningProductId(null); 
        }}
      />

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', margin: 0 }}>
              Struk Penjualan
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>No. Transaksi:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {lastSale.id}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tanggal:</span>
                <span>{new Date(lastSale.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pelanggan:</span>
                <span>{lastSale.customerName || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pembayaran:</span>
                <span style={{ textTransform: 'capitalize' }}>{lastSale.paymentMethod}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: '500', marginBottom: '0.5rem', margin: 0 }}>Item:</h4>
              {lastSale.items.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span>{item.productName} x{item.quantity}</span>
                  <span>Rp {item.total.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                <span>Total:</span>
                <span>Rp {lastSale.totalAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <button
              onClick={() => setShowReceipt(false)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesModule;