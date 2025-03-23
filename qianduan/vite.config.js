import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false, // 允许在端口被占用时使用其他端口
    cors: true, // 启用CORS
    allowedHosts: ['localhost', '192.168.31.73', 'my.moshang.site'], // 允许的主机名
    proxy: {
      '/api': {
        target: 'https://192.168.31.73:5000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      },
      '/uploads': {
        target: 'https://192.168.31.73:5000',
        changeOrigin: true,
        secure: true
      },
      '/socket.io': {
        target: 'https://192.168.31.73:5000',
        ws: true,
        changeOrigin: true,
        secure: true
      }
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  }
})
