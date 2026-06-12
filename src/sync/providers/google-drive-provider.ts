/**
 * Google Drive CloudProvider — uses `appDataFolder` for app-private storage.
 *
 * Browser-only. Requires an OAuth 2.0 access token with `drive.appdata` scope.
 * No unit tests — verified manually and via Playwright in Phase 8.8.
 */

import type { CloudProvider, FileMetadata } from '../cloud-provider.ts';

/** Thrown when the Drive API returns 401 — signals the caller to refresh the token and retry. */
export class DriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

type DriveFile = {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
};

type DriveListResponse = {
  files: DriveFile[];
};

export function createGoogleDriveProvider(accessToken: string): CloudProvider {
  const headers = (): Record<string, string> => ({
    Authorization: `Bearer ${accessToken}`,
  });

  /** Find a file in appDataFolder by name. Returns file ID or null. */
  async function findFileByName(filename: string): Promise<string | null> {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name = '${filename}'`,
      fields: 'files(id)',
      pageSize: '1',
    });

    const response = await fetch(`${DRIVE_API}?${params.toString()}`, {
      headers: headers(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new DriveAuthError(`Drive list failed: ${response.status} ${response.statusText}`);
      }
      throw new Error(`Drive list failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as DriveListResponse;
    return result.files.length > 0 ? result.files[0]!.id : null;
  }

  return {
    async upload(filename: string, data: Uint8Array): Promise<void> {
      // Check if file already exists (overwrite case)
      const existingId = await findFileByName(filename);

      if (existingId) {
        // Update existing file content (PATCH)
        const response = await fetch(`${UPLOAD_API}/${existingId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            ...headers(),
            'Content-Type': 'application/octet-stream',
          },
          body: data.buffer as ArrayBuffer,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new DriveAuthError(
              `Drive update failed: ${response.status} ${response.statusText}`,
            );
          }
          throw new Error(`Drive update failed: ${response.status} ${response.statusText}`);
        }
      } else {
        // Create new file via multipart upload
        const metadata = {
          name: filename,
          parents: ['appDataFolder'],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([data.buffer as ArrayBuffer]));

        const response = await fetch(`${UPLOAD_API}?uploadType=multipart`, {
          method: 'POST',
          headers: headers(),
          body: form,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new DriveAuthError(
              `Drive upload failed: ${response.status} ${response.statusText}`,
            );
          }
          throw new Error(`Drive upload failed: ${response.status} ${response.statusText}`);
        }
      }
    },

    async download(filename: string): Promise<Uint8Array | null> {
      const fileId = await findFileByName(filename);
      if (!fileId) return null;

      const response = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
        headers: headers(),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        if (response.status === 401) {
          throw new DriveAuthError(
            `Drive download failed: ${response.status} ${response.statusText}`,
          );
        }
        throw new Error(`Drive download failed: ${response.status} ${response.statusText}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    },

    async list(): Promise<FileMetadata[]> {
      const params = new URLSearchParams({
        spaces: 'appDataFolder',
        fields: 'files(id,name,size,modifiedTime)',
        pageSize: '100',
      });

      const response = await fetch(`${DRIVE_API}?${params.toString()}`, {
        headers: headers(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new DriveAuthError(`Drive list failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(`Drive list failed: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as DriveListResponse;
      return result.files.map((f) => ({
        name: f.name,
        size: parseInt(f.size, 10) || 0,
        modifiedAt: f.modifiedTime,
      }));
    },

    async delete(filename: string): Promise<void> {
      const fileId = await findFileByName(filename);
      if (!fileId) return; // no-op

      const response = await fetch(`${DRIVE_API}/${fileId}`, {
        method: 'DELETE',
        headers: headers(),
      });

      if (!response.ok && response.status !== 404) {
        if (response.status === 401) {
          throw new DriveAuthError(
            `Drive delete failed: ${response.status} ${response.statusText}`,
          );
        }
        throw new Error(`Drive delete failed: ${response.status} ${response.statusText}`);
      }
    },

    isAuthenticated(): boolean {
      return true;
    },
  };
}
