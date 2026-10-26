import { describe, expect, it } from 'vitest';
import { EXTENSION_ZIP_NAME, extensionZipHref } from './extension-unavailable.ts';

describe('extensionZipHref', () => {
  it('joins the zip name onto the app base path', () => {
    expect(extensionZipHref('/')).toBe(`/${EXTENSION_ZIP_NAME}`);
    expect(extensionZipHref('/mytruetrack/')).toBe(`/mytruetrack/${EXTENSION_ZIP_NAME}`);
    expect(extensionZipHref('/mytruetrack')).toBe(`/mytruetrack/${EXTENSION_ZIP_NAME}`);
  });
});
