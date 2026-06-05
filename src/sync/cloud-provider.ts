/**
 * CloudProvider — abstract interface for cloud storage backends.
 *
 * The sync engine talks exclusively to this interface. Each cloud service
 * (Google Drive, WebDAV, etc.) provides its own implementation.
 */

export type FileMetadata = {
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: string; // ISO datetime
};

export type CloudProvider = {
  /** Upload a file. Overwrites if it already exists. */
  upload(filename: string, data: Uint8Array): Promise<void>;

  /** Download a file by name. Returns null if the file does not exist. */
  download(filename: string): Promise<Uint8Array | null>;

  /** List all files in the sync folder. */
  list(): Promise<FileMetadata[]>;

  /** Delete a file by name. No-op if the file does not exist. */
  delete(filename: string): Promise<void>;

  /** Check if the provider has valid credentials. */
  isAuthenticated(): boolean;
};
