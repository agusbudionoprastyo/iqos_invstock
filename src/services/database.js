import { ref, set, get, push, update, remove, onValue, off } from 'firebase/database';
import { database } from '../firebase/config';

// Helper function to generate sequential numeric ID
const generateNumericId = async (collectionName) => {
  try {
    const counterRef = ref(database, `counters/${collectionName}`);
    const snapshot = await get(counterRef);
    
    let currentCount = 0;
    if (snapshot.exists()) {
      currentCount = snapshot.val() || 0;
    }
    
    const newId = currentCount + 1;
    await set(counterRef, newId);
    
    return newId.toString().padStart(6, '0'); // Format: 000001, 000002, etc.
  } catch (error) {
    throw new Error(`Error generating numeric ID: ${error.message}`);
  }
};

// Database schema structure:
/*
{
  products: {
    [productId]: {
      id: string,
      name: string,
      category: string,
      barcode: string,
      price: number,
      cost: number,
      stock: number,
      minStock: number,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  },
  sales: {
    [saleId]: {
      id: string,
      items: [
        {
          productId: string,
          productName: string,
          quantity: number,
          price: number,
          total: number
        }
      ],
      totalAmount: number,
      customerName: string,
      customerPhone: string,
      paymentMethod: string,
      createdAt: timestamp,
      status: 'completed' | 'pending' | 'cancelled'
    }
  },
  procurements: {
    [procurementId]: {
      id: string,
      supplierName: string,
      supplierContact: string,
      items: [
        {
          productId: string,
          productName: string,
          quantity: number,
          cost: number,
          total: number
        }
      ],
      totalAmount: number,
      status: 'pending' | 'received' | 'cancelled',
      createdAt: timestamp,
      receivedAt: timestamp
    }
  },
  stockMovements: {
    [movementId]: {
      id: string,
      productId: string,
      productName: string,
      type: 'in' | 'out',
      quantity: number,
      reason: string,
      referenceId: string, // saleId or procurementId
      createdAt: timestamp
    }
  }
}
*/

// Products CRUD operations
export const productService = {
  // Create product
  createProduct: async (productData) => {
    try {
      const productRef = ref(database, 'products');
      const newProductRef = push(productRef);
      
      const useBarcode = productData.useBarcode !== false; // Default to true if not specified
      
      const product = {
        id: newProductRef.key,
        ...productData,
        stock: useBarcode ? 0 : productData.stock, // Use manual stock if barcode disabled, otherwise start with 0
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await set(newProductRef, product);

      // Initialize productUnits collection only if using barcode
      if (useBarcode) {
        // Create empty productUnits collection - units will be added when barcodes are assigned
        const unitsBaseRef = ref(database, `productUnits/${newProductRef.key}`);
        await set(unitsBaseRef, {});
      }
      return product;
    } catch (error) {
      throw new Error(`Error creating product: ${error.message}`);
    }
  },

  // Bulk get units count with barcode for multiple products (optimized)
  getBulkUnitsWithBarcodeCount: async (productIds) => {
    try {
      const results = {};
      
      // Get all productUnits data in one call
      const unitsRef = ref(database, 'productUnits');
      const snapshot = await get(unitsRef);
      
      if (snapshot.exists()) {
        const allUnits = snapshot.val();
        
        // Process each product
        for (const productId of productIds) {
          const productUnits = allUnits[productId];
          if (productUnits) {
            const units = Object.values(productUnits);
            results[productId] = units.filter(unit => unit.barcode).length;
          } else {
            results[productId] = 0;
          }
        }
      } else {
        // No units data, return 0 for all products
        for (const productId of productIds) {
          results[productId] = 0;
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Error getting bulk units count: ${error.message}`);
    }
  },

  // Bulk get ready stock for multiple products (optimized)
  getBulkReadyStock: async (products) => {
    try {
      const results = {};
      
      // Get all productUnits data in one call
      const unitsRef = ref(database, 'productUnits');
      const snapshot = await get(unitsRef);
      
      if (snapshot.exists()) {
        const allUnits = snapshot.val();
        
        // Process each product
        for (const product of products) {
          if (product.useBarcode === false) {
            // If product doesn't use barcode, ready stock = total stock
            results[product.id] = product.stock || 0;
          } else {
            // If product uses barcode, count units with barcode and in_stock status
            const productUnits = allUnits[product.id];
            if (productUnits) {
              const units = Object.values(productUnits);
              results[product.id] = units.filter(unit => unit.barcode && unit.status === 'in_stock').length;
            } else {
              results[product.id] = 0;
            }
          }
        }
      } else {
        // No units data, return stock for non-barcode products, 0 for barcode products
        for (const product of products) {
          if (product.useBarcode === false) {
            results[product.id] = product.stock || 0;
          } else {
            results[product.id] = 0;
          }
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Error getting bulk ready stock: ${error.message}`);
    }
  },

  // Update product stock to match actual units count
  updateProductStockFromUnits: async (productId) => {
    try {
      const unitsRef = ref(database, `productUnits/${productId}`);
      const snapshot = await get(unitsRef);
      let totalUnits = 0;
      
      if (snapshot.exists()) {
        const units = Object.values(snapshot.val());
        totalUnits = units.filter(unit => unit && unit.status === 'in_stock').length;
      }

      // Update product stock to match units count
      const productRef = ref(database, `products/${productId}`);
      await update(productRef, { 
        stock: totalUnits, 
        updatedAt: Date.now() 
      });
      
      return totalUnits;
    } catch (error) {
      throw new Error(`Error updating product stock: ${error.message}`);
    }
  },

  // Get all products with bulk ready stock data (super optimized)
  getAllProductsWithStockData: async () => {
    try {
      // Get products and productUnits in parallel
      const [productsSnapshot, unitsSnapshot] = await Promise.all([
        get(ref(database, 'products')),
        get(ref(database, 'productUnits'))
      ]);
      
      const products = productsSnapshot.exists() ? Object.values(productsSnapshot.val()) : [];
      const allUnits = unitsSnapshot.exists() ? unitsSnapshot.val() : {};
      
      // Process products with their stock data
      const productsWithStockData = products.map(product => {
        let readyStock = 0;
        let barcodeCount = 0;
        
        if (product.useBarcode === false) {
          // Non-barcode product: ready stock = total stock
          readyStock = product.stock || 0;
          barcodeCount = 0;
        } else {
          // Barcode product: count units with barcode
          const productUnits = allUnits[product.id];
          if (productUnits) {
            const units = Object.values(productUnits);
            barcodeCount = units.filter(unit => unit.barcode).length;
            readyStock = units.filter(unit => unit.barcode && unit.status === 'in_stock').length;
          }
        }
        
        return {
          ...product,
          readyStock,
          barcodeCount
        };
      });
      
      return productsWithStockData;
    } catch (error) {
      throw new Error(`Error getting products with stock data: ${error.message}`);
    }
  },

  // Get product by ID
  getProductById: async (productId) => {
    try {
      const productRef = ref(database, `products/${productId}`);
      const snapshot = await get(productRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      throw new Error(`Error fetching product: ${error.message}`);
    }
  },

  // Get product by barcode (only checks unit-level barcodes)
  getProductByBarcode: async (barcode) => {
    try {
      const productsRef = ref(database, 'products');
      const snapshot = await get(productsRef);
      if (snapshot.exists()) {
        const products = Object.values(snapshot.val());
        // Check unit-level barcodes only
        for (const product of products) {
          const unitsRef = ref(database, `productUnits/${product.id}`);
          const unitsSnap = await get(unitsRef);
          if (unitsSnap.exists()) {
            const units = Object.values(unitsSnap.val());
            const found = units.find(u => u.barcode === barcode);
            if (found) return { ...product, matchedUnitId: found.unitId };
          }
        }
      }
      return null;
    } catch (error) {
      throw new Error(`Error fetching product by barcode: ${error.message}`);
    }
  },

  // Add a barcode to next available unit for a product (global uniqueness)
  addBarcodeToProduct: async (productId, barcode) => {
    try {
      if (!barcode) throw new Error('Barcode is required');

      // Check if product uses barcode
      const productRef = ref(database, `products/${productId}`);
      const productSnap = await get(productRef);
      if (!productSnap.exists()) {
        throw new Error('Product not found');
      }
      const product = productSnap.val();
      if (product.useBarcode === false) {
        throw new Error('Product tidak menggunakan barcode');
      }

      // Ensure barcode is not used in any unit (global uniqueness)
      const allUnitsSnap = await get(ref(database, 'productUnits'));
      if (allUnitsSnap.exists()) {
        const allProductsUnits = Object.values(allUnitsSnap.val());
        for (const unitsObj of allProductsUnits) {
          const unitsArr = Object.values(unitsObj || {});
          if (unitsArr.some(u => u && u.barcode === barcode)) {
            throw new Error('Barcode sudah dipakai unit lain');
          }
        }
      }

      // Find next available unit for this product
      const unitsRef = ref(database, `productUnits/${productId}`);
      const unitsSnap = await get(unitsRef);
      let targetUnitRef;
      if (unitsSnap.exists()) {
        const units = unitsSnap.val();
        const available = Object.values(units).find(u => u && !u.barcode && u.status === 'in_stock');
        if (available) {
          targetUnitRef = ref(database, `productUnits/${productId}/${available.unitId}`);
        }
      }

      // If no available unit, create a new unit
      if (!targetUnitRef) {
        const newUnitRef = push(unitsRef);
        await set(newUnitRef, {
          unitId: newUnitRef.key,
          productId,
          barcode: null,
          status: 'in_stock',
          createdAt: Date.now()
        });
        targetUnitRef = newUnitRef;
      }

      // Assign the barcode to the unit
      await update(targetUnitRef, { barcode, updatedAt: Date.now() });

      // Update product stock to reflect total units count
      await productService.updateProductStockFromUnits(productId);
      
      return true;
    } catch (error) {
      throw new Error(`Error adding barcode: ${error.message}`);
    }
  },

  // Update product
  updateProduct: async (productId, updateData) => {
    try {
      const productRef = ref(database, `products/${productId}`);
      const updates = {
        ...updateData,
        updatedAt: Date.now()
      };
      await update(productRef, updates);
      return true;
    } catch (error) {
      throw new Error(`Error updating product: ${error.message}`);
    }
  },

  // Delete product
  deleteProduct: async (productId) => {
    try {
      const productRef = ref(database, `products/${productId}`);
      await remove(productRef);
      return true;
    } catch (error) {
      throw new Error(`Error deleting product: ${error.message}`);
    }
  },

  // Update stock
  updateStock: async (productId, quantityChange, reason, referenceId) => {
    try {
      const productRef = ref(database, `products/${productId}`);
      const snapshot = await get(productRef);
      
      if (!snapshot.exists()) {
        throw new Error('Product not found');
      }

      const product = snapshot.val();
      const newStock = product.stock + quantityChange;
      
      if (newStock < 0) {
        throw new Error('Insufficient stock');
      }

      // Update product stock
      await update(productRef, {
        stock: newStock,
        updatedAt: Date.now()
      });

      // Create stock movement record
      const movementId = await generateNumericId('stockMovements');
      const movementRef = ref(database, `stockMovements/${movementId}`);
      const movement = {
        id: movementId,
        productId,
        productName: product.name,
        type: quantityChange > 0 ? 'in' : 'out',
        quantity: Math.abs(quantityChange),
        reason,
        referenceId,
        createdAt: Date.now()
      };
      await set(movementRef, movement);

      return true;
    } catch (error) {
      throw new Error(`Error updating stock: ${error.message}`);
    }
  },

  // Update stock and mark units as sold for barcode products
  updateStockAndMarkUnitsSold: async (productId, quantitySold, saleId) => {
    try {
      const productRef = ref(database, `products/${productId}`);
      const snapshot = await get(productRef);
      
      if (!snapshot.exists()) {
        throw new Error('Product not found');
      }

      const product = snapshot.val();
      
      if (product.useBarcode !== false) {
        // For barcode products, mark specific units as sold
        const unitsRef = ref(database, `productUnits/${productId}`);
        const unitsSnap = await get(unitsRef);
        
        if (unitsSnap.exists()) {
          const units = unitsSnap.val();
          const availableUnits = Object.values(units).filter(unit => unit.status === 'in_stock');
          
          if (availableUnits.length < quantitySold) {
            throw new Error(`Insufficient units available. Available: ${availableUnits.length}, Requested: ${quantitySold}`);
          }
          
          // Mark first N units as sold
          let soldCount = 0;
          for (const [unitId, unit] of Object.entries(units)) {
            if (unit.status === 'in_stock' && soldCount < quantitySold) {
              await update(ref(database, `productUnits/${productId}/${unitId}`), {
                status: 'sold',
                soldAt: Date.now(),
                saleId: saleId,
                updatedAt: Date.now()
              });
              soldCount++;
            }
          }
          
          // Update product stock from units
          await productService.updateProductStockFromUnits(productId);
        }
      } else {
        // For manual products, just update stock
        const newStock = product.stock - quantitySold;
        if (newStock < 0) {
          throw new Error('Insufficient stock');
        }
        
        await update(productRef, {
          stock: newStock,
          updatedAt: Date.now()
        });
      }

      // Create stock movement record
      const movementId = await generateNumericId('stockMovements');
      const movementRef = ref(database, `stockMovements/${movementId}`);
      const movement = {
        id: movementId,
        productId,
        productName: product.name,
        type: 'out',
        quantity: quantitySold,
        reason: 'sale',
        referenceId: saleId,
        createdAt: Date.now()
      };
      await set(movementRef, movement);

      return true;
    } catch (error) {
      throw new Error(`Error updating stock: ${error.message}`);
    }
  }
};

// Sales CRUD operations
export const salesService = {
  // Create sale
  createSale: async (saleData) => {
    try {
      const saleId = await generateNumericId('sales');
      const salesRef = ref(database, `sales/${saleId}`);
      
      const sale = {
        id: saleId,
        ...saleData,
        createdAt: Date.now(),
        status: 'completed'
      };
      await set(salesRef, sale);

      // Update stock for each item
      for (const item of saleData.items) {
        await productService.updateStockAndMarkUnitsSold(
          item.productId,
          item.quantity,
          saleId
        );
      }

      return sale;
    } catch (error) {
      throw new Error(`Error creating sale: ${error.message}`);
    }
  },

  // Get all sales
  getAllSales: async () => {
    try {
      const salesRef = ref(database, 'sales');
      const snapshot = await get(salesRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching sales: ${error.message}`);
    }
  },

  // Get sale by ID
  getSaleById: async (saleId) => {
    try {
      const saleRef = ref(database, `sales/${saleId}`);
      const snapshot = await get(saleRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      throw new Error(`Error fetching sale: ${error.message}`);
    }
  }
};

// Procurement CRUD operations
export const procurementService = {
  // Create procurement
  createProcurement: async (procurementData) => {
    try {
      const procurementId = await generateNumericId('procurements');
      const procurementsRef = ref(database, `procurements/${procurementId}`);
      
      const procurement = {
        id: procurementId,
        ...procurementData,
        createdAt: Date.now(),
        status: 'pending'
      };
      await set(procurementsRef, procurement);
      return procurement;
    } catch (error) {
      throw new Error(`Error creating procurement: ${error.message}`);
    }
  },

  // Receive procurement
  receiveProcurement: async (procurementId) => {
    try {
      const procurementRef = ref(database, `procurements/${procurementId}`);
      const snapshot = await get(procurementRef);
      
      if (!snapshot.exists()) {
        throw new Error('Procurement not found');
      }

      const procurement = snapshot.val();
      
      // Update procurement status
      await update(procurementRef, {
        status: 'received',
        receivedAt: Date.now()
      });

      // Update stock for each item
      for (const item of procurement.items) {
        await productService.updateStock(
          item.productId,
          item.quantity,
          'procurement',
          procurementId
        );
      }

      return true;
    } catch (error) {
      throw new Error(`Error receiving procurement: ${error.message}`);
    }
  },

  // Get all procurements
  getAllProcurements: async () => {
    try {
      const procurementsRef = ref(database, 'procurements');
      const snapshot = await get(procurementsRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching procurements: ${error.message}`);
    }
  },

  // Get procurement by ID
  getProcurementById: async (procurementId) => {
    try {
      const procurementRef = ref(database, `procurements/${procurementId}`);
      const snapshot = await get(procurementRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      throw new Error(`Error fetching procurement: ${error.message}`);
    }
  }
};

// Stock movements operations
export const stockMovementService = {
  // Get all stock movements
  getAllStockMovements: async () => {
    try {
      const movementsRef = ref(database, 'stockMovements');
      const snapshot = await get(movementsRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching stock movements: ${error.message}`);
    }
  },

  // Get stock movements by product
  getStockMovementsByProduct: async (productId) => {
    try {
      const movementsRef = ref(database, 'stockMovements');
      const snapshot = await get(movementsRef);
      if (snapshot.exists()) {
        const movements = Object.values(snapshot.val());
        return movements.filter(movement => movement.productId === productId);
      }
      return [];
    } catch (error) {
      throw new Error(`Error fetching stock movements: ${error.message}`);
    }
  }
};

// Categories CRUD operations
export const categoryService = {
  // Get all categories
  getAllCategories: async () => {
    try {
      const categoriesRef = ref(database, 'categories');
      const snapshot = await get(categoriesRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching categories: ${error.message}`);
    }
  },

  // Create new category
  createCategory: async (categoryData) => {
    try {
      const categoriesRef = ref(database, 'categories');
      const newCategoryRef = push(categoriesRef);
      const category = {
        id: newCategoryRef.key,
        name: categoryData.name,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await set(newCategoryRef, category);
      return category;
    } catch (error) {
      throw new Error(`Error creating category: ${error.message}`);
    }
  },

  // Update category
  updateCategory: async (categoryId, updateData) => {
    try {
      const categoryRef = ref(database, `categories/${categoryId}`);
      const updates = {
        ...updateData,
        updatedAt: Date.now()
      };
      await update(categoryRef, updates);
      return true;
    } catch (error) {
      throw new Error(`Error updating category: ${error.message}`);
    }
  },

  // Delete category
  deleteCategory: async (categoryId) => {
    try {
      const categoryRef = ref(database, `categories/${categoryId}`);
      await remove(categoryRef);
      return true;
    } catch (error) {
      throw new Error(`Error deleting category: ${error.message}`);
    }
  },

  // Get unique categories from existing products
  getCategoriesFromProducts: async () => {
    try {
      const productsRef = ref(database, 'products');
      const snapshot = await get(productsRef);
      if (snapshot.exists()) {
        const products = Object.values(snapshot.val());
        const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
        return uniqueCategories.map(category => ({ name: category }));
      }
      return [];
    } catch (error) {
      throw new Error(`Error fetching categories from products: ${error.message}`);
    }
  }
};

// Stock Audits CRUD operations
export const stockAuditService = {
  // Get all stock audits
  getAllStockAudits: async () => {
    try {
      const auditsRef = ref(database, 'stockAudits');
      const snapshot = await get(auditsRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching stock audits: ${error.message}`);
    }
  },

  // Get stock audit by ID
  getStockAuditById: async (auditId) => {
    try {
      const auditRef = ref(database, `stockAudits/${auditId}`);
      const snapshot = await get(auditRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      throw new Error(`Error fetching stock audit: ${error.message}`);
    }
  },

  // Get stock audits by date range
  getStockAuditsByDateRange: async (startDate, endDate) => {
    try {
      const auditsRef = ref(database, 'stockAudits');
      const snapshot = await get(auditsRef);
      if (snapshot.exists()) {
        const audits = Object.values(snapshot.val());
        return audits.filter(audit => {
          const auditDate = new Date(audit.date);
          return auditDate >= new Date(startDate) && auditDate <= new Date(endDate);
        });
      }
      return [];
    } catch (error) {
      throw new Error(`Error fetching stock audits by date range: ${error.message}`);
    }
  },

  // Get stock audits by month
  getStockAuditsByMonth: async (year, month) => {
    try {
      // Collect from stockAudits (list form)
      const auditsRef = ref(database, 'stockAudits');
      const snapshot = await get(auditsRef);
      const listAudits = snapshot.exists() ? Object.values(snapshot.val()) : [];

      const filteredListAudits = listAudits.filter((audit) => {
        const auditDate = new Date(audit.date);
        return (
          auditDate.getFullYear() == year && auditDate.getMonth() == month - 1
        );
      });

      // Collect from stockAuditsByDate (map by date)
      const byDateRef = ref(database, 'stockAuditsByDate');
      const byDateSnap = await get(byDateRef);
      let byDateAudits = [];
      if (byDateSnap.exists()) {
        const byDateMap = byDateSnap.val() || {};
        for (const [dateStr, entry] of Object.entries(byDateMap)) {
          const d = new Date(dateStr);
          if (d.getFullYear() == year && d.getMonth() == month - 1) {
            const resultsObj = (entry && entry.results) || {};
            const resultsArr = Object.values(resultsObj);
            byDateAudits.push({
              id: `byDate-${dateStr}`,
              date: dateStr,
              createdAt: entry?.meta?.updatedAt || entry?.meta?.createdAt || null,
              results: resultsArr,
              time: entry?.meta?.time || null
            });
          }
        }
      }

      // Merge both sources; list audits first, then byDate audits
      return [...filteredListAudits, ...byDateAudits];
    } catch (error) {
      throw new Error(`Error fetching stock audits by month: ${error.message}`);
    }
  }
};

// Users CRUD operations
export const userService = {
  // Get all users
  getAllUsers: async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }
  },

  // Get user by username
  getUserByUsername: async (username) => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = Object.values(snapshot.val());
        return users.find(user => user.username === username) || null;
      }
      return null;
    } catch (error) {
      throw new Error(`Error fetching user: ${error.message}`);
    }
  },

  // Create user
  createUser: async (userData) => {
    try {
      const userId = await generateNumericId('users');
      const usersRef = ref(database, `users/${userId}`);
      
      const user = {
        id: userId,
        ...userData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await set(usersRef, user);
      return user;
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  },

  // Update user
  updateUser: async (userId, userData) => {
    try {
      const userRef = ref(database, `users/${userId}`);
      await update(userRef, {
        ...userData,
        updatedAt: Date.now()
      });
      return true;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  },

  // Delete user
  deleteUser: async (userId) => {
    try {
      const userRef = ref(database, `users/${userId}`);
      await remove(userRef);
      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  },

  // Authenticate user
  authenticateUser: async (username, password) => {
    try {
      const user = await userService.getUserByUsername(username);
      if (user && user.password === password) {
        return user;
      }
      return null;
    } catch (error) {
      throw new Error(`Error authenticating user: ${error.message}`);
    }
  }
};

// Real-time listeners
export const realtimeService = {
  // Listen to products changes
  listenToProducts: (callback) => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const products = snapshot.exists() ? Object.values(snapshot.val()) : [];
      callback(products);
    });
    return () => off(productsRef);
  },

  // Listen to sales changes
  listenToSales: (callback) => {
    const salesRef = ref(database, 'sales');
    onValue(salesRef, (snapshot) => {
      const sales = snapshot.exists() ? Object.values(snapshot.val()) : [];
      callback(sales);
    });
    return () => off(salesRef);
  },

  // Listen to procurements changes
  listenToProcurements: (callback) => {
    const procurementsRef = ref(database, 'procurements');
    onValue(procurementsRef, (snapshot) => {
      const procurements = snapshot.exists() ? Object.values(snapshot.val()) : [];
      callback(procurements);
    });
    return () => off(procurementsRef);
  }
};
