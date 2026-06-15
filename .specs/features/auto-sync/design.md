# Auto-Sync Design

## Overview

Auto-sync adds pull-on-load, debounced push-on-write, and online-retry on top of the existing
manual `pushChanges` / `pullChanges` engine. No changes to the encryption or snapshot format.

The design layers a **framework-agnostic controller** (testable with fake timers) under a thin
**React provider** that wires it to the live database, vault DEK, cloud config, and browser events.

```
┌──────────────────────────────────────────────────────────────┐
│ AutoSyncProvider (React)                                       │
│  - reads db (useDatabase), dek (useVault)                      │
│  - getProvider() = resolveActiveProvider(loadSyncConfig())     │
│  - runs pullOnLoad() once when db+config ready                 │
│  - window 'online' → controller.retryPending()                 │
│  - exposes { status, notifyChange } via context                │
│        │                                                       │
│        ▼                                                       │
│  createAutoSyncController({ getProvider, push, pull, ... })    │
│   - debounce timer (5s), inFlight, rerunAfter, pending flags   │
└──────────────────────────────────────────────────────────────┘
        ▲                                   ▲
   useAutoSync().notifyChange()        SyncStatusIndicator (Layout)
   called by data hooks after writes   reads status
```

## Components

### `src/sync/active-provider.ts` — `resolveActiveProvider(config)`

Extracts the "build a `CloudProvider` from `SyncConfig`" logic currently inline in `SyncSection`,
including Google token refresh via `ensureValidGoogleTokens`. Pure/async, no React, no persistence.

Returns a discriminated union:

- `{ kind: 'none' }` — no provider configured (skip sync)
- `{ kind: 'ok', provider, config }` — usable provider; `config` may carry refreshed Google tokens
- `{ kind: 'reconnect' }` — Google session expired; interactive reconnect needed

`SyncSection` is refactored to delegate to this (DRY; one source of truth for token refresh).

### `src/sync/auto-sync-engine.ts` — `createAutoSyncController(deps)`

Framework-agnostic. Deps: `getProvider`, `push(provider)`, `pull(provider)`, `onStatusChange?`,
`debounceMs?` (default `5000`).

State flags: `inFlight`, `rerunAfter` (write arrived during a push), `pending` (last push failed).
Status derivation: `syncing` if `inFlight`, else `pending` if `pending`, else `idle`.

API:

- `pullOnLoad()` — `ASYNC-01/02`: resolve provider; if none, no-op. Pull; on error log silently.
- `notifyChange()` — `ASYNC-03/04`: (re)arm the debounce timer; on fire → `flush()`.
- `retryPending()` — `ASYNC-06`: if `pending` and not `inFlight`, push now.
- `dispose()` — clear timer.

Push lifecycle (`ASYNC-03/04/05`, edge "in-flight + new write"):

1. `flush()`: if `inFlight` set `rerunAfter=true` and return; else `doPush()`.
2. `doPush()`: `inFlight=true`; resolve provider (none → bail). `push()`. On success `pending=false`;
   on failure `pending=true`. Finally `inFlight=false`; if `rerunAfter`, clear it and `doPush()` again.

### `src/app/auto-sync-provider.tsx` + `src/ui/hooks/useAutoSync.ts`

Provider builds the controller once (per db/dek), runs `pullOnLoad`, registers the `online`
listener, and exposes `{ status, notifyChange }`. `useAutoSync` reads the context with a safe
no-op default so hook unit tests work without the provider.

`getProvider` loads config, calls `resolveActiveProvider`, persists refreshed Google tokens, and
returns the `CloudProvider` (or `null` for `none`/`reconnect`).

### Data-hook wiring

`useAccounts`, `useTransactions`, `useCategories`, `useTags` call `notifyChange()` after each
create/update/remove (`ASYNC-03`).

### `src/ui/components/SyncStatusIndicator.tsx` (P2 — `ASYNC-07`)

Small header element in `Layout`: shows syncing/pending/synced based on `useAutoSync().status`.

## Edge cases (from spec)

- Encrypted remote + no DEK on load → `pullChanges` throws; controller catches and logs silently.
- Rapid writes (<5s) → debounce coalesces into one push.
- Write during in-flight push → `rerunAfter` schedules a follow-up push.
- No provider → all auto-sync paths no-op.
- Manual push/pull in Settings → unchanged.
