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

## Status

Project bootstrap. See [.specs/project/ROADMAP.md](./.specs/project/ROADMAP.md).

## License

See [LICENSE](./LICENSE) (TBD — likely MIT, matching v1).
