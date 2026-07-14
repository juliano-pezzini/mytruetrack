# Database Wipe (Settings) Specification

## Problem Statement

There is no way for a user to erase their financial data. The existing "Reset vault" only
clears crypto keys + the `vault-skipped` flag, leaving the encrypted SQLite data physically
present (just unreadable). Users who want a genuine fresh start — or to abandon the app on a
device — have no supported path, and any residual encrypted data lingers.

## Goals

- [ ] Let a user delete **all** financial data from a Settings action, with proper
      confirmation friction.
- [ ] Offer two distinct destructive operations: **Clear all data** (keep vault, stay
      unlocked on an empty app) and **Full reset** (destroy data + identity, restart
      onboarding).
- [ ] When sync is enabled, "Clear all data" propagates deletion to other devices via
      cr-sqlite CRR tombstones (no orphaned data on peers).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Selective wipe (per-account / per-date-range) | Different feature; this is an all-or-nothing reset. |
| Explicit deletion of cloud change-files/blobs | CRR tombstones propagate deletion; managing remote files is a separate sync concern. |
| Undo / trash / soft-delete of the wipe | A destructive reset is intentionally irreversible; type-to-confirm is the safeguard. |
| Exporting a backup before wipe | Backup/export is an existing separate capability, not part of this action. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Two separate buttons offered | "Clear all data" + "Full reset" | User selected "offer both". | y |
| Cloud propagation for "Clear all data" | `DELETE FROM` each CRR table → tombstone deltas sync | User chose propagate-deletion; DELETE (not DROP) preserves cr-sqlite change tracking. | y |
| Confirmation UX | Type-to-confirm a fixed word before enabling the button | User chose type-to-confirm. | y |
| Placement | New "Danger Zone" section at the bottom of Settings | User choice. | y |
| Confirmation word | `DELETE` (case-sensitive, English, same for both actions) | Matches ConfirmDialog `confirmLabel` default; consistent, simple. | n |
| Wipe order | `DELETE FROM` in reverse dependency order of `SYNC_TABLES` | Junction/child tables first; avoids relying on cascade (schema has no FKs). | n |
| "Full reset" cloud propagation | Best-effort only — not guaranteed | Full reset clears sync config + identity, so no push fires afterward; cloud files remain (encrypted, orphaned). Users wanting peers wiped should use "Clear all data" while synced. | n |
| "Clear all data" triggers a sync push | Calls `notifyChange()` after the wipe | Debounced auto-sync pushes the tombstones like any other write. | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Clear all data (keep vault) ⭐ MVP

**User Story**: As a user, I want to erase all my accounts, transactions, categories, tags,
and rules while staying logged in, so that I can start fresh without re-doing onboarding or
losing my encryption setup.

**Why P1**: The core requested capability; the empty-but-unlocked state is the common
"start over" case.

**Acceptance Criteria**:

1. WHEN the user opens Settings THEN the system SHALL show a "Danger Zone" section containing
   a "Clear all data" action.
2. WHEN the user activates "Clear all data" THEN the system SHALL require typing the exact
   confirmation word before the destructive button is enabled.
3. WHEN the confirmation word does not exactly match THEN the system SHALL keep the
   destructive button disabled.
4. WHEN the user confirms "Clear all data" THEN the system SHALL delete every row from all 9
   data tables (accounts, categories, tags, transactions, transaction_tags, account_balances,
   auto_category_rules, learned_category_patterns, auto_category_corrections).
5. WHEN "Clear all data" completes THEN the system SHALL keep the vault status `ready` (user
   stays unlocked) and the crypto keys, sync config, and theme intact.
6. WHEN sync is enabled and "Clear all data" completes THEN the system SHALL notify auto-sync
   so the deletion tombstones are pushed.

**Independent Test**: Seed accounts/transactions, run "Clear all data", assert all tables are
empty and vault status is still `ready`.

---

### P2: Full reset (destroy data + identity)

**User Story**: As a user, I want to completely wipe this device — data, passphrase/keys, and
sync config — and return to the setup wizard, so that I can hand off or repurpose the device.

**Why P2**: Important but secondary; a superset of "Clear all data" plus identity teardown.

**Acceptance Criteria**:

1. WHEN the user activates "Full reset" THEN the system SHALL require the same type-to-confirm
   friction as "Clear all data".
2. WHEN the user confirms "Full reset" THEN the system SHALL delete all data rows, clear crypto
   key data, clear sync config and sync state, and remove the `vault-skipped` flag.
3. WHEN "Full reset" completes THEN the system SHALL transition the vault to `needs-setup` (the
   setup wizard is shown).

**Independent Test**: With a passphrase-protected vault and seeded data, run "Full reset";
assert data tables empty, `hasKeyData()` is false, sync config cleared, and vault status is
`needs-setup`.

---

## Edge Cases

- WHEN a wipe is in progress THEN the system SHALL disable the confirm button to prevent
  double-submit.
- WHEN a table is already empty THEN `DELETE FROM` SHALL be a no-op (idempotent; wipe succeeds).
- WHEN the confirmation word is typed then cleared/changed THEN the destructive button SHALL
  re-disable.
- WHEN the user cancels the confirmation THEN the system SHALL make no changes to the database.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DBWIPE-01 | P1: Clear all data | Tasks | Pending |
| DBWIPE-02 | P1: type-to-confirm gating | Tasks | Pending |
| DBWIPE-03 | P1: delete all 9 tables | Tasks | Pending |
| DBWIPE-04 | P1: vault stays ready + keys/config intact | Tasks | Pending |
| DBWIPE-05 | P1: notify auto-sync (propagate tombstones) | Tasks | Pending |
| DBWIPE-06 | P2: full reset teardown | Tasks | Pending |
| DBWIPE-07 | P2: transition to needs-setup | Tasks | Pending |
| DBWIPE-08 | Edge: idempotent / cancel / double-submit guards | Tasks | Pending |

**Coverage:** 8 total, 0 mapped to tasks yet.

---

## Success Criteria

- [ ] User can empty the database from Settings and continue using the empty app unlocked.
- [ ] User can fully reset to the onboarding wizard from Settings.
- [ ] After "Clear all data" with sync on, a second device converges to empty on next sync.
- [ ] Destructive buttons are impossible to trigger without exact type-to-confirm.
