import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rolldown } from 'rolldown';

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

type PackagedManifest = {
  background?: { service_worker?: string };
};

/** Loadable package: manifest plus one bundled service worker. */
export async function createExtensionZip(extensionDir: string): Promise<Uint8Array> {
  const manifestPath = join(extensionDir, 'manifest.json');
  const manifestBytes = new Uint8Array(readFileSync(manifestPath));
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as PackagedManifest;
  if (manifest.background?.service_worker !== 'background.js') {
    throw new Error('Packaged manifest service_worker must be background.js');
  }

  const background = await bundleBackground(join(extensionDir, 'src', 'background.ts'));
  return zipFiles([
    { name: 'background.js', data: background },
    { name: 'manifest.json', data: manifestBytes },
  ]);
}

async function bundleBackground(entry: string): Promise<Uint8Array> {
  const bundle = await rolldown({
    input: entry,
    platform: 'browser',
  });
  try {
    const { output } = await bundle.generate({
      format: 'esm',
      sourcemap: false,
    });
    const chunks = output.filter((item) => item.type === 'chunk');
    if (chunks.length !== 1) {
      throw new Error(`Expected one extension chunk, got ${chunks.length}`);
    }
    const chunk = chunks[0];
    if (chunk === undefined || chunk.imports.length > 0) {
      throw new Error('Extension bundle must be a single file with no imports');
    }
    return new TextEncoder().encode(chunk.code);
  } finally {
    await bundle.close();
  }
}

/**
 * Stored (uncompressed) zip. The extension folder is small, and every unzipper
 * can open method 0.
 */
export function zipFiles(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (entry.name.length === 0 || entry.name.includes('\\') || entry.name.startsWith('/')) {
      throw new Error(`Invalid zip path: ${entry.name}`);
    }
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const local = localHeader(nameBytes, entry.data, crc);
    locals.push(local);
    centrals.push(centralHeader(nameBytes, entry.data, crc, offset));
    offset += local.length;
  }

  const central = concat(centrals);
  const end = endOfCentralDirectory(entries.length, central.length, offset);
  return concat([...locals, central, end]);
}

function localHeader(name: Uint8Array, data: Uint8Array, crc: number): Uint8Array {
  return concat([
    u32(0x04034b50),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x0021),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    name,
    data,
  ]);
}

function centralHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  offset: number,
): Uint8Array {
  return concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x0021),
    u32(crc),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(offset),
    name,
  ]);
}

function endOfCentralDirectory(
  count: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  return concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(count),
    u16(count),
    u32(centralSize),
    u32(centralOffset),
    u16(0),
  ]);
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

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
