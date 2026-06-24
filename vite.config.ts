import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// NOTE: cr-sqlite 0.16 (`@vlcn.io/crsqlite-wasm`) persists via the Asyncify
// `IDBBatchAtomicVFS` (IndexedDB) build — it does NOT use OPFS or
// SharedArrayBuffer, so cross-origin isolation (COOP `same-origin` + COEP
// `require-corp`) is not required. Those headers also break the Google Identity
// Services sign-in popup: COOP `same-origin` severs the popup's `window.opener`
// link so the token can never return ("popup window closed" even on success).
//
// We therefore use COOP `same-origin-allow-popups` (keeps cross-origin window
// protection while allowing OAuth popups to post their result back) and omit
// COEP. If a future move to a real OPFS VFS is made, prefer the OPFS
// SyncAccessHandle Pool VFS, which also works WITHOUT cross-origin isolation.
const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
});
