import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createExtensionZip, listExtensionFiles, zipFiles } from './extension-zip.ts';

describe('extension zip', () => {
  it('packs the extension directory so unzip restores every file', () => {
    const extensionDir = join(process.cwd(), 'extension');
    const expected = listExtensionFiles(extensionDir);
    const zip = createExtensionZip(extensionDir);

    const dir = mkdtempSync(join(tmpdir(), 'mtt-ext-zip-'));
    const zipPath = join(dir, 'mytruetrack-import.zip');
    try {
      writeFileSync(zipPath, zip);
      const listed = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' })
        .trim()
        .split(/\r?\n/)
        .sort();
      expect(listed).toEqual(expected.map((entry) => entry.name));

      const manifest = execFileSync('tar', ['-xOf', zipPath, 'manifest.json']);
      expect(Buffer.compare(manifest, readFileSync(join(extensionDir, 'manifest.json')))).toBe(0);
      expect(manifest.toString('utf8')).toContain('"name": "mytruetrack Import"');
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
