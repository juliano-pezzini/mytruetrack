# Drive pull decrypt failure — findings for strategy redesign

**Date:** 2026-09-13  
**Status:** Reproduced and mitigated operationally; product strategy still open  
**Related:** crypto layer (DEK), sync layer (delta segments), Google Drive `appDataFolder`

---

## One-line takeaway

Pull fails when Drive still contains **peer** `changes-*.bin` segments encrypted under a **different vault DEK** (or as plaintext) than the DEK currently unlocked in this browser origin. Same-device push→pull is fine once those leftovers are cleared; the bug is **orphaned remote history colliding with a new local vault identity**, not a broken AES round-trip of the file you just pushed.

---

## Observed failure

```
Pull failed: Cannot decrypt changes-<peerSiteId>-<version>.bin
(peer site <peerSiteId>): Decryption failed — wrong key or tampered data.
Leftover sync files from a previous vault or database often cause this.
Clear cloud sync data in Settings, then push from this device.
```

### Live reproduction (2026-09-13)

| Step | Result |
|------|--------|
| Connect Google Drive (real Chrome + remote debugging) | OK |
| Push Now | `Push complete.` |
| Pull Now (immediate, same device, no refresh) | Failed on peer file `changes-394086bd6f994d70bf14c689e65419be-2.bin` |
| Clear cloud sync data | Deleted **2** remote `changes-*.bin` files; reset local watermarks |
| Push → Pull again | `Pull complete.` |

---

## Why “push then pull on the same device” still fails

Pull **never decrypts the segment you just pushed**.

In [`src/sync/crsql-changes.ts`](../../src/sync/crsql-changes.ts), `pullDeltas`:

1. Lists all `changes-<siteId>-<version>.bin` in the provider folder.
2. **Skips** segments where `siteId === ownSiteId` (`crsql_site_id()`).
3. Downloads remaining **peer** segments newer than local `appliedPeerVersions`.
4. If a local DEK exists, always runs `decrypt(dek, decodeBlob(packed))`.

So after a successful push, pull only errors if Drive already has **other** site-id segments that this DEK cannot open.

```text
Push  →  uploads changes-<ownSite>-N.bin  (encrypted with current DEK)
Pull  →  ignores ownSite files
      →  tries peer files from older site IDs / vaults
      →  AES-GCM auth fails → "wrong key or tampered data"
```

---

## Key / identity model (what is local vs shared)

| Artifact | Where it lives | Shared across origins/devices? |
|----------|----------------|--------------------------------|
| Passphrase | User memory | Yes (same string) |
| Salt + wrapped DEK | IndexedDB `mytruetrack-keystore` | **No** — per browser origin |
| Unwrapped DEK (session) | In-memory after unlock | **No** |
| `crsql_site_id` | Local SQLite / VFS DB | **No** — new DB ⇒ new site id |
| Sync watermarks | IndexedDB `mytruetrack-sync-state` | **No** |
| Google OAuth tokens | IndexedDB `mytruetrack-sync-config` | **No** |
| `changes-*.bin` | Google Drive **`appDataFolder`** (or WebDAV folder) | **Yes** — one folder per Google account / OAuth client |

Critical implication:

- Passphrase alone does **not** reconstruct the DEK. Setup always `generateDek()` and wraps it; DEK is random per vault creation.
- Spec note (not implemented): crypto layer out-of-scope said multi-device key distribution would put a **wrapped DEK in the sync blob**. That path was never built. Recovery sheet still mentions “Restore existing vault”, but SetupWizard has no restore flow.
- Same `VITE_GOOGLE_CLIENT_ID` ⇒ localhost and GitHub Pages share the **same** Drive `appDataFolder`, while each origin has its **own** IndexedDB vault and site id.

```text
https://juliano-pezzini.github.io/mytruetrack/   ─┐
http://localhost:5173/                          ─┼─► same Drive appDataFolder
(other profile / wiped DB / new passphrase)     ─┘
         ▲
         │ separate: DEK, salt, site_id, watermarks
```

---

## Root causes that produce this error

Ordered by likelihood for the reproduced case:

1. **Leftover peer segments under a previous `crsql_site_id`**  
   DB wipe / new OPFS-or-IDB database / new browser profile ⇒ new site id. Old `changes-<oldSite>-*.bin` remain on Drive and look like peers.

2. **Leftover segments under a previous DEK**  
   Vault reset / “create passphrase” again / full reset ⇒ new DEK. Old ciphertext still on Drive.

3. **Mixed encryption modes on the same folder**  
   One origin pushed with `dek: null` (local-only / `vault-skipped`). Another origin has a passphrase and always decrypts → GCM fails on JSON plaintext (leading `[` gets a specific UI hint).

4. **Cross-origin “two apps, one Drive”**  
   Dev (`localhost`) vs Pages (`github.io`) both write peers into one folder with incompatible vaults.

Less likely for this report (same session DEK): corrupt download, true tampering, wrong unlock passphrase (unlock fails earlier with unwrap error).

---

## Current mitigations (shipped / operational)

### Code / UX (Phase 1)

- Safer binary upload/crypto views (`toArrayBuffer` / `.slice()`, no raw oversized `.buffer`).
- Pull errors name the failing segment + peer site id and suggest clearing cloud sync data.
- Settings → **Clear cloud sync data**: deletes remote `changes-*.bin`, resets local sync watermarks; local finance data kept; user re-pushes.

### Operational rule of thumb

Whenever you **recreate the vault**, **wipe the DB**, or **switch origins** against the same Google account: **Clear cloud sync data**, then **Push** from the device/origin you intend to keep.

---

## Spec vs reality gap (strategy input)

| Spec / copy | Reality today |
|-------------|----------------|
| Multi-device sync with one passphrase | DEK is device-local; same passphrase on a second setup ≠ same DEK |
| “Encrypted blob contains wrapped DEK” (8.4 out-of-scope note) | Not implemented; only CRDT change segments are uploaded |
| Recovery sheet: “Restore existing vault” | No restore path in SetupWizard |
| Sidebar “Encrypted · Local · end-to-end” | Hardcoded; can show even when `vault-skipped` / DEK null |

Any new strategy should decide explicitly: **is the vault key portable across devices/origins, or is Drive a single-writer scratchpad until restore exists?**

---

## Strategy options to evaluate (not chosen)

These are inputs for a redesign, not a recommendation lock-in.

### A. Cloud vault key metadata (multi-device restore)

Upload e.g. `vault-key.bin` / JSON: `{ wrappedDek, salt, iterations }` into the sync folder.  
Onboarding: **Restore existing vault** → download metadata → unwrap with passphrase → `saveKeyData` → pull deltas.  
Guard: refuse or warn on “create new vault” when remote vault-key already exists.

**Pros:** Matches crypto spec intent and recovery sheet.  
**Cons:** First writer wins; need rotation/rewrap policy; still need conflict rules if two devices create keys.

### B. Folder / namespace isolation per vault identity

Bind sync prefix to a vault fingerprint (e.g. hash of salt or vault id) so different vaults never see each other’s segments in one appDataFolder.

**Pros:** No decrypt collisions across resets.  
**Cons:** Orphan folders accumulate; multi-device still needs shared vault id.

### C. Soft-fail / quarantine incompatible peers

On decrypt failure: skip segment, record quarantine, surface UI (“N incompatible remote files”) instead of failing the whole pull. Offer clear/quarantine actions.

**Pros:** Partial sync keeps working.  
**Cons:** Silent data divergence if mis-applied; user may not notice missing peers.

### D. Single-origin / single-writer policy (product constraint)

Document: one browser origin is canonical; clearing cloud is required after reset; no multi-device until A ships.

**Pros:** Honest and small.  
**Cons:** Breaks the “sync everywhere” story.

### E. Origin-aware OAuth clients

Separate Google OAuth client IDs (or Drive apps) for localhost vs production so `appDataFolder` does not collide during development.

**Pros:** Stops local/prod cross-contamination.  
**Cons:** Does not fix multi-device or vault reset on the same origin.

### F. Fix misleading encryption UX

Drive badge / Settings from real `dek` / `hasKeyData()`; block or loudly warn unencrypted push when peers are encrypted (and vice versa).

**Pros:** Prevents cause (3).  
**Cons:** Does not solve DEK portability.

---

## Constraints any strategy must respect

1. **Pull filters by `crsql_site_id`**, not by “files I uploaded this session”. Peer leftovers are always in scope.
2. **One Google `appDataFolder` per OAuth client + user** — all writers share one namespace today.
3. **DEK ≠ passphrase**; without exporting wrapped DEK (+ salt), a new setup cannot read old ciphertext.
4. **GCM failure is opaque** — wrong key, plaintext, and corruption look the same unless we add envelope versioning / magic headers.
5. Clearing remote segments is **destructive to multi-device history** but safe for local data if the user re-pushes from a complete local DB.

---

## Suggested decision questions

1. Is v1 multi-device encrypted sync a hard requirement, or is single-device + cloud backup enough?
2. Should localhost and production share Drive app data?
3. On vault reset, should the app auto-clear remote segments, require confirmation, or refuse sync until the user chooses restore vs wipe?
4. Do we version sync envelopes (e.g. `MTT1` + flags) so plaintext vs encrypted failures are distinguishable without heuristics?

---

## Pointers in code

| Area | Path |
|------|------|
| Decrypt error | `src/crypto/encryption.ts` |
| Push/pull + clear remote | `src/sync/crsql-changes.ts` (`pushDeltas`, `pullDeltas`, `clearRemoteChangeSegments`) |
| Settings UI | `src/ui/components/SyncSection.tsx` |
| Vault setup (always new DEK) | `src/ui/pages/SetupWizard.tsx` |
| Key store | `src/crypto/key-store.ts` |
| Drive provider | `src/sync/providers/google-drive-provider.ts` |
| Crypto spec (key distribution note) | `.specs/features/8.4-crypto-layer/spec.md` |
| Sync spec | `.specs/features/8.5-sync-layer/spec.md` |
