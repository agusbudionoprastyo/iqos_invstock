import { ref, set, get, push, update, remove, onValue, off } from 'firebase/database';
import { database } from '../firebase/config';

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

  // Get units count with barcode for a product
  getUnitsWithBarcodeCount: async (productId) => {
    try {
      const unitsRef = ref(database, `productUnits/${productId}`);
      const snapshot = await get(unitsRef);
      if (snapshot.exists()) {
        const units = Object.values(snapshot.val());
        return units.filter(unit => unit.barcode).length;
      }
      return 0;
    } catch (error) {
      throw new Error(`Error getting units count: ${error.message}`);
    }
  },

  // Get ready stock (units with barcode) for a product
  getReadyStock: async (productId) => {
    try {
      const unitsRef = ref(database, `productUnits/${productId}`);
      const snapshot = await get(unitsRef);
      if (snapshot.exists()) {
        const units = Object.values(snapshot.val());
        return units.filter(unit => unit.barcode && unit.status === 'in_stock').length;
      }
      return 0;
    } catch (error) {
      throw new Error(`Error getting ready stock: ${error.message}`);
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

  // Get all products
  getAllProducts: async () => {
    try {
      const productsRef = ref(database, 'products');
      const snapshot = await get(productsRef);
      return snapshot.exists() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      throw new Error(`Error fetching products: ${error.message}`);
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
      const movementRef = ref(database, 'stockMovements');
      const newMovementRef = push(movementRef);
      const movement = {
        id: newMovementRef.key,
        productId,
        productName: product.name,
        type: quantityChange > 0 ? 'in' : 'out',
        quantity: Math.abs(quantityChange),
        reason,
        referenceId,
        createdAt: Date.now()
      };
      await set(newMovementRef, movement);

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
      const salesRef = ref(database, 'sales');
      const newSaleRef = push(salesRef);
      const sale = {
        id: newSaleRef.key,
        ...saleData,
        createdAt: Date.now(),
        status: 'completed'
      };
      await set(newSaleRef, sale);

      // Update stock for each item
      for (const item of saleData.items) {
        await productService.updateStock(
          item.productId,
          -item.quantity,
          'sale',
          newSaleRef.key
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
      const procurementsRef = ref(database, 'procurements');
      const newProcurementRef = push(procurementsRef);
      const procurement = {
        id: newProcurementRef.key,
        ...procurementData,
        createdAt: Date.now(),
        status: 'pending'
      };
      await set(newProcurementRef, procurement);
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
