/**
 * WebDAV CloudProvider — standard WebDAV over HTTP.
 *
 * Supports Nextcloud, ownCloud, and any generic WebDAV server.
 * Uses Basic auth. Browser-only (uses fetch).
 */

import type { CloudProvider, FileMetadata } from '../cloud-provider.ts';

export type WebDavConfig = {
  readonly endpoint: string;   // e.g. "https://cloud.example.com/remote.php/dav/files/user/"
  readonly syncFolder: string; // e.g. "mytruetrack/"
  readonly username: string;
  readonly password: string;
};

function buildUrl(config: WebDavConfig, filename?: string): string {
  let base = config.endpoint.replace(/\/+$/, '');
  const folder = config.syncFolder.replace(/\/+$/, '').replace(/^\/+/, '');
  if (folder) {
    base = `${base}/${folder}`;
  }
  if (filename) {
    base = `${base}/${filename}`;
  }
  return base;
}

function authHeaders(config: WebDavConfig): Record<string, string> {
  const credentials = btoa(`${config.username}:${config.password}`);
  return {
    Authorization: `Basic ${credentials}`,
  };
}

/**
 * Parse a WebDAV PROPFIND multistatus XML response into FileMetadata[].
 * Extracts href, getcontentlength, and getlastmodified from each response element.
 */
function parsePropfindResponse(xml: string, folderUrl: string): FileMetadata[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const responses = doc.getElementsByTagNameNS('DAV:', 'response');
  const files: FileMetadata[] = [];

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]!;
    const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0];
    const href = hrefEl?.textContent ?? '';

    // Skip the folder itself (it's included in the response)
    if (href === folderUrl || href === `${folderUrl}/`) continue;

    // Skip collections (subfolders)
    const resourceType = response.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
    if (resourceType?.getElementsByTagNameNS('DAV:', 'collection').length) continue;

    const sizeEl = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
    const modifiedEl = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];

    const name = decodeURIComponent(href.split('/').filter(Boolean).pop() ?? '');
    const size = sizeEl?.textContent ? parseInt(sizeEl.textContent, 10) : 0;
    const modifiedAt = modifiedEl?.textContent
      ? new Date(modifiedEl.textContent).toISOString()
      : new Date().toISOString();

    if (name) {
      files.push({ name, size, modifiedAt });
    }
  }

  return files;
}

export function createWebDavProvider(config: WebDavConfig): CloudProvider {
  return {
    async upload(filename: string, data: Uint8Array): Promise<void> {
      // Ensure the sync folder exists (MKCOL, ignore 405 = already exists)
      const folderUrl = buildUrl(config);
      await fetch(folderUrl, {
        method: 'MKCOL',
        headers: authHeaders(config),
      }).catch(() => { /* ignore */ });

      const url = buildUrl(config, filename);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...authHeaders(config),
          'Content-Type': 'application/octet-stream',
        },
        body: data.buffer as ArrayBuffer,
      });

      if (!response.ok) {
        throw new Error(`WebDAV PUT failed: ${response.status} ${response.statusText}`);
      }
    },

    async download(filename: string): Promise<Uint8Array | null> {
      const url = buildUrl(config, filename);
      const response = await fetch(url, {
        method: 'GET',
        headers: authHeaders(config),
      });

      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(`WebDAV GET failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    },

    async list(): Promise<FileMetadata[]> {
      const url = buildUrl(config);
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          ...authHeaders(config),
          Depth: '1',
          'Content-Type': 'application/xml',
        },
        body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:allprop/></d:propfind>',
      });

      if (!response.ok) {
        throw new Error(`WebDAV PROPFIND failed: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      const folderPath = new URL(url).pathname;
      return parsePropfindResponse(xml, folderPath);
    },

    async delete(filename: string): Promise<void> {
      const url = buildUrl(config, filename);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: authHeaders(config),
      });

      if (response.status === 404) return; // no-op

      if (!response.ok) {
        throw new Error(`WebDAV DELETE failed: ${response.status} ${response.statusText}`);
      }
    },

    isAuthenticated(): boolean {
      return Boolean(config.username && config.password && config.endpoint);
    },
  };
}
