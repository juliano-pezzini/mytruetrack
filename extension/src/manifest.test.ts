import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(extensionRoot, 'manifest.json'), 'utf8')) as {
  name: string;
  host_permissions: string[];
  background: { service_worker: string };
};

describe('extension manifest', () => {
  it('is named mytruetrack Import', () => {
    expect(manifest.name).toBe('mytruetrack Import');
  });

  it('loads a bundled JavaScript service worker', () => {
    expect(manifest.background.service_worker).toBe('background.js');
  });

  it('includes Mercado Pago and InvestPass host permissions', () => {
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        'https://www.mercadopago.com.br/*',
        'https://pass-api.invest-pass.com/*',
      ]),
    );
  });
});
