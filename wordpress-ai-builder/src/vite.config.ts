import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../build',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'main.tsx',
    },
  },
  // Dev server proxies API calls to a local WordPress instance
  server: {
    proxy: {
      '/wp-json': 'http://localhost:8080',
      '/wp-login.php': 'http://localhost:8080',
    },
  },
});
