import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // MapLibre spawns its own module worker. Pre-bundling the package rewrites the import graph and the
  // worker URL 404s, which leaves a live map that draws nothing but its background colour.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
