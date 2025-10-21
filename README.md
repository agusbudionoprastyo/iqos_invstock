# IQOS Inventory Management System

Sistem manajemen inventory untuk produk IQOS dengan fitur penjualan, pengadaan, dan scan barcode menggunakan Vite + React + Firebase Realtime Database.

## Fitur Utama

### 🏠 Dashboard
- Ringkasan statistik inventory
- Monitoring stok rendah
- Ringkasan keuangan
- Riwayat transaksi terbaru

### 📦 Manajemen Inventory
- CRUD produk IQOS
- Kategori produk (Device, HEETS, Aksesoris)
- Manajemen stok dan stok minimum
- Scan barcode untuk input produk
- Peringatan stok rendah

### 🛒 Modul Penjualan
- Point of Sale (POS) interface
- Scan barcode untuk penjualan
- Manajemen keranjang belanja
- Informasi pelanggan
- Metode pembayaran (Tunai, Kartu, Transfer)
- Cetak struk penjualan
- Update stok otomatis

### 🚚 Modul Pengadaan
- Pembuatan order pengadaan
- Manajemen supplier
- Scan barcode untuk pengadaan
- Status pengadaan (Pending, Received, Cancelled)
- Update stok saat diterima
- Riwayat pengadaan

### 📱 Scan Barcode
- Integrasi kamera untuk scan barcode
- Support berbagai format barcode
- Real-time scanning
- Error handling

## Teknologi yang Digunakan

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Firebase Realtime Database
- **Barcode Scanner**: html5-qrcode
- **Icons**: Lucide React
- **Routing**: React Router DOM

## Instalasi

1. Clone repository ini
2. Install dependencies:
```bash
npm install
```

3. Konfigurasi Firebase:
   - Buat project Firebase baru
   - Aktifkan Realtime Database
   - Copy konfigurasi Firebase ke `src/firebase/config.js`

4. Jalankan development server:
```bash
npm run dev
```

## Konfigurasi Firebase

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru atau gunakan project yang ada
3. Aktifkan Realtime Database
4. Copy konfigurasi project ke file `src/firebase/config.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Struktur Database

Database menggunakan struktur berikut:

```
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
      items: [...],
      totalAmount: number,
      customerName: string,
      customerPhone: string,
      paymentMethod: string,
      createdAt: timestamp,
      status: string
    }
  },
  procurements: {
    [procurementId]: {
      id: string,
      supplierName: string,
      supplierContact: string,
      items: [...],
      totalAmount: number,
      status: string,
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
      referenceId: string,
      createdAt: timestamp
    }
  }
}
```

## Penggunaan

### Menambah Produk
1. Buka menu "Inventory"
2. Klik "Tambah Produk"
3. Isi informasi produk
4. Gunakan scan barcode untuk input barcode
5. Simpan produk

### Melakukan Penjualan
1. Buka menu "Penjualan"
2. Scan barcode atau pilih produk dari daftar
3. Tambah ke keranjang
4. Isi informasi pelanggan
5. Pilih metode pembayaran
6. Proses penjualan

### Melakukan Pengadaan
1. Buka menu "Pengadaan"
2. Klik "Buat Pengadaan"
3. Isi informasi supplier
4. Tambah produk ke keranjang pengadaan
5. Set harga beli untuk setiap item
6. Buat pengadaan
7. Terima pengadaan untuk update stok

## Scripts

- `npm run dev` - Jalankan development server
- `npm run build` - Build untuk production
- `npm run preview` - Preview build production
- `npm run lint` - Jalankan ESLint

## Lisensi

MIT License

## Kontribusi

Silakan buat issue atau pull request untuk kontribusi pada project ini.
