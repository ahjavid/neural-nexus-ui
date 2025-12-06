import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom'],
          // Document processing libraries (large) - split separately
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-xlsx': ['xlsx'],
          'vendor-mammoth': ['mammoth'],
          // Icons library
          'vendor-icons': ['lucide-react'],
        }
      }
    },
    // Increase warning limit since document processing libs are inherently large
    chunkSizeWarningLimit: 600
  }
})
