# Phase 8.1 — Architecture Spike Tasks

**Spec**: `.specs/features/8.1-architecture-spike/spec.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Scaffold the spike project so all prototypes share one build.

```
T1
```

### Phase 2: Spike Prototypes (Parallel)

Each spike is independent — they test different bets with different libraries.

```
     ┌→ T2 (cr-sqlite)  ─┐
     ├→ T3 (crypto+auth) ─┤
T1 ──┼→ T4 (Drive CRUD)  ─┼──→ T6
     └→ T5 (OFX parsing) ─┘
```

### Phase 3: Measurement & Report (Sequential)

Bundle size requires all spike code present. Report summarizes everything.

```
T6 → T7
```

---

## Task Breakdown

### T1: Scaffold Vite + TypeScript spike project

**What**: Create a minimal Vite + TypeScript project in `spikes/` with all dependencies needed across the five spikes. No UI — just enough to build, serve, and run throwaway prototypes.
**Where**: `spikes/` (new directory at repo root)
**Depends on**: None
**Reuses**: None
**Requirement**: Spike prerequisite

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `spikes/` contains a Vite + TypeScript project (`package.json`, `tsconfig.json`, `vite.config.ts`)
- [ ] Dependencies installed: `@sqlite.org/sqlite-wasm`, `@vlcn.io/crsqlite-wasm`, `idb`, `ofx-js`
- [ ] `vite build` succeeds with no errors
- [ ] `vite dev` serves a blank page with no console errors
- [ ] SQLite-WASM OPFS/memory backend initializes in a test script

**Tests**: none (spike — no production code)
**Gate**: `cd spikes && npm run build`

**Commit**: `spike: scaffold vite project for architecture spike`

---

### T2: Spike A — cr-sqlite two-instance CRDT sync [P]

**What**: Prototype two browser instances writing to independent cr-sqlite databases, exporting CRDT change-sets as blobs, exchanging them, and verifying convergent state. Measure cr-sqlite + sqlite-wasm gzipped bundle size.
**Where**: `spikes/src/spike-a-crsqlite.ts`
**Depends on**: T1
**Reuses**: None
**Requirement**: Spike A (spec.md)

**Tools**:
- MCP: `context7` (cr-sqlite API docs)
- Skill: NONE

**Done when**:
- [ ] Two in-memory cr-sqlite instances created, each with a shared-schema table (e.g. `transactions`)
- [ ] Both instances independently insert/update/delete rows
- [ ] Change-set blobs exported from each, applied to the other
- [ ] Final state is identical on both instances (convergence assertion logged)
- [ ] Arbitrary write/sync orderings tested (at least 3 scenarios)
- [ ] Bundle size of `@vlcn.io/crsqlite-wasm` + `@sqlite.org/sqlite-wasm` measured (gzipped) and logged
- [ ] Library activity checked (last commit/release date noted)
- [ ] Go / no-go / caveats verdict written as a comment at top of file

**Tests**: none (spike)
**Gate**: run in browser, check console output for convergence + size

**Commit**: `spike: cr-sqlite CRDT sync prototype (Spike A)`

---

### T3: Spike B — Passphrase + WebAuthn key management [P]

**What**: Prototype the full key-management flow: passphrase → KEK derivation (PBKDF2, and Argon2 if feasible) → generate DEK (AES-GCM) → wrap DEK with KEK → store in IndexedDB → register WebAuthn platform credential → on unlock: WebAuthn assertion + `prf` extension (or fallback) → unwrap DEK → encrypt/decrypt a 5 MB sample blob. Test on available platform authenticator (Windows Hello).
**Where**: `spikes/src/spike-b-crypto-auth.ts`
**Depends on**: T1
**Reuses**: None
**Requirement**: Spike B (spec.md)

**Tools**:
- MCP: `context7` (Web Crypto API, WebAuthn)
- Skill: NONE

**Done when**:
- [ ] PBKDF2 key derivation from passphrase works (KEK)
- [ ] AES-GCM DEK generated, wrapped with KEK, stored in IndexedDB (via `idb`)
- [ ] WebAuthn registration succeeds with platform authenticator
- [ ] WebAuthn assertion succeeds and produces credential
- [ ] `prf` extension tested; fallback path documented if unsupported
- [ ] DEK unwrapped after auth; 5 MB blob encrypt → decrypt round-trip verified
- [ ] Round-trip latency measured and logged (target < 500 ms)
- [ ] Argon2-WASM feasibility assessed (bundle size, API)
- [ ] Go / no-go / caveats verdict written as a comment at top of file

**Tests**: none (spike)
**Gate**: run in browser (Chrome + Windows Hello), check console output

**Commit**: `spike: passphrase + WebAuthn key management prototype (Spike B)`

---

### T4: Spike C — Google Drive `appDataFolder` CRUD [P]

**What**: Prototype OAuth 2.0 PKCE flow for Google Drive, then perform full CRUD (upload, download, list, delete) against `appDataFolder` using only the `drive.appdata` scope. Measure round-trip latency and document quota/file-count limits.
**Where**: `spikes/src/spike-c-gdrive.ts`
**Depends on**: T1
**Reuses**: None
**Requirement**: Spike C (spec.md)

**Tools**:
- MCP: `context7` (Google Drive REST API v3)
- Skill: NONE

**Prerequisites (user action)**:
- Google Cloud project created with Drive API enabled
- OAuth 2.0 client ID configured for SPA (authorized JS origin: `http://localhost:5173`)
- Client ID provided as env var or hardcoded in spike code

**Done when**:
- [ ] OAuth 2.0 PKCE flow completes in browser (no client secret)
- [ ] 1 MB blob uploaded to `appDataFolder`
- [ ] Downloaded and checksum verified (matches upload)
- [ ] List files returns the uploaded file
- [ ] File deleted successfully
- [ ] Round-trip latency logged
- [ ] Quota / file-count limits documented (from Google docs)
- [ ] Verified `drive.appdata` scope is sufficient (no broad Drive access)
- [ ] Go / no-go / caveats verdict written as a comment at top of file

**Tests**: none (spike)
**Gate**: run in browser, observe OAuth flow + CRUD console output

**Commit**: `spike: Google Drive appDataFolder CRUD prototype (Spike C)`

---

### T5: Spike D — OFX parsing with ofx-js [P]

**What**: Copy OFX fixture files from v1 repo, parse them with `ofx-js`, and verify transaction count, dates, amounts, and account IDs match expected values. Measure bundle size.
**Where**: `spikes/src/spike-d-ofx.ts`, `spikes/fixtures/` (OFX files)
**Depends on**: T1
**Reuses**: v1 OFX fixtures from `truetrack` repo
**Requirement**: Spike D (spec.md)

**Tools**:
- MCP: NONE
- Skill: NONE

**Prerequisites (user action)**:
- Access to v1 `truetrack` repo fixtures (`workspace/tests/fixtures/`)

**Done when**:
- [ ] v1 OFX fixture files copied to `spikes/fixtures/`
- [ ] `ofx-js` parses each fixture without errors
- [ ] Transaction count, dates, amounts, account IDs extracted and logged
- [ ] Results compared against expected values (from v1 test expectations)
- [ ] `ofx-js` gzipped bundle size measured (target < 100 KB)
- [ ] Library maintenance status checked (last release date)
- [ ] Go / no-go / caveats verdict written as a comment at top of file

**Tests**: none (spike)
**Gate**: run in browser or Node, check parsed output against expected

**Commit**: `spike: OFX parsing prototype (Spike D)`

---

### T6: Spike E — Combined bundle size measurement

**What**: Build the spike project with all dependencies included and measure total gzipped bundle size. Identify candidates for lazy-loading if over budget. Target: < 2 MB gzipped for critical path.
**Where**: `spikes/` (build output analysis)
**Depends on**: T2, T3, T4, T5
**Reuses**: None
**Requirement**: Spike E (spec.md)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `vite build` with all spike code succeeds
- [ ] Total gzipped size measured (e.g., via `vite-plugin-compression` or `gzip -k` on output)
- [ ] Per-dependency size breakdown logged (sqlite-wasm, cr-sqlite, crypto, ofx-js, idb)
- [ ] Budget verdict: under/over 2 MB gzipped
- [ ] If over: lazy-load candidates identified with projected critical-path size
- [ ] Go / no-go / caveats verdict written as a comment or in build log

**Tests**: none (spike)
**Gate**: `cd spikes && npm run build` + size analysis

**Commit**: `spike: combined bundle size measurement (Spike E)`

---

### T7: Write spike-report.md with verdicts

**What**: Summarize all five spike verdicts (go / no-go / go-with-caveats) with evidence (measurements, screenshots, logs). Record any stack adjustments. Update STATE.md with AD-004.
**Where**: `.specs/features/8.1-architecture-spike/spike-report.md`, `.specs/project/STATE.md`
**Depends on**: T2, T3, T4, T5, T6
**Reuses**: Verdict comments from T2–T6
**Requirement**: Definition of Done (spec.md)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `spike-report.md` contains verdict + evidence for each of the 5 spikes
- [ ] Any stack changes reflected in PROJECT.md
- [ ] AD-004 recorded in STATE.md with final stack choices
- [ ] Spike code retained in `spikes/` folder (or pruned if not useful)
- [ ] spec.md Definition of Done checklist fully checked off

**Tests**: none (documentation)
**Gate**: all DoD items from spec.md checked

**Commit**: `spike: architecture spike report and stack decisions (Phase 8.1)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel):
  T1 complete, then:
    ├── T2 [P]  (cr-sqlite)
    ├── T3 [P]  (crypto + WebAuthn)
    ├── T4 [P]  (Google Drive)     } Can run simultaneously
    └── T5 [P]  (OFX parsing)

Phase 3 (Sequential):
  T2, T3, T4, T5 complete, then:
    T6 → T7
```

**Parallelism notes:**
- T2–T5 are fully independent spikes with no shared state
- T6 needs all spike code present to measure combined bundle
- T7 needs all verdicts to write the report
- No TESTING.md exists (greenfield); no test parallelism concerns

---

## Validation

### Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Scaffold spike project | 1 project scaffold | ✅ Granular |
| T2: cr-sqlite CRDT sync | 1 prototype (1 file) | ✅ Granular |
| T3: Passphrase + WebAuthn | 1 prototype (1 file, 1 flow) | ⚠️ Acceptable — single flow spanning crypto + auth, tightly coupled |
| T4: Google Drive CRUD | 1 prototype (1 file) | ✅ Granular |
| T5: OFX parsing | 1 prototype (1 file + fixtures) | ✅ Granular |
| T6: Bundle size measurement | 1 measurement task | ✅ Granular |
| T7: Write spike report | 1 document | ✅ Granular |

### Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|------|------------------------|---------------|--------|
| T1 | None | No incoming arrows | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T2, T3, T4, T5 | T2, T3, T4, T5 → T6 | ✅ Match |
| T7 | T2, T3, T4, T5, T6 | T6 → T7 | ⚠️ Partial — body says T2–T6, diagram shows only T6 → T7 |

**Fix for T7**: The diagram shows `T6 → T7` which implies T7 only depends on T6. Since T6 already depends on T2–T5, this is transitively correct. However, T7 directly uses outputs from T2–T5 (verdict comments), so the explicit dependency is accurate in the body. The diagram is simplified but not incorrect — T7 cannot start until T6 finishes, which already gates on T2–T5. **✅ Consistent (transitive).**

### Test Co-location Validation

No TESTING.md exists. All tasks produce spike/throwaway code with no production test requirements. `Tests: none` is valid for all tasks.

| Task | Code Layer | Matrix Requires | Task Says | Status |
|------|-----------|----------------|-----------|--------|
| T1 | Spike scaffold | N/A (no matrix) | none | ✅ OK |
| T2 | Spike prototype | N/A | none | ✅ OK |
| T3 | Spike prototype | N/A | none | ✅ OK |
| T4 | Spike prototype | N/A | none | ✅ OK |
| T5 | Spike prototype | N/A | none | ✅ OK |
| T6 | Measurement | N/A | none | ✅ OK |
| T7 | Documentation | N/A | none | ✅ OK |
