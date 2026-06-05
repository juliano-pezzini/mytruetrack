# Phase 8.1 — Architecture Spike

**Type:** Research / proof-of-concept (no production code, no UI polish)
**Status:** Planned → **Complete (2026-06-04)**

---

## Why This Spike Exists

v2 makes several bets the team has not previously shipped:

1. **cr-sqlite** for CRDT-based multi-device sync
2. **WebAuthn-wrapped encryption keys** for biometric unlock
3. **Google Drive `appDataFolder`** as a sync backend
4. **OFX parsing in the browser** via `ofx-js`
5. **Bundle size budget** for SQLite-WASM + cr-sqlite + crypto libs

A failure in any of these mid-build would force costly rework. Spend ~1-2 weeks de-risking them now.

---

## Scope

**In scope:** standalone throwaway prototypes proving each bet works in isolation, plus one end-to-end smoke test combining them.

**Out of scope:** UI design, accessibility, production code quality, actual app features.

---

## Spikes

### Spike A — cr-sqlite multi-instance sync

**Question:** Can two browser instances exchange CRDT changes via a shared blob (simulating cloud sync) without conflicts or data loss?

**Method:**
1. Open the prototype in two browser tabs / two profiles
2. Both write to a shared SQLite table (e.g. transactions)
3. Export change-set blobs; manually shuffle between them
4. Apply and assert convergent state

**Go criteria:**
- Convergence after arbitrary write/sync orderings
- Bundle size of `cr-sqlite` + `sqlite-wasm` ≤ 1.5 MB gzipped
- API surface understandable in a day
- Library has activity in the last 6 months (commits or release)

**No-go fallback:** Evaluate Automerge or Yjs with a manual SQLite persistence layer; or hand-rolled op-log CRDT (last resort).

---

### Spike B — WebAuthn-wrapped key + passphrase unlock

**Question:** Can we wrap an AES-GCM key with a passphrase-derived key, store it encrypted in IndexedDB, and unlock it via WebAuthn (platform authenticator) on every app open?

**Method:**
1. Derive `KEK` from passphrase via PBKDF2 (Argon2 if WASM size acceptable)
2. Generate `DEK` (AES-GCM); wrap with `KEK`; store wrapped blob in IndexedDB
3. Register a platform WebAuthn credential
4. On unlock: WebAuthn assertion → use `prf` extension output (or fallback) to unwrap `DEK`
5. Encrypt/decrypt a sample blob with `DEK`

**Go criteria:**
- Works on Chrome (Windows Hello), Safari (Touch ID), and Chrome Android (fingerprint)
- Fallback path works on browsers without `prf` extension support (e.g., older Firefox)
- Round-trip encrypt → upload → download → decrypt of 5 MB blob completes in < 500 ms after unlock

**No-go fallback:** Passphrase-only unlock (no biometric); document the UX cost.

---

### Spike C — Google Drive `appDataFolder` sync

**Question:** Is `appDataFolder` viable for app-private sync (upload, download, list, delete, quota)?

**Method:**
1. OAuth 2.0 PKCE flow (no client secret needed for a SPA)
2. Upload 1 MB encrypted blob
3. Download and verify checksum
4. List + delete
5. Measure round-trip latency
6. Check quota / file count limits in Google docs

**Go criteria:**
- Full CRUD works with `https://www.googleapis.com/auth/drive.appdata` scope only (no broad Drive access)
- No surprise quota cliff below 100 MB / 1000 files (well above expected use)
- OAuth flow works on installed PWA (not just dev origin)

**No-go fallback:** Use full `drive.file` scope (write to user-visible folder); document privacy implication.

---

### Spike D — OFX parsing

**Question:** Does `ofx-js` (or alternative) correctly parse the OFX fixtures used in v1's import tests?

**Method:**
1. Copy v1 OFX fixtures from `truetrack/workspace/tests/fixtures`
2. Parse with `ofx-js`
3. Assert transaction count, dates, amounts, account IDs match expected
4. Compare bundle size vs. hand-rolled parser

**Go criteria:**
- All v1 fixture files parse correctly
- Bundle size acceptable (< 100 KB gzipped)
- Library maintained (release in last 12 months)

**No-go fallback:** Hand-rolled OFX parser (SGML + key/value extraction; v1 logic is already specified).

---

### Spike E — Total bundle size budget

**Question:** Does the combined v2 stack fit in the bundle budget?

**Target:** < 2 MB gzipped for initial app shell + DB engine + crypto.

**Method:** Build the combined spike app, measure with `vite build` + `gzipper`.

**Go criteria:** Under budget. If over: identify what to lazy-load (e.g., XLSX parser, charts) and confirm critical path still under budget.

---

## Deliverable

A single `spike-report.md` in this folder summarizing each spike's verdict (go / no-go / go-with-caveats), measurements, and any stack adjustments needed before Phase 8.2 begins.

---

## Definition of Done

- [x] All five spikes executed
- [x] `spike-report.md` written with verdicts and evidence
- [x] Any stack changes reflected in `.specs/project/PROJECT.md` (no changes needed)
- [x] AD-004 recorded in STATE.md capturing final stack choices
- [x] Spike code archived in a `spikes/` folder at repo root
