import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebDavProvider, type WebDavConfig } from './webdav-provider.ts';

const TEST_CONFIG: WebDavConfig = {
  endpoint: 'https://cloud.example.com/remote.php/dav/files/user',
  syncFolder: 'mytruetrack',
  username: 'testuser',
  password: 'testpass',
};

const expectedAuth = `Basic ${btoa('testuser:testpass')}`;

describe('WebDAV CloudProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Stub DOMParser for PROPFIND tests
    vi.stubGlobal('DOMParser', globalThis.DOMParser ?? MockDOMParser);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('upload sends PUT with correct URL, auth header, and body', async () => {
    // MKCOL for folder creation
    fetchMock.mockResolvedValueOnce({ ok: true });
    // PUT for file upload
    fetchMock.mockResolvedValueOnce({ ok: true });

    const provider = createWebDavProvider(TEST_CONFIG);
    const data = new Uint8Array([1, 2, 3]);
    await provider.upload('test.bin', data);

    // MKCOL call
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const mkcolCall = fetchMock.mock.calls[0]!;
    expect(mkcolCall[0]).toBe('https://cloud.example.com/remote.php/dav/files/user/mytruetrack');
    expect(mkcolCall[1].method).toBe('MKCOL');

    // PUT call
    const putCall = fetchMock.mock.calls[1]!;
    expect(putCall[0]).toBe('https://cloud.example.com/remote.php/dav/files/user/mytruetrack/test.bin');
    expect(putCall[1].method).toBe('PUT');
    expect(putCall[1].headers.Authorization).toBe(expectedAuth);
    expect(putCall[1].headers['Content-Type']).toBe('application/octet-stream');
  });

  it('download returns Uint8Array on 200', async () => {
    const responseData = new Uint8Array([10, 20, 30]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(responseData.buffer),
    });

    const provider = createWebDavProvider(TEST_CONFIG);
    const result = await provider.download('test.bin');

    expect(result).toEqual(responseData);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://cloud.example.com/remote.php/dav/files/user/mytruetrack/test.bin',
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe('GET');
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe(expectedAuth);
  });

  it('download returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const provider = createWebDavProvider(TEST_CONFIG);
    const result = await provider.download('missing.bin');

    expect(result).toBeNull();
  });

  it('delete sends DELETE request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });

    const provider = createWebDavProvider(TEST_CONFIG);
    await provider.delete('old.bin');

    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://cloud.example.com/remote.php/dav/files/user/mytruetrack/old.bin',
    );
    expect(fetchMock.mock.calls[0]![1].method).toBe('DELETE');
  });

  it('delete does not throw on 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const provider = createWebDavProvider(TEST_CONFIG);
    await expect(provider.delete('gone.bin')).resolves.toBeUndefined();
  });

  it('isAuthenticated returns true when credentials set', () => {
    const provider = createWebDavProvider(TEST_CONFIG);
    expect(provider.isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when credentials missing', () => {
    const provider = createWebDavProvider({
      ...TEST_CONFIG,
      username: '',
      password: '',
    });
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('upload throws on non-OK response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true }); // MKCOL
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const provider = createWebDavProvider(TEST_CONFIG);
    await expect(provider.upload('test.bin', new Uint8Array([1]))).rejects.toThrow(
      'WebDAV PUT failed: 500 Internal Server Error',
    );
  });
});

// Minimal DOMParser mock for Node.js
class MockDOMParser {
  parseFromString(_str: string, _type: string) {
    return {
      getElementsByTagNameNS: () => ({ length: 0 }),
    };
  }
}
