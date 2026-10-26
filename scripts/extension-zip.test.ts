import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createExtensionZip, zipFiles } from './extension-zip.ts';

describe('extension zip', () => {
  it('packs a loadable manifest and a bundled background.js', async () => {
    const extensionDir = join(process.cwd(), 'extension');
    const zip = await createExtensionZip(extensionDir);

    const dir = mkdtempSync(join(tmpdir(), 'mtt-ext-zip-'));
    const zipPath = join(dir, 'mytruetrack-import.zip');
    try {
      writeFileSync(zipPath, zip);
      const written = readFileSync(zipPath);
      const unpacked = readStoredZip(
        new Uint8Array(written.buffer, written.byteOffset, written.byteLength),
      );

      expect([...unpacked.keys()].sort()).toEqual(['background.js', 'manifest.json']);

      const manifest = JSON.parse(new TextDecoder().decode(unpacked.get('manifest.json'))) as {
        name: string;
        background: { service_worker: string };
      };
      expect(manifest.name).toBe('mytruetrack Import');
      expect(manifest.background.service_worker).toBe('background.js');

      const worker = new TextDecoder().decode(unpacked.get('background.js'));
      expect(worker).toContain('https://www.mercadopago.com.br/');
      expect(worker).not.toMatch(/from\s+['"]\.?\//);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a path that would escape the archive root', () => {
    expect(() => zipFiles([{ name: '/manifest.json', data: Uint8Array.of(1) }])).toThrow(
      /Invalid zip path/,
    );
  });
});

/** Read a stored (method 0) zip. Independent of the writer and of platform tar. */
function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      throw new Error(`Bad zip signature at ${offset}`);
    }

    const method = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method !== 0) throw new Error(`Expected a stored zip entry, got method ${method}`);
    if (data.length !== uncompressedSize) throw new Error(`Size mismatch for ${name}`);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch for ${name}`);

    files.set(name, data);
    offset = dataStart + compressedSize;
  }

  if (files.size === 0) throw new Error('Zip contained no files');
  return files;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
