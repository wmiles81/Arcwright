import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const OR_IMAGE_PROXY = {
  target: 'https://openrouter.ai',
  changeOrigin: true,
  rewrite: () => '/api/frontend/models/find?q=&output_modalities=image&limit=200',
};

// ACP endpoint runs on server.js (port 5174 by default)
const ACP_PROXY = {
  target: 'http://localhost:5174',
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/or-image-models': OR_IMAGE_PROXY,
      '/api': ACP_PROXY,
    },
  },
  preview: {
    proxy: {
      '/or-image-models': OR_IMAGE_PROXY,
      '/api': ACP_PROXY,
    },
  },
});
