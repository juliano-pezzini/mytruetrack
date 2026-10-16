/** Error shown when the page cannot connect to the companion import extension. */
export const EXTENSION_UNAVAILABLE_MESSAGE = 'Import extension not available';

/** Download name for the unpacked companion extension. */
export const EXTENSION_ZIP_NAME = 'mytruetrack-import.zip';

/** Same-origin URL of the extension zip. `baseUrl` is Vite's `BASE_URL`. */
export function extensionZipHref(baseUrl: string = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${EXTENSION_ZIP_NAME}`;
}
