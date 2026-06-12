# Auto-Sync Specification

## Problem Statement

Sync is currently manual — users must navigate to Settings and click Push/Pull. This creates friction and risk: data can be lost if the user forgets to push, and stale data lingers if they forget to pull. Sync should be automatic and invisible.

## Goals

- [ ] Pull remote data automatically when the app loads (before the user sees stale data)
- [ ] Push local changes automatically after any data write (debounced to batch rapid edits)
- [ ] Retry failed pushes when connectivity returns
- [ ] Keep manual push/pull buttons as fallback

## Out of Scope

| Feature | Reason |
|---|---|
| Lock/logout action | User chose to defer (no lock vault button for now) |
| Real-time multi-device conflict resolution | CRDT handles conflicts; auto-sync just triggers push/pull more often |
| Periodic background sync (timers) | Debounced-on-write + pull-on-load is sufficient |
| Push on browser close/`beforeunload` | Unreliable in browsers; debounced push covers it |

---

## User Stories

### P1: Auto-pull on app load ⭐ MVP

**User Story**: As a user, I want my app to automatically pull the latest data from the cloud when it loads, so I always see up-to-date data without navigating to Settings.

**Why P1**: Stale data on load is the most visible sync problem — user opens app on device B and sees yesterday's data.

**Acceptance Criteria**:

1. WHEN the app loads and a cloud provider is configured THEN the system SHALL automatically pull remote data after the database is initialized
2. WHEN auto-pull succeeds THEN the system SHALL update `lastPulledAt` in sync state
3. WHEN auto-pull fails (network error, 401, etc.) THEN the system SHALL log the error silently without blocking the UI — the user can still use local data
4. WHEN no cloud provider is configured THEN the system SHALL skip auto-pull entirely

**Independent Test**: Configure Google Drive, push data from device A, open app on device B — data appears without manual pull.

---

### P1: Auto-push on data writes ⭐ MVP

**User Story**: As a user, I want my changes to automatically sync to the cloud after I save anything, so I don't have to remember to push.

**Why P1**: Forgetting to push means data loss risk if the device is lost/reset.

**Acceptance Criteria**:

1. WHEN a record is created, updated, or deleted (accounts, transactions, categories, tags) AND a cloud provider is configured THEN the system SHALL schedule a debounced push
2. WHEN the debounce period (5 seconds) elapses with no new writes THEN the system SHALL execute the push
3. WHEN a new write occurs during the debounce period THEN the system SHALL reset the timer (coalesce rapid writes into a single push)
4. WHEN auto-push succeeds THEN the system SHALL update `lastPushedAt` in sync state
5. WHEN auto-push fails THEN the system SHALL mark the push as pending for retry

**Independent Test**: Create a transaction, wait 5 seconds — `lastPushedAt` updates without visiting Settings.

---

### P1: Offline retry ⭐ MVP

**User Story**: As a user, I want failed pushes to retry automatically when I come back online, so I don't lose changes made offline.

**Why P1**: PWA users expect offline-first resilience.

**Acceptance Criteria**:

1. WHEN an auto-push fails (network error) THEN the system SHALL mark a pending push flag
2. WHEN the browser fires an `online` event AND a pending push exists THEN the system SHALL trigger a push
3. WHEN the retry push succeeds THEN the system SHALL clear the pending flag and update `lastPushedAt`
4. WHEN the retry push fails THEN the system SHALL keep the pending flag (will retry on next online event or next write)

**Independent Test**: Go offline, create a transaction, go online — push happens automatically.

---

### P2: Sync status indicator

**User Story**: As a user, I want a subtle indicator showing sync status so I know whether my data is safely backed up.

**Why P2**: Not blocking, but gives confidence. Can ship after core auto-sync works.

**Acceptance Criteria**:

1. WHEN a push is in progress THEN the system SHALL show a syncing indicator in the layout header
2. WHEN sync is idle and up-to-date THEN the system SHALL show a synced indicator (or nothing)
3. WHEN there is a pending push (failed/offline) THEN the system SHALL show a pending indicator

**Independent Test**: Create a transaction — see syncing → synced transition in header.

---

## Edge Cases

- WHEN app loads and auto-pull returns encrypted data but no DEK is available THEN system SHALL skip the pull silently (local-only mode pulling encrypted remote data is a config mismatch — don't crash)
- WHEN multiple writes happen in rapid succession (<5s apart) THEN system SHALL coalesce into a single push
- WHEN auto-push is already in flight and a new write occurs THEN system SHALL schedule another push after the current one completes
- WHEN the cloud provider is changed in Settings THEN system SHALL reset any pending push state
- WHEN the user clicks manual Push/Pull in Settings THEN system SHALL work as before (independent of auto-sync)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ASYNC-01 | P1: Auto-pull on app load | Design | Pending |
| ASYNC-02 | P1: Auto-pull error handling | Design | Pending |
| ASYNC-03 | P1: Debounced auto-push | Design | Pending |
| ASYNC-04 | P1: Push coalescing | Design | Pending |
| ASYNC-05 | P1: Pending push on failure | Design | Pending |
| ASYNC-06 | P1: Online retry | Design | Pending |
| ASYNC-07 | P2: Sync status indicator | - | Pending |

**Coverage:** 7 total, 0 mapped to tasks, 7 unmapped

---

## Success Criteria

- [ ] User opens app → data is current without manual action
- [ ] User creates/edits/deletes any record → data syncs within ~5 seconds
- [ ] User goes offline, makes changes, comes back → changes sync automatically
- [ ] Manual push/pull still works as fallback
- [ ] No visible errors or spinners blocking the UI during auto-sync
