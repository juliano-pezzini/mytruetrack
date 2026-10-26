import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORT_EXTENSION_ID } from '../src/sync/import-extension-id.ts';

function extensionIdFromPublicKey(key: string): string {
  const der = Buffer.from(key, 'base64');
  const hex = createHash('sha256').update(der).digest().subarray(0, 16).toString('hex');
  return [...hex]
    .map((char) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(char, 16)))
    .join('');
}

describe('IMPORT_EXTENSION_ID', () => {
  it('is the id Edge derives from the manifest public key', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'extension', 'manifest.json'), 'utf8'),
    ) as { key: string };
    expect(extensionIdFromPublicKey(manifest.key)).toBe(IMPORT_EXTENSION_ID);
    expect(IMPORT_EXTENSION_ID).toMatch(/^[a-p]{32}$/);
  });
});
