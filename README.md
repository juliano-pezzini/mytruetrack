# mytruetrack

A **local-first**, privacy-respecting personal finance tracker. Your data lives on your devices, encrypted end-to-end, and syncs through cloud storage you already own (Google Drive, OneDrive, WebDAV / Nextcloud) — never through our servers, because there are no servers.

> Successor to [truetrack](https://github.com/juliano-pezzini/truetrack) (Laravel + PostgreSQL). See [.specs/project/STATE.md](./.specs/project/STATE.md) for the architectural decision history.

## Highlights

- **Local-first** — works fully offline; cloud sync is optional and user-owned
- **End-to-end encrypted** — passphrase-derived key, unlocked via WebAuthn (Touch ID / Windows Hello / Android fingerprint)
- **Double-entry-inspired** balance logic with monthly snapshots (ported from v1)
- **Multi-device sync** via CRDT (cr-sqlite) — no conflicts, no merge prompts
- **Pluggable cloud providers** — Google Drive `appDataFolder` and WebDAV at launch
- **PWA** — installable, works on phone, tablet, desktop

## Stack

TypeScript · React · Vite · SQLite-WASM · cr-sqlite (CRDT) · IndexedDB · Web Crypto · WebAuthn · Tailwind

## Deploy (GitHub Pages)

The app is a static Vite PWA. Pushes to `main` build and publish it as a **project site** at `https://<user>.github.io/mytruetrack/` (hash routes: `/#/accounts`, etc.).

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Optional: add Actions secret `VITE_GOOGLE_CLIENT_ID` so Google Drive sync is compiled in.
3. In Google Cloud Console, add Authorized JavaScript origin `https://<user>.github.io` (scheme + host only; no path).
4. Open `https://<user>.github.io/mytruetrack/` after the **Deploy GitHub Pages** workflow succeeds.

Local and PR builds keep `base: '/'`. Only the Pages workflow sets `VITE_BASE_PATH=/mytruetrack/`.

## License

See [LICENSE](./LICENSE) (TBD — likely MIT, matching v1).
