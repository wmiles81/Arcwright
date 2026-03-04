import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const OR_IMAGE_PROXY = {
  target: 'https://openrouter.ai',
  changeOrigin: true,
  rewrite: () => '/api/frontend/models/find?q=&output_modalities=image&limit=200',
};

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/or-image-models': OR_IMAGE_PROXY,
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: { '/or-image-models': OR_IMAGE_PROXY },
  },
});
