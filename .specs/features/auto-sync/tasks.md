# Auto-Sync Tasks

| Task | Requirement | Status |
|---|---|---|
| T1 | `resolveActiveProvider` + test | Done |
| T2 | `createAutoSyncController` engine + test | Done |
| T3 | `AutoSyncProvider` + `useAutoSync` hook | Done |
| T4 | Wire provider into `App`, refactor `SyncSection` to reuse resolver | Done |
| T5 | Wire `notifyChange` into data hooks | Done |
| T6 | `SyncStatusIndicator` in `Layout` | Done |

---

## T1 — Shared active-provider resolver

- **What:** Extract provider-build + Google token refresh into `resolveActiveProvider(config)`.
- **Where:** `src/sync/active-provider.ts` (+ `.test.ts`)
- **Reuses:** `createWebDavProvider`, `createGoogleDriveProvider`, `ensureValidGoogleTokens`
- **Done when:** Returns `none` / `ok` (with possibly-refreshed config) / `reconnect` correctly.
- **Tests:** webdav ok, google ok (no refresh), google ok (refreshed config differs), google
  expired→reconnect, no provider→none.
- **Gate:** quick

## T2 — Auto-sync controller engine

- **What:** `createAutoSyncController(deps)` with debounce, coalesce, in-flight rerun, pending retry.
- **Where:** `src/sync/auto-sync-engine.ts` (+ `.test.ts`)
- **Reuses:** —
- **Done when:** ASYNC-03/04/05/06 satisfied; status transitions emitted.
- **Tests (fake timers):** debounced single push; coalesce rapid writes; pull-on-load no-op when no
  provider; pull error swallowed; push failure sets pending; retryPending pushes; write during
  in-flight reruns after completion.
- **Gate:** quick

## T3 — React provider + hook

- **What:** `AutoSyncProvider` (pull-on-load, online listener, context) + `useAutoSync`.
- **Where:** `src/app/auto-sync-provider.tsx`, `src/ui/hooks/useAutoSync.ts`
- **Depends on:** T1, T2
- **Done when:** Provides `{ status, notifyChange }`; no-op default outside provider.
- **Gate:** quick (typecheck/lint)

## T4 — App wiring + SyncSection refactor

- **What:** Mount `AutoSyncProvider` inside `DatabaseProvider`; refactor `SyncSection.getActiveProvider`
  to call `resolveActiveProvider`.
- **Where:** `src/App.tsx`, `src/ui/components/SyncSection.tsx`
- **Depends on:** T1, T3
- **Done when:** Manual sync still works; auto-sync active.
- **Gate:** full

## T5 — Data-hook wiring

- **What:** Call `notifyChange()` after writes in `useAccounts/useTransactions/useCategories/useTags`.
- **Where:** those four hooks
- **Depends on:** T3
- **Gate:** full

## T6 — Status indicator

- **What:** `SyncStatusIndicator` in `Layout` header.
- **Where:** `src/ui/components/SyncStatusIndicator.tsx`, `src/ui/components/Layout.tsx`
- **Depends on:** T3
- **Gate:** quick
