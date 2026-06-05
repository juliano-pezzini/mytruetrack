import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/storage/**', 'src/crypto/**', 'src/sync/**'],
      exclude: [
        'src/crypto/webauthn.ts',       // browser-only (WebAuthn API)
        'src/sync/providers/**',         // browser-only (OAuth + fetch)
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
