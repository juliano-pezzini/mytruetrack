/**
 * Sidebar version label.
 *
 * Production deploys pass the GitHub Actions run number for the Pages workflow
 * (`VITE_APP_VERSION`). That counter is the semver minor: major and patch stay
 * fixed so the label can grow into a real version later (`v1.43.0`). Local
 * builds and any non-numeric value show "dev".
 */
const VERSION_MAJOR = 1;
const VERSION_PATCH = 0;
const DEPLOY_RUN = /^[1-9]\d*$/;

export function formatAppVersion(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (DEPLOY_RUN.test(trimmed)) return `v${VERSION_MAJOR}.${trimmed}.${VERSION_PATCH}`;
  return 'dev';
}
