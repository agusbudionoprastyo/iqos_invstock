# Cara Update PWA Cache

## Masalah
Ketika icon atau asset PWA diubah, kadang PWA yang sudah terinstall masih menggunakan cache lama.

## Solusi

### 1. Build dengan Clean Cache
```bash
npm run build:clean
```

Command ini akan:
- Menghapus folder `dist` yang lama
- Build ulang semua file dengan hash baru
- Generate service worker baru

### 2. Update Version (Opsional)
Jika icon tetap tidak update, ubah versi di `package.json`:
```json
"version": "1.0.1"  // increment version number
```

### 3. Deploy ke Production
```bash
# Deploy ke Netlify
npm run deploy
# atau
netlify deploy --prod
```

### 4. Di Device User (Untuk Testing)
Jika testing di device sendiri:

1. **Hapus PWA yang sudah terinstall:**
   - **Android**: Settings > Apps > IQOS Inventory > Uninstall
   - **iOS**: Long press app icon > Remove App

2. **Clear Browser Cache:**
   - Chrome: Settings > Privacy > Clear browsing data > Check "Cached images and files"
   - Safari: Settings > Safari > Clear History and Website Data

3. **Reinstall PWA:**
   - Buka website di browser
   - Install prompt akan muncul
   - Install ulang

### 5. Atau Gunakan DevTools
1. Buka DevTools (F12)
2. Go to Application tab > Service Workers
3. Click "Unregister" untuk service worker yang aktif
4. Hard refresh page (Ctrl+Shift+R atau Cmd+Shift+R)
5. Reinstall PWA

## Catatan Penting

- `registerType: 'autoUpdate'` akan otomatis update PWA ketika ada version baru
- User perlu close dan open ulang PWA untuk melihat update
- Di production, update akan tersebar secara bertahap (staged rollout)

## Troubleshooting

Jika icon masih tidak update:

1. Check hash di `dist/sw.js` - pastikan hash icon sudah berubah
2. Check `dist/manifest.webmanifest` - pastikan icon path benar
3. Verify icon files di `public/` - pastikan file benar-benar diganti
4. Try incognito/private mode untuk test

## Version History
- v1.0.0 - Initial PWA setup with proper cache strategy
