import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app proxies /api and /uploads to the Express server,
// so no CORS or absolute URLs are needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
