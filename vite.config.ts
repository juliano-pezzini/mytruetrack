import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createExtensionZip } from './scripts/extension-zip.ts';
import { EXTENSION_ZIP_NAME } from './src/ui/extension-unavailable.ts';

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

function extensionZipPlugin(): Plugin {
  let extensionDir = join(process.cwd(), 'extension');

  const load = (): Promise<Uint8Array> => createExtensionZip(extensionDir);

  return {
    name: 'mytruetrack-extension-zip',
    configResolved(config) {
      extensionDir = join(config.root, 'extension');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const base = server.config.base.endsWith('/')
          ? server.config.base
          : `${server.config.base}/`;
        if (path !== `${base}${EXTENSION_ZIP_NAME}`) {
          next();
          return;
        }
        void load()
          .then((body) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', String(body.byteLength));
            res.setHeader('Content-Disposition', `attachment; filename="${EXTENSION_ZIP_NAME}"`);
            res.end(body);
          })
          .catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: EXTENSION_ZIP_NAME,
        source: await load(),
      });
    },
  };
}

export default defineConfig({
  // Pages project sites use `/<repo>/`. A `<owner>.github.io` user site and local/PR builds keep `/`.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), extensionZipPlugin()],
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
