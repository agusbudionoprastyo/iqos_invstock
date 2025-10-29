import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, ScanBarcodeIcon, Search, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { productService, salesService } from '../services/database';
import BarcodeScanner from './BarcodeScanner';
import QRISPaymentModal from './QRISPaymentModal';
import { showToast } from '../utils/toast.jsx';

const SalesModule = () => {
  const [products, setProducts] = useState([]);
  const [readyStockData, setReadyStockData] = useState({});
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningMode, setScanningMode] = useState(null); // 'add' | 'increase' | null
  const [scanningProductId, setScanningProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | category name
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = window.innerWidth <= 768 ? 2 : 999; // 2 items for mobile, unlimited for desktop
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showCartPage, setShowCartPage] = useState(false);
  const [flyingItems, setFlyingItems] = useState([]);
  const [showQRISPayment, setShowQRISPayment] = useState(false);
  const [qrisPaymentData, setQrisPaymentData] = useState(null);
  const [scannedItems, setScannedItems] = useState(new Set()); // Track scanned items

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Use super-optimized function that gets everything in 2 Firebase calls
      const productsWithStockData = await productService.getAllProductsWithStockData();
      
      // Extract ready stock data
      const readyStocks = {};
      productsWithStockData.forEach(p => {
        readyStocks[p.id] = p.readyStock;
      });
      
      setReadyStockData(readyStocks);
      
      // Only show products with ready stock > 0
      const availableProducts = productsWithStockData.filter(product => product.readyStock > 0);
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
        } else if (scanningMode === 'validate') {
          // Mode validate barcode for checkout
          validateBarcodeForCheckout(product, barcode);
        } else {
          // Default mode - add to cart
          addToCart(product);
        }
      } else {
        showToast.warning('Barcode tidak terdaftar dalam sistem.', 'Produk Tidak Ditemukan');
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      showToast.error('Gagal memindai barcode.', 'Error!');
    }
    setShowScanner(false);
    setScanningMode(null);
    setScanningProductId(null);
  };

  const createFlyingAnimation = (startElement, endElement) => {
    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    
    const flyingItem = {
      id: Date.now() + Math.random(),
      startX: startRect.left + startRect.width / 2,
      startY: startRect.top + startRect.height / 2,
      endX: endRect.left + endRect.width / 2,
      endY: endRect.top + endRect.height / 2,
    };
    
    setFlyingItems(prev => [...prev, flyingItem]);
    
    // Remove the flying item after animation completes
    setTimeout(() => {
      setFlyingItems(prev => prev.filter(item => item.id !== flyingItem.id));
    }, 800);
  };

  const handleAddToCart = (product, event) => {
    // All products can be added directly to cart
    addToCart(product, event?.currentTarget);
  };

  const addToCart = (product, buttonElement = null) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    // Trigger flying animation first if button element is provided
    if (buttonElement) {
      const cartButton = document.querySelector('[data-cart-button]');
      if (cartButton) {
        createFlyingAnimation(buttonElement, cartButton);
        
        // Delay cart update until animation completes
        setTimeout(() => {
          if (existingItem) {
            // If product already in cart, increase quantity
            increaseQuantity(product.id);
          } else {
            const readyStock = readyStockData[product.id] || 0;
            if (readyStock <= 0) {
              showToast.warning('Stok siap jual untuk produk ini habis.', 'Stok Habis');
              return;
            }
            setCart(prevCart => [...prevCart, {
              productId: product.id,
              productName: product.name,
              quantity: 1,
              price: product.price,
              total: product.price
            }]);
          }
        }, 400); // Half of animation duration for smoother effect
        return;
      }
    }
    
    // If no animation, update cart immediately
    if (existingItem) {
      // If product already in cart, increase quantity
      increaseQuantity(product.id);
    } else {
      const readyStock = readyStockData[product.id] || 0;
      if (readyStock <= 0) {
        showToast.warning('Stok siap jual untuk produk ini habis.', 'Stok Habis');
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
    // Remove scanned items for this product
    setScannedItems(prev => {
      const newSet = new Set(prev);
      Array.from(newSet).forEach(key => {
        if (key.startsWith(`${productId}-`)) {
          newSet.delete(key);
        }
      });
      return newSet;
    });
  };

  const increaseQuantity = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const readyStock = readyStockData[productId] || 0;
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
      if (existingItem.quantity >= readyStock) {
        showToast.warning(`Maksimal quantity: ${readyStock}`, 'Stok Tidak Cukup');
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
      showToast.warning(`Maksimal quantity: ${readyStock}`, 'Stok Tidak Cukup');
      return;
    }
    
    const currentItem = cart.find(item => item.productId === productId);
    if (currentItem && newQuantity < currentItem.quantity) {
      // Quantity decreased, remove excess scanned items
      const scannedCount = Array.from(scannedItems).filter(scannedKey => 
        scannedKey.startsWith(`${productId}-`)
      ).length;
      
      if (scannedCount > newQuantity) {
        // Remove excess scanned items
        const itemsToRemove = scannedCount - newQuantity;
        let removedCount = 0;
        setScannedItems(prev => {
          const newSet = new Set(prev);
          Array.from(newSet).forEach(key => {
            if (key.startsWith(`${productId}-`) && removedCount < itemsToRemove) {
              newSet.delete(key);
              removedCount++;
            }
          });
          return newSet;
        });
      }
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

  const handleIncreaseQuantity = (productId) => {
    // All products can increase quantity directly
    increaseQuantity(productId);
  };

  // Validate barcode for checkout
  const validateBarcodeForCheckout = (product, barcode) => {
    const cartItem = cart.find(item => item.productId === product.id);
    if (cartItem) {
      // Count how many times this product has been scanned
      const scannedCount = Array.from(scannedItems).filter(scannedKey => 
        scannedKey.startsWith(`${product.id}-`)
      ).length;
      
      // If we haven't scanned enough barcodes for the quantity, add this scan
      if (scannedCount < cartItem.quantity) {
        setScannedItems(prev => new Set([...prev, `${product.id}-${barcode}-${Date.now()}`]));
        showToast.success(`Barcode ${product.name} berhasil divalidasi! (${scannedCount + 1}/${cartItem.quantity})`, 'Validasi Berhasil');
      } else {
        showToast.warning(`Semua barcode untuk ${product.name} sudah divalidasi!`, 'Sudah Valid');
      }
    } else {
      showToast.warning('Produk tidak ditemukan di keranjang.', 'Error Validasi');
    }
  };

  // Check if all barcode items are scanned
  const getUnscannedBarcodeItems = () => {
    return cart.filter(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product || product.useBarcode === false) return false;
      
      // Count how many times this product has been scanned
      const scannedCount = Array.from(scannedItems).filter(scannedKey => 
        scannedKey.startsWith(`${item.productId}-`)
      ).length;
      
      // Return true if not enough scans for the quantity
      return scannedCount < item.quantity;
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast.warning('Tambahkan produk ke keranjang terlebih dahulu.', 'Keranjang Kosong');
      return;
    }

    // Check if there are unscanned barcode items
    const unscannedItems = getUnscannedBarcodeItems();
    if (unscannedItems.length > 0) {
      const unscannedNames = unscannedItems.map(item => item.productName).join(', ');
      showToast.warning(
        `Silakan scan barcode untuk produk: ${unscannedNames}`, 
        'Validasi Barcode Diperlukan'
      );
      
      // Show scanner for validation
      setScanningMode('validate');
      setShowScanner(true);
      return;
    }

    if (paymentMethod === 'qris') {
      // Show QRIS payment modal
      setQrisPaymentData({
        items: cart,
        totalAmount: getTotalAmount(),
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone
      });
      setShowQRISPayment(true);
      return;
    }

    // Handle cash payment
    try {
      const saleData = {
        items: cart,
        totalAmount: getTotalAmount(),
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        paymentMethod: paymentMethod,
        scannedBarcodes: Array.from(scannedItems)
      };

      const sale = await salesService.createSale(saleData);
      setLastSale(sale);
      setShowReceipt(true);
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      setPaymentMethod('qris');
      setScannedItems(new Set());
      
      // Reload products to update stock
      loadProducts();
    } catch (error) {
      console.error('Error creating sale:', error);
      showToast.error('Gagal melakukan penjualan.', 'Error!');
    }
  };

  // Handle QRIS payment success
  const handleQRISPaymentSuccess = async (paymentResult) => {
    try {
      const saleData = {
        items: qrisPaymentData.items,
        totalAmount: qrisPaymentData.totalAmount,
        customerName: qrisPaymentData.customerName,
        customerPhone: qrisPaymentData.customerPhone,
        paymentMethod: 'qris',
        qrisData: {
          referenceNo: paymentResult.referenceNo,
          approvalCode: paymentResult.approvalCode,
          paidTime: paymentResult.paidTime,
          customerName: paymentResult.customerName,
          issuerName: paymentResult.issuerName
        },
        scannedBarcodes: Array.from(scannedItems)
      };

      const sale = await salesService.createSale(saleData);
      setLastSale(sale);
      setShowReceipt(true);
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      setPaymentMethod('qris');
      setScannedItems(new Set());
      setShowQRISPayment(false);
      setQrisPaymentData(null);
      
      // Reload products to update stock
      loadProducts();
      
      showToast.success('Pembayaran QRIS berhasil!', 'Berhasil');
    } catch (error) {
      console.error('Error creating sale after QRIS payment:', error);
      showToast.error('Gagal menyimpan data penjualan.', 'Error!');
    }
  };

  // Get unique categories
  const uniqueCategories = [...new Set(products.map(product => product.category).filter(Boolean))];

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
    
    // Apply category filter
    let matchesCategoryFilter = true;
    if (categoryFilter !== 'all') {
      matchesCategoryFilter = product.category === categoryFilter;
    }
    
    return matchesSearch && matchesCategoryFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when search term or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

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
      {!showCartPage ? (
        <div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '2fr 1fr',
            gap: '1rem'
          }}>
            {/* Products List */}
            <div>
              <div style={{
                background: 'var(--card-background)',
                borderRadius: '1.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                padding: '1.5rem'
              }}>
                {/* Mobile Cart Button */}
                {window.innerWidth <= 768 && (
                  <div style={{
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <button
                        onClick={() => setShowScanner(true)}
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
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          flex: 1
                        }}
                      >
                        <ScanBarcodeIcon size={20} />
                        Scan Barcode
                      </button>
                      <button
                        onClick={() => setShowCartPage(true)}
                        style={{
                          backgroundColor: 'var(--card-background)',
                          color: 'var(--text-color)',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          fontSize: '1.25rem',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          fontWeight: '500',
                          position: 'relative',
                          flex: 1
                        }}
                        data-cart-button
                      >
                        <div style={{ position: 'relative' }}>
                          <ShoppingCart size={24} />
                        {cart.length > 0 && (
                          <span style={{
                            position: 'absolute',
                              top: '-10px',
                              right: '-10px',
                              backgroundColor: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              border: '1px solid var(--card-background)',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                          }}>
                            {cart.reduce((total, item) => total + item.quantity, 0)}
                          </span>
                        )}
                        </div>
                      </button>
                    </div>
                  </div>
                )}
            {/* Search Bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                {/* Scan QR Button - Desktop Only */}
                {window.innerWidth > 768 && (
                  <button
                    onClick={() => setShowScanner(true)}
                    style={{
                      position: 'absolute',
                      left: '0.25rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor: 'var(--card-background)',
                      color: 'var(--text-color)',
                      borderRadius: '0',
                      borderLeft: 'none',
                      borderTop: 'none',
                      borderBottom: 'none',
                      borderRight: '1px solid var(--border-color)',
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1
                    }}
                    title="Scan Barcode"
                  >
                    <ScanBarcodeIcon size={20} /> <span style={{ fontSize: '0.875rem', fontWeight: '500', marginLeft: '0.5rem' }}>Scan Barcode</span>
                  </button>
                )}
                <Search size={20} style={{
                  position: 'absolute',
                  left: window.innerWidth > 768 ? '11rem' : '0.75rem',
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
                    paddingLeft: window.innerWidth > 768 ? '12.5rem' : '2.5rem',
                    paddingRight: '1rem',
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'var(--card-background)',
                    color: 'var(--text-color)'
                  }}
                />
              </div>
              
              {/* Category Filter */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setCategoryFilter('all')}
                  style={{
                    backgroundColor: categoryFilter === 'all' ? 'var(--primary-color)' : 'var(--background-color)',
                    color: categoryFilter === 'all' ? 'white' : 'var(--text-color)',
                    padding: '0.75rem 1rem',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}
                >
                  Semua Kategori
                </button>
                {uniqueCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    style={{
                      backgroundColor: categoryFilter === category ? 'var(--primary-color)' : 'var(--background-color)',
                      color: categoryFilter === category ? 'white' : 'var(--text-color)',
                      padding: '0.75rem 1rem',
                      borderRadius: '9999px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '500'
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              maxHeight: window.innerWidth <= 768 ? '30rem' : '35rem',
              overflowY: 'auto'
            }}>
              {paginatedProducts.map((product) => (
                <div 
                  key={product.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    transition: 'box-shadow 0.2s',
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <h3 style={{ fontWeight: '500', color: 'var(--text-color)', margin: 0, fontSize: '0.875rem'}}>
                      {product.name} 
                    </h3>
                    <span style={{
                        fontSize: '0.75rem',
                        color: (readyStockData[product.id] || 0) > 0 ? 'var(--secondary-color)' : 'var(--error-color)'
                      }}>
                        Stock : {readyStockData[product.id] || 0}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary-color)', gap: '0.5rem'}}>
                        {product.category}
                  </span> 
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: '600', color: 'var(--primary-color)', fontSize: '0.875rem' }}>
                      Rp {product.price.toLocaleString('id-ID')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        onClick={(e) => handleAddToCart(product, e)}
                        disabled={(readyStockData[product.id] || 0) <= 0}
                        style={{
                          backgroundColor: (readyStockData[product.id] || 0) <= 0 ? 'var(--border-color)' : 'var(--card-color)',
                          color: 'var(--text-color)',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          cursor: (readyStockData[product.id] || 0) <= 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.2rem'
                        }}
                        title={(readyStockData[product.id] || 0) <= 0 ? 'Stok habis' : 'Tambah ke keranjang'}
                      >
                        <Plus size={10} />
                        <ShoppingCart size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls - Mobile Only */}
            {window.innerWidth <= 768 && totalPages > 1 && (
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
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentPage === 1 ? 'var(--background-color)' : 'var(--card-background)',
                    color: currentPage === 1 ? 'var(--secondary-color)' : 'var(--text-color)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '500',
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
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    backgroundColor: currentPage === totalPages ? 'var(--background-color)' : 'var(--card-background)',
                    color: currentPage === totalPages ? 'var(--secondary-color)' : 'var(--text-color)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

            {/* Shopping Cart - Desktop Only */}
            {window.innerWidth > 768 && (
              <div>
                <div style={{
                  background: 'var(--card-background)',
                  borderRadius: '1.5rem',
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
              {cart.map((item) => {
                const product = products.find(p => p.id === item.productId);
                const needsBarcode = product && product.useBarcode !== false;
                const scannedCount = needsBarcode ? Array.from(scannedItems).filter(scannedKey => 
                  scannedKey.startsWith(`${item.productId}-`)
                ).length : item.quantity;
                const isFullyScanned = scannedCount >= item.quantity;
                
                return (
                  <div key={item.productId} style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    backgroundColor: needsBarcode && !isFullyScanned ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: '500', fontSize: '0.75rem', color: 'var(--text-color)', margin: 0 }}>
                          {item.productName}
                        </h4>
                        {needsBarcode && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                            {isFullyScanned ? (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: 'var(--success-color)', 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                ✓ Barcode sudah di-scan ({scannedCount}/{item.quantity})
                              </span>
                            ) : (
                              <span style={{ 
                                fontSize: '0.65rem', 
                                color: 'var(--error-color)', 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                ⚠ Perlu scan barcode ({scannedCount}/{item.quantity})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        style={{
                          color: 'var(--error-color)',
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
                          backgroundColor: 'var(--border-color)',
                          color: 'var(--text-color)',
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
                          backgroundColor: item.quantity >= (readyStockData[item.productId] || 0) ? 'var(--border-color)' : 'var(--primary-color)',
                          color: item.quantity >= (readyStockData[item.productId] || 0) ? 'var(--secondary-color)' : 'white',
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
                );
              })}
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
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: paymentMethod === 'qris' ? 'var(--primary-color)' : 'var(--border-color)',
                      backgroundColor: paymentMethod === 'qris' ? 'rgba(229, 37, 53, 0.1)' : 'transparent',
                      color: paymentMethod === 'qris' ? 'var(--primary-color)' : 'var(--text-color)',
                      fontWeight: paymentMethod === 'qris' ? '600' : '500',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: paymentMethod === 'cash' ? 'var(--primary-color)' : 'var(--border-color)',
                      backgroundColor: paymentMethod === 'cash' ? 'rgba(229, 37, 53, 0.1)' : 'transparent',
                      color: paymentMethod === 'cash' ? 'var(--primary-color)' : 'var(--text-color)',
                      fontWeight: paymentMethod === 'cash' ? '600' : '500',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Tunai
                  </button>
                </div>
              </div>
            </div>

            {/* Total */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>Total</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                  Rp {getTotalAmount().toLocaleString('id-ID')}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                style={{
                  width: '100%',
                  backgroundColor: cart.length === 0 ? 'var(--border-color)' : 'var(--primary-color)',
                  color: 'white',
                  padding: '1rem 1rem',
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
                title={cart.length === 0 ? 'Keranjang kosong' : 
                  getUnscannedBarcodeItems().length > 0 ? 
                    'Scan semua barcode terlebih dahulu' : 
                    'Lanjutkan ke pembayaran'}
              >
                {getUnscannedBarcodeItems().length > 0 ? 
                
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ScanBarcodeIcon size={20} />
                    <span>Scan Barcode {getUnscannedBarcodeItems().length} items</span>
                  </div> : 
                  'Checkout'
                }
              </button>
            </div>  
          </div>
        </div>
      )}
          </div>
        </div>
      ) : (
        /* Cart Page for Mobile */
        <div 
          data-cart-container
          style={{
            background: 'var(--card-background)',
            borderRadius: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1rem',
            animation: 'slideInFromRight 0.3s ease-out'
          }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              margin: 0,
              display: 'flex',
              alignItems: 'center'
            }}>
              <ShoppingCart size={20} style={{ marginRight: '0.5rem' }} />
              Keranjang
            </h2>
            <button
              onClick={() => {
                const cartElement = document.querySelector('[data-cart-container]');
                if (cartElement) {
                  cartElement.style.animation = 'slideOutToRight 0.3s ease-in';
                  setTimeout(() => setShowCartPage(false), 300);
                } else {
                  setShowCartPage(false);
                }
              }}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--secondary-color)',
                padding: '0.5rem',
                borderRadius: '1rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cart Items */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginBottom: '1rem',
            maxHeight: '20rem',
            overflowY: 'auto'
          }}>
            {cart.map((item) => {
              const product = products.find(p => p.id === item.productId);
              const needsBarcode = product && product.useBarcode !== false;
              const scannedCount = needsBarcode ? Array.from(scannedItems).filter(scannedKey => 
                scannedKey.startsWith(`${item.productId}-`)
              ).length : item.quantity;
              const isFullyScanned = scannedCount >= item.quantity;
              
              return (
                <div key={item.productId} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: needsBarcode && !isFullyScanned ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: '500', fontSize: '0.75rem', color: 'var(--text-color)', margin: 0 }}>
                      {item.productName}
                    </h4>
                    {needsBarcode && (
                      <div style={{ marginTop: '0.25rem' }}>
                        {isFullyScanned ? (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            color: 'var(--success-color)', 
                            fontWeight: '500'
                          }}>
                            ✓ Barcode sudah di-scan ({scannedCount}/{item.quantity})
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            color: 'var(--error-color)', 
                            fontWeight: '500'
                          }}>
                            ⚠ Perlu scan barcode ({scannedCount}/{item.quantity})
                          </span>
                        )}
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary-color)' }}>
                      Rp {item.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {item.quantity === 1 ? (
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--error-color)',
                        padding: '0.25rem',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Hapus item"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        color: 'var(--text-color)',
                        padding: '0.25rem',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        transition: 'all 0.2s ease'
                      }}
                      aria-label="Kurangi qty"
                    >
                      <Minus size={12} />
                    </button>
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleIncreaseQuantity(item.productId)}
                    disabled={item.quantity >= (readyStockData[item.productId] || 0)}
                    style={{
                      backgroundColor: item.quantity >= (readyStockData[item.productId] || 0) ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.05)',
                      color: item.quantity >= (readyStockData[item.productId] || 0) ? 'var(--secondary-color)' : 'var(--text-color)',
                      padding: '0.25rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      cursor: item.quantity >= (readyStockData[item.productId] || 0) ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      transition: 'all 0.2s ease'
                    }}
                    title={item.quantity >= (readyStockData[item.productId] || 0) ? 'Stok tidak cukup' : 'Tambah quantity'}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          {/* Scan Barcode Button for Validation - Mobile */}
          {cart.some(item => {
            const product = products.find(p => p.id === item.productId);
            return product && product.useBarcode !== false;
          }) && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() => {
                  setScanningMode('validate');
                  setShowScanner(true);
                }}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--warning-color)',
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
                  fontWeight: '500'
                }}
              >
                <ScanBarcodeIcon size={20} />
                Scan Barcode untuk Validasi
              </button>
            </div>
          )}

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
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('qris')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: paymentMethod === 'qris' ? 'var(--primary-color)' : 'var(--border-color)',
                    backgroundColor: paymentMethod === 'qris' ? 'rgba(229, 37, 53, 0.1)' : 'transparent',
                    color: paymentMethod === 'qris' ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: paymentMethod === 'qris' ? '600' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  QRIS
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: paymentMethod === 'cash' ? 'var(--primary-color)' : 'var(--border-color)',
                    backgroundColor: paymentMethod === 'cash' ? 'rgba(229, 37, 53, 0.1)' : 'transparent',
                    color: paymentMethod === 'cash' ? 'var(--primary-color)' : 'var(--text-color)',
                    fontWeight: paymentMethod === 'cash' ? '600' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Tunai
                </button>
              </div>
            </div>
          </div>

          {/* Total */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>Total</span>
              <span style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                Rp {getTotalAmount().toLocaleString('id-ID')}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              style={{
                width: '100%',
                backgroundColor: cart.length === 0 ? 'var(--secondary-color)' : 'var(--primary-color)',
                color: 'white',
                padding: '0.75rem 1rem',
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
              title={cart.length === 0 ? 'Keranjang kosong' : 
                getUnscannedBarcodeItems().length > 0 ? 
                  'Scan semua barcode terlebih dahulu' : 
                  'Lanjutkan ke pembayaran'}
            >
              {getUnscannedBarcodeItems().length > 0 ? 
                `Scan Barcode (${getUnscannedBarcodeItems().length} item)` : 
                'Checkout'
              }
            </button>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => { 
          setShowScanner(false); 
          setScanningMode(null); 
          setScanningProductId(null); 
        }}
        title={scanningMode === 'validate' ? 'Scan Barcode untuk Validasi' : 
               scanningMode === 'add' ? 'Scan Barcode untuk Menambah' :
               scanningMode === 'increase' ? 'Scan Barcode untuk Menambah Quantity' :
               'Scan Barcode'}
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

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: '500', marginBottom: '0.5rem', margin: 0 }}>Item:</h4>
              {lastSale.items.map((item, index) => {
                const product = products.find(p => p.id === item.productId);
                const needsBarcode = product && product.useBarcode !== false;
                const scannedBarcodes = needsBarcode ? Array.from(scannedItems).filter(scannedKey => 
                  scannedKey.startsWith(`${item.productId}-`)
                ) : [];
                
                return (
                  <div key={index} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span>{item.productName} x{item.quantity}</span>
                      <span>Rp {item.total.toLocaleString('id-ID')}</span>
                    </div>
                    {needsBarcode && scannedBarcodes.length > 0 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--secondary-color)', marginTop: '0.25rem' }}>
                        Barcode: {scannedBarcodes.map(key => key.split('-')[1]).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginBottom: '1rem' }}>
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
      
      {/* Flying Animation Elements */}
      {flyingItems.map((item) => (
        <div
          key={item.id}
          style={{
            position: 'fixed',
            left: item.startX - 6,
            top: item.startY - 6,
            width: '8px',
            height: '8px',
            backgroundColor: 'var(--primary-color)',
            borderRadius: '50%',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: `flyToCart 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            '--end-x': `${item.endX - item.startX}px`,
            '--end-y': `${item.endY - item.startY}px`
          }}
        />
      ))}
      
      <style jsx>{`
        @keyframes flyToCart {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(calc(var(--end-x) * 0.5), calc(var(--end-y) * 0.5)) scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(0.5);
            opacity: 0;
          }
        }
        
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutToRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        @keyframes slideInFromBottom {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutToBottom {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(30px);
            opacity: 0;
          }
        }
      `}</style>

      {/* QRIS Payment Modal */}
      {showQRISPayment && qrisPaymentData && (
        <QRISPaymentModal
          isOpen={showQRISPayment}
          onClose={() => {
            setShowQRISPayment(false);
            setQrisPaymentData(null);
          }}
          paymentData={qrisPaymentData}
          onPaymentSuccess={handleQRISPaymentSuccess}
        />
      )}
    </div>
  );
};

export default SalesModule;