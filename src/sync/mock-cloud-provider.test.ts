import { describe, it, expect } from 'vitest';
import { createMockCloudProvider } from './mock-cloud-provider.ts';

describe('MockCloudProvider', () => {
  it('uploads and downloads a file', async () => {
    const provider = createMockCloudProvider();
    const data = new TextEncoder().encode('hello cloud');

    await provider.upload('test.bin', data);
    const downloaded = await provider.download('test.bin');

    expect(downloaded).not.toBeNull();
    expect(downloaded).toEqual(data);
  });

  it('returns null for non-existent file', async () => {
    const provider = createMockCloudProvider();
    const result = await provider.download('no-such-file.bin');
    expect(result).toBeNull();
  });

  it('overwrites existing file on upload', async () => {
    const provider = createMockCloudProvider();
    await provider.upload('file.bin', new Uint8Array([1, 2, 3]));
    await provider.upload('file.bin', new Uint8Array([4, 5, 6, 7]));

    const downloaded = await provider.download('file.bin');
    expect(downloaded).toEqual(new Uint8Array([4, 5, 6, 7]));

    const files = await provider.list();
    expect(files).toHaveLength(1);
  });

  it('lists uploaded files with metadata', async () => {
    const provider = createMockCloudProvider();
    await provider.upload('a.bin', new Uint8Array([1, 2]));
    await provider.upload('b.bin', new Uint8Array([3, 4, 5]));

    const files = await provider.list();
    expect(files).toHaveLength(2);

    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(['a.bin', 'b.bin']);
    expect(files.find((f) => f.name === 'a.bin')!.size).toBe(2);
    expect(files.find((f) => f.name === 'b.bin')!.size).toBe(3);
  });

  it('deletes a file', async () => {
    const provider = createMockCloudProvider();
    await provider.upload('gone.bin', new Uint8Array([1]));
    await provider.delete('gone.bin');

    expect(await provider.download('gone.bin')).toBeNull();
    expect(await provider.list()).toHaveLength(0);
  });

  it('delete is a no-op for non-existent file', async () => {
    const provider = createMockCloudProvider();
    await provider.delete('never-existed.bin');
    // Should not throw
  });

  it('isAuthenticated returns true', () => {
    const provider = createMockCloudProvider();
    expect(provider.isAuthenticated()).toBe(true);
  });

  it('stores a copy of the data (not a reference)', async () => {
    const provider = createMockCloudProvider();
    const original = new Uint8Array([1, 2, 3]);
    await provider.upload('ref.bin', original);

    // Mutate original
    original[0] = 99;

    const downloaded = await provider.download('ref.bin');
    expect(downloaded![0]).toBe(1); // should be the original value
  });
});
