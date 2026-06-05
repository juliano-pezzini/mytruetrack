/**
 * In-memory mock CloudProvider for testing.
 */

import type { CloudProvider, FileMetadata } from './cloud-provider.ts';

type StoredFile = {
  data: Uint8Array;
  modifiedAt: string;
};

export function createMockCloudProvider(): CloudProvider {
  const files = new Map<string, StoredFile>();

  return {
    async upload(filename: string, data: Uint8Array): Promise<void> {
      files.set(filename, {
        data: new Uint8Array(data),
        modifiedAt: new Date().toISOString(),
      });
    },

    async download(filename: string): Promise<Uint8Array | null> {
      const file = files.get(filename);
      if (!file) return null;
      return new Uint8Array(file.data);
    },

    async list(): Promise<FileMetadata[]> {
      const result: FileMetadata[] = [];
      for (const [name, file] of files) {
        result.push({
          name,
          size: file.data.length,
          modifiedAt: file.modifiedAt,
        });
      }
      return result;
    },

    async delete(filename: string): Promise<void> {
      files.delete(filename);
    },

    isAuthenticated(): boolean {
      return true;
    },
  };
}
