# Phase 8.1 — Architecture Spike Report

**Date:** 2026-06-04
**Status:** Complete — all 5 spikes executed

---

## Spike A — cr-sqlite Multi-Instance CRDT Sync

**Verdict: ✅ GO**

### Evidence

| Scenario | Result |
|----------|--------|
| Independent inserts (4 rows, both sides) | ✅ Converged |
| Concurrent update to same row (LWW) | ✅ Converged — last-write-wins deterministic |
| Delete on one side, update on other | ✅ Converged — delete wins |

### Measurements

| Metric | Value |
|--------|-------|
| cr-sqlite WASM (includes SQLite) | 1,735 KB raw / **625 KB gzipped** |
| API learning curve | Low — SQL-based (`crsql_as_crr`, `crsql_changes` table) |
| Library | `@vlcn.io/crsqlite-wasm` v0.16.0 |

### Constraints Discovered

- **Schema rule:** Non-PK columns with `NOT NULL` must have a `DEFAULT` value. cr-sqlite requires this for forward/backward compatibility between schema versions. Bare `NOT NULL` without `DEFAULT` is rejected at `crsql_as_crr()` time.
- **Sync model:** Change-sets are exported via `SELECT * FROM crsql_changes WHERE db_version > ?` and applied via `INSERT INTO crsql_changes`. Simple blob exchange pattern — fits well with cloud provider upload/download.
- **Delete semantics:** In a delete-vs-update conflict, delete wins. This is the expected behavior for our use case (explicit user action takes precedence).

### Risks

- The `vlcn-io/cr-sqlite` project should be monitored for maintenance activity. Check GitHub for recent commits/releases before Phase 8.3.
- `@sqlite.org/sqlite-wasm` is bundled inside cr-sqlite's WASM — the separate `@sqlite.org/sqlite-wasm` npm dependency is redundant and can be removed if cr-sqlite is the only SQLite consumer.

---

## Spike B — Passphrase + WebAuthn Key Management

**Verdict: ✅ GO (with caveat on PRF)**

### Evidence

| Step | Result |
|------|--------|
| PBKDF2 key derivation (600k iterations) | ✅ |
| AES-GCM DEK generation | ✅ |
| DEK wrapped with KEK (AES-KW) | ✅ (40 bytes) |
| Wrapped DEK stored in IndexedDB (via `idb`) | ✅ |
| DEK unwrapped from passphrase | ✅ |
| 5 MB encrypt/decrypt round-trip | ✅ |
| WebAuthn registration (Windows Hello) | ✅ |
| WebAuthn assertion | ✅ |
| PRF extension | ⚠️ Not supported |

### Measurements

| Metric | Value |
|--------|-------|
| 5 MB encrypt | 8.1 ms |
| 5 MB decrypt | 7.1 ms |
| 5 MB round-trip | **15.2 ms** (target < 500 ms) |

### Caveat: PRF Extension

The WebAuthn `prf` extension is not yet supported on the test platform (Chrome + Windows Hello). This means biometric authentication can verify the user's identity but **cannot produce a cryptographic key** from the biometric signal.

**Fallback architecture:**
1. User enters passphrase → derives KEK → unwraps DEK (always works)
2. Optionally, after passphrase unlock, store the unwrapped DEK in a session-scoped non-extractable Web Crypto key
3. WebAuthn assertion gates access to the session key (biometric confirms "you are the same person who entered the passphrase earlier this session")
4. When PRF support lands broadly, upgrade to derive KEK from PRF output (true biometric-only unlock)

This fallback is acceptable — the user enters the passphrase once per device trust session, and biometric handles subsequent unlocks within that session.

### Argon2 Assessment

| Option | Bundle Size | Notes |
|--------|------------|-------|
| PBKDF2 (Web Crypto native) | 0 KB | 600k iterations, good baseline |
| `hash-wasm` (Argon2) | ~80 KB | Better resistance to GPU attacks |
| `argon2-browser` | ~200 KB | More established but larger |

**Recommendation:** Ship with PBKDF2. Add Argon2 as optional upgrade if bundle budget allows (budget is healthy — see Spike E).

---

## Spike C — Google Drive `appDataFolder` CRUD

**Verdict: ✅ GO**

### Evidence

| Operation | Result | Latency |
|-----------|--------|---------|
| OAuth 2.0 (implicit flow, SPA) | ✅ | — |
| Upload 1 MB to `appDataFolder` | ✅ | 2,158 ms |
| Download + checksum verify | ✅ | 1,463 ms |
| List files | ✅ (1 file returned) | — |
| Delete file | ✅ | — |
| Total round-trip (upload + download) | — | 3,621 ms |

### Quota & Limits

| Limit | Value | Concern? |
|-------|-------|----------|
| Storage | Shared with user's Drive (15 GB free) | No — our data is < 100 MB |
| File count | No separate limit | No |
| API rate | 12,000 queries/day | No — sync is infrequent |
| Scope | `drive.appdata` only — no broad Drive access | ✅ Privacy-safe |
| Visibility | App data invisible in Drive UI | ✅ |

### Notes for Production

- Use **authorization code + PKCE** flow (not implicit) for production. Implicit was used in the spike for simplicity.
- No client secret needed for SPA OAuth — PKCE replaces it.
- Latency is network-bound and acceptable for background sync (not blocking UI).
- Google Cloud project needs Drive API enabled + OAuth consent screen configured with test users (or verified for production).

---

## Spike D — OFX Parsing

**Verdict: ✅ GO**

### Evidence

| Test | Result |
|------|--------|
| Bank statement (OFX 1.x SGML, 3 transactions) | ✅ All fields parsed correctly |
| Credit card statement (OFX 1.x SGML, 2 transactions) | ✅ Including negative balance |
| Transaction fields (TRNTYPE, DTPOSTED, TRNAMT, FITID, NAME, MEMO) | ✅ |
| Account fields (BANKID, ACCTID, ACCTTYPE, CCACCTFROM) | ✅ |
| Ledger balance (BALAMT, DTASOF) | ✅ |
| Currency (CURDEF) | ✅ |

### Measurements

| Metric | Value |
|--------|-------|
| `ofx-js` bundle | ~15 KB (uncompressed) |
| Dependencies | Zero |
| TypeScript types | ✅ Ships `.d.ts` |
| Format support | OFX 1.x (SGML) + OFX 2.x (XML) |

### Notes

- v1 fixture files were not found in the local `truetrack` repo. Inline sample OFX data was used instead. When actual bank/card OFX files are available, re-validate.
- Library version 1.1.1. Check npm for maintenance status periodically.
- Bundle size is negligible (well under 100 KB target).

---

## Spike E — Combined Bundle Size

**Verdict: ✅ GO — well under budget**

### Measurements

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `crsqlite.wasm` (SQLite + CRDT engine) | 1,735 KB | 625 KB |
| `index.js` (all JS: cr-sqlite, ofx-js, idb, crypto, Drive) | 101 KB | 32 KB |
| **Total spike bundle** | **1,836 KB** | **657 KB** |

**Budget: < 2 MB gzipped. Actual: 657 KB (33% of budget).**

### Remaining Budget for Production

| Addition | Estimated Gzipped Size |
|----------|----------------------|
| React + React DOM | ~45 KB |
| React Router | ~15 KB |
| Tailwind CSS (purged) | ~10 KB |
| Chart library (e.g., lightweight) | ~30–50 KB |
| App code | ~50–100 KB |
| **Projected total** | **~850–900 KB** |

Plenty of headroom. No lazy-loading needed for the critical path.

### Optimization Note

`@sqlite.org/sqlite-wasm` was installed as a direct dependency but is **not used** — cr-sqlite bundles its own SQLite WASM. It can be removed from `package.json` in the production app, though it has no impact on bundle size (tree-shaken if unused).

---

## Stack Adjustments

No stack changes required. All bets validated. Minor adjustments:

1. **Schema convention:** All non-PK columns in CRR tables must use `DEFAULT` values (cr-sqlite requirement)
2. **Crypto baseline:** PBKDF2 at 600k iterations (Argon2 deferred as optional upgrade)
3. **WebAuthn unlock:** Passphrase-first with session-scoped biometric re-auth (PRF-based upgrade when platform support lands)
4. **OAuth flow:** Production must use authorization code + PKCE (not implicit)

---

## Go / No-Go Summary

| Spike | Verdict | Key Metric |
|-------|---------|------------|
| A — cr-sqlite CRDT | ✅ Go | 3/3 convergence scenarios pass; 625 KB gzip |
| B — Crypto + WebAuthn | ✅ Go (caveat) | 15 ms for 5 MB; PRF not yet supported |
| C — Google Drive | ✅ Go | Full CRUD works; `drive.appdata` scope sufficient |
| D — OFX parsing | ✅ Go | All fields parsed; 15 KB bundle |
| E — Bundle size | ✅ Go | 657 KB gzip (33% of 2 MB budget) |

**Overall: ✅ Proceed to Phase 8.2 (Domain Port)**
