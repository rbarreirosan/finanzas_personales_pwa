import { defineConfig } from 'vite';

// PWA estatica servida desde la raiz. El service worker (public/sw.js) y el
// manifest (public/manifest.webmanifest) se copian tal cual a la raiz del build.
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
