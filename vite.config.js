import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      writeBundle() {
        try {
          copyFileSync('public/_redirects', 'dist/_redirects')
        } catch (err) {
          console.log('No _redirects file found in public folder')
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  }
})
