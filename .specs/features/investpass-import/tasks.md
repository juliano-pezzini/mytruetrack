# InvestPass Import Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/investpass-import/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase and project guidelines (`.github/copilot-instructions.md` testing section, `vitest.config.ts` 80% thresholds, `playwright.config.ts`). Guidelines found: `.github/copilot-instructions.md`, `vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain / workers (import processor, conversion) | unit | All branches; 1:1 to spec ACs; all listed edge cases | `src/**/*.test.ts` | `npx vitest run` |
| Storage (account-map store) | unit (integration w/ fake-indexeddb) | Key paths + error handling | `src/storage/*.test.ts` | `npx vitest run` |
| Bridge client (PWA side) | unit | Happy path + error states; mocked chrome API | `src/sync/*.test.ts` | `npx vitest run` |
| Extension (service worker, API client) | unit | Happy + error paths; mocked fetch | `extension/src/**/*.test.ts` | `npx vitest run --config extension/vitest.config.ts` |
| UI pages/hooks | e2e | Happy flow + mapping prompt + summary | `e2e/investpass-import.spec.ts` | `npx playwright test` |
| Extension manifest / config | none | — (build gate only) | — | build gate only |

## Parallelism Assessment

> Generated from codebase — vitest runs tests in parallel by default; Playwright is `fullyParallel: true`.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (vitest) | Yes | Per-test fake-indexeddb + mocked deps | `fake-indexeddb/auto` import resets per suite |
| e2e (playwright) | Yes | Isolated browser contexts | `playwright.config.ts`: `fullyParallel: true` |

## Gate Check Commands

> Generated from codebase (`package.json` scripts, CI workflow).

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npm run typecheck && npx vitest run` |
| Full | After tasks with e2e tests | `npm run typecheck && npx vitest run && npx playwright test` |
| Build | After phase completion | `npm run typecheck && npx vite build && npx vitest run && npx playwright test` |

---

## Execution Plan

### Phase 1: Foundation — PWA data layer (Sequential)

Core PWA-side stores and types needed by everything else.

```
T1 → T2
```

### Phase 2: Import Engine — PWA processing (Sequential)

The conversion + import processor that feeds the existing `importTransactions`.

```
T2 → T3
```

### Phase 3: Extension Scaffold (Sequential)

New extension artifact: manifest, build config, API client.

```
T4 → T5
```

### Phase 4: Bridge + Integration (Sequential)

Connect extension ↔ PWA; wire end-to-end.

```
T3, T5 → T6 → T7
```

### Phase 5: UI + E2E (Sequential)

User-facing import page and end-to-end test.

```
T7 → T8
```

---

## Task Breakdown

### T1: Create InvestPass account-map IndexedDB store

**What**: Create the account mapping store that persists InvestPass `account.name` → mytruetrack `accountId` bindings (+ `lastImportedDate` for P2).
**Where**: `src/storage/investpass-account-map.ts`
**Depends on**: None
**Reuses**: `src/storage/import-mappings.ts` pattern (idb library, same structure)
**Requirement**: IPIMP-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Types exported: `AccountMapEntry`
- [ ] Functions: `getAccountMap`, `getMapping`, `saveMapping`, `updateLastImportedDate`, `deleteMapping`
- [ ] Unit tests with fake-indexeddb: CRUD round-trip, update lastImportedDate, delete
- [ ] Gate passes: `npm run typecheck && npx vitest run src/storage/investpass-account-map.test.ts`
- [ ] Test count: ≥5 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(storage): add InvestPass account-map store (IPIMP-04)`

---

### T2: Create InvestPass transaction zod schema + types

**What**: Define the zod schema for validating the bridge payload (`InvestPassTransaction`, `ImportPayloadSchema`) and the `InvestPassImportResult` type.
**Where**: `src/workers/investpass-types.ts`
**Depends on**: T1 (uses `AccountMapEntry` type)
**Reuses**: Existing `src/workers/types.ts` patterns
**Requirement**: IPIMP-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `InvestPassTransactionSchema` (zod) validates: id (uuid), name, date (datetime), amount (nonneg), type enum, ignored, category nullable, account.name
- [ ] `ImportPayloadSchema` wraps array of transactions
- [ ] `InvestPassImportResult` type: `{ perAccount: Record<string, ImportResult>; unmappedAccounts: string[] }`
- [ ] Unit tests: valid payload passes, missing id rejects, wrong type rejects, negative amount rejects, null category passes
- [ ] Gate passes: `npm run typecheck && npx vitest run src/workers/investpass-types.test.ts`
- [ ] Test count: ≥6 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(workers): add InvestPass transaction schema + types (IPIMP-02)`

---

### T3: Create InvestPass import processor

**What**: Convert `InvestPassTransaction[]` → `ParsedTransaction[]` split by account, route via account map, feed each slice to `importTransactions()`.
**Where**: `src/workers/investpass-import.ts`
**Depends on**: T1, T2
**Reuses**: `src/workers/import-service.ts` (dedup + persist), `ParsedTransaction` type
**Requirement**: IPIMP-03, IPIMP-05, IPIMP-06, IPIMP-07, IPIMP-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `processInvestPassImport(db, transactions, accountMap)` returns `InvestPassImportResult`
- [ ] Conversion: `type "DEBIT"→'debit'`, `"CREDIT"→'credit'`; `amount` → `Math.round(amount * 100)` cents; UTC→America/São_Paulo date
- [ ] Routes by `account.name` via map; collects unmapped accounts
- [ ] Calls `importTransactions` per mapped account with `externalId` = InvestPass UUID
- [ ] Unit tests (against in-memory sql.js DB): mapped import, dedup on re-run, unmapped account collected, timezone conversion edge case (23:30 UTC → previous day BRT), CREDIT type
- [ ] Gate passes: `npm run typecheck && npx vitest run src/workers/investpass-import.test.ts`
- [ ] Test count: ≥7 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(workers): InvestPass import processor (IPIMP-03/05/06/07/09)`

---

### T4: Create extension scaffold (manifest + build + API client)

**What**: Set up the extension directory: `manifest.json` (MV3, `externally_connectable`, permissions), Vite build config, and the InvestPass GraphQL API client (`refreshToken`, `fetchTransactions`).
**Where**: `extension/` (new directory)
**Depends on**: None
**Reuses**: Nothing (new artifact)
**Requirement**: IPIMP-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `extension/manifest.json`: MV3, `externally_connectable` with localhost + configurable prod origin, `host_permissions` for InvestPass API, `cookies` permission
- [ ] `extension/vite.config.ts`: builds service worker + popup
- [ ] `extension/src/investpass-api.ts`: `refreshToken()` → string, `fetchTransactions(token, start, end)` → InvestPassTransaction[]
- [ ] `extension/vitest.config.ts` for unit tests
- [ ] Unit tests: `fetchTransactions` with mocked fetch (success + 401 error + malformed response)
- [ ] Gate passes: `npm run typecheck` (extension tsconfig extends root) + extension tests
- [ ] Test count: ≥4 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(extension): scaffold MV3 extension + InvestPass API client (IPIMP-01)`

---

### T5: Create extension service worker (background.ts)

**What**: Extension service worker: listens for `onConnectExternal` port connections, orchestrates the import flow (receives START_IMPORT, calls API, sends IMPORT_PAYLOAD).
**Where**: `extension/src/background.ts`
**Depends on**: T4
**Reuses**: API client from T4
**Requirement**: IPIMP-01, IPIMP-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Listens on `chrome.runtime.onConnectExternal`
- [ ] Validates sender origin before processing
- [ ] On `START_IMPORT` message: calls `refreshToken` → `fetchTransactions` → sends `IMPORT_PAYLOAD`
- [ ] On error: sends `ERROR` message with code
- [ ] Unit tests: mock chrome APIs; verify sender-origin check rejects unknown origins, happy-path flow, token-error flow
- [ ] Gate passes: extension tests green
- [ ] Test count: ≥4 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(extension): service worker with bridge + sender verification (IPIMP-01/08)`

---

### T6: Create PWA bridge client

**What**: PWA-side module to connect to the companion extension via `chrome.runtime.connect`, send/receive typed messages, detect extension availability.
**Where**: `src/sync/investpass-bridge.ts`
**Depends on**: T2 (message types), T5 (extension is the other end)
**Reuses**: Pattern from `src/sync/active-provider.ts`
**Requirement**: IPIMP-08, IPIMP-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `connectToExtension(extensionId)`: returns typed port or null
- [ ] `isExtensionAvailable(extensionId)`: ping/pong check
- [ ] Validates incoming messages with zod schema (IPIMP-02)
- [ ] Guards: returns null / throws when vault is locked (IPIMP-10) or extension unavailable
- [ ] Unit tests: mock `chrome.runtime.connect`; test connect success, extension-not-found, invalid payload rejected
- [ ] Gate passes: `npm run typecheck && npx vitest run src/sync/investpass-bridge.test.ts`
- [ ] Test count: ≥5 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sync): PWA bridge client for InvestPass extension (IPIMP-08/10)`

---

### T7: Create `useInvestPassImport` hook (orchestration)

**What**: React hook that orchestrates the full import flow: connect to extension → start import → receive payload → validate → prompt for unmapped accounts → run processor → return summary.
**Where**: `src/ui/hooks/useInvestPassImport.ts`
**Depends on**: T1, T3, T6
**Reuses**: Existing hook patterns (`useTransactions`, `useAccountBalance`)
**Requirement**: IPIMP-03, IPIMP-09, IPIMP-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Hook exposes: `status`, `summary`, `unmappedAccounts`, `startImport(period)`, `mapAccount(investPassName, accountId)`
- [ ] Serializes concurrent imports (single `importing` flag)
- [ ] Blocks when vault locked
- [ ] Unit tests (mock bridge + mock DB): happy flow returns summary, unmapped account halts until mapped, concurrent-call rejection
- [ ] Gate passes: `npm run typecheck && npx vitest run src/ui/hooks/useInvestPassImport.test.ts`
- [ ] Test count: ≥4 tests pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): useInvestPassImport orchestration hook (IPIMP-03/09/10)`

---

### T8: Create InvestPass Import page + E2E test

**What**: UI page with extension-connection status, period picker, account-mapping prompts, import progress, and per-account summary display. Plus an E2E test covering the happy path with a mocked extension bridge.
**Where**: `src/ui/pages/InvestPassImportPage.tsx`, `e2e/investpass-import.spec.ts`
**Depends on**: T7
**Reuses**: Existing page patterns (DashboardPage, component library)
**Requirement**: IPIMP-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Page shows: connection status, period selector, mapping prompts for unknown accounts, import button, per-account summary
- [ ] Route added to router
- [ ] E2E test: with mocked extension bridge (inject via page.addInitScript), imports transactions, verifies summary shown with correct counts
- [ ] Gate passes: `npm run typecheck && npx vitest run && npx playwright test e2e/investpass-import.spec.ts`
- [ ] Test count: ≥2 e2e tests pass

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): InvestPass import page + e2e (IPIMP-09)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential):
  T2 ──→ T3

Phase 3 (Sequential, PARALLEL with Phase 2):
  T4 ──→ T5

Phase 4 (Sequential, after Phase 2+3):
  T3 + T5 ──→ T6 ──→ T7

Phase 5 (Sequential, after Phase 4):
  T7 ──→ T8
```

**Cross-phase parallelism:** Phases 2 and 3 can execute simultaneously (T3 and T4→T5 have no dependency on each other).

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start of Phase 1 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1, T2 | T2 → T3 | ✅ Match |
| T4 | None | Start of Phase 3 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T2, T5 | T3 + T5 → T6 | ✅ Match (T6 uses types from T2 and extension from T5; T3 is a sibling not a dep) |
| T7 | T1, T3, T6 | T6 → T7 | ✅ Match (T1 and T3 are transitive through T6's deps) |
| T8 | T7 | T7 → T8 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: Account-map store | Storage | unit | unit | ✅ OK |
| T2: Zod schema + types | Workers (domain-adjacent) | unit | unit | ✅ OK |
| T3: Import processor | Workers | unit | unit | ✅ OK |
| T4: Extension scaffold + API client | Extension | unit | unit | ✅ OK |
| T5: Extension service worker | Extension | unit | unit | ✅ OK |
| T6: PWA bridge client | Bridge (sync layer) | unit | unit | ✅ OK |
| T7: Orchestration hook | UI hooks | unit | unit | ✅ OK |
| T8: Import page + E2E | UI pages | e2e | e2e | ✅ OK |

---

## Traceability

| Task | Requirements |
| ---- | ------------ |
| T1 | IPIMP-04 |
| T2 | IPIMP-02 |
| T3 | IPIMP-03, IPIMP-05, IPIMP-06, IPIMP-07, IPIMP-09 |
| T4 | IPIMP-01 |
| T5 | IPIMP-01, IPIMP-08 |
| T6 | IPIMP-08, IPIMP-10 |
| T7 | IPIMP-03, IPIMP-09, IPIMP-10 |
| T8 | IPIMP-09 |

**Coverage check**: All P1 requirements (IPIMP-01 through IPIMP-10) are covered. P2 (IPIMP-11..13) deferred — `lastImportedDate` field in T1 enables it but the incremental logic is a follow-up. P3 (IPIMP-14) out of scope for this task set.
