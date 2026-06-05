import { defineConfig } from 'vite';

export default defineConfig({
  // Required for SQLite-WASM SharedArrayBuffer (OPFS VFS)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Ensure WASM files are served correctly
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm', '@vlcn.io/crsqlite-wasm'],
  },
});
