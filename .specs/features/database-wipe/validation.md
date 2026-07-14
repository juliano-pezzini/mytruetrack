# Database Wipe — Verifier Report

**Verdict:** ✅ PASS
**Date:** 2026-07-13
**Diff range:** `84e0d23..c3669ee` (branch `feat/database-wipe`)
**Author ≠ Verifier:** Re-derived coverage independently from spec ACs; did not inherit the
author's mental model.

---

## Quality Gates

| Gate | Result |
| ---- | ------ |
| `tsc --noEmit` (typecheck) | ✅ clean |
| `eslint src/` | ✅ clean |
| `vitest run` (unit) | ✅ 386 passed (44 files) |
| `playwright test database-wipe` (e2e) | ✅ 4 passed |
| `audit-ci` (security) | ✅ passed (2 pre-existing allowlisted advisories) |

---

## Spec-Anchored Outcome Check

| AC | Asserted outcome | Evidence | Match |
| -- | ---------------- | -------- | ----- |
| DBWIPE-01 | Danger Zone with "Clear all data" shown in Settings | e2e navigates to `Danger Zone` heading + clicks `Clear all data…` | ✅ |
| DBWIPE-02 | Confirm disabled until exact word typed | e2e: disabled on empty/`delete`, enabled on `DELETE`, re-disabled when cleared | ✅ |
| DBWIPE-03 | All 9 tables emptied | unit `clearAllData` seeds every SYNC_TABLE, asserts each COUNT(*)=0 | ✅ |
| DBWIPE-04 | Vault stays `ready`, keys/config intact | e2e: no `Get Started`, nav visible, empty accounts persist across reload | ✅ |
| DBWIPE-05 | Auto-sync notified after clear | component calls `notifyChange()` post-wipe (path exercised by e2e clear flow) | ✅ (see gap G1) |
| DBWIPE-06 | Full reset clears keys + sync config + sync state + flag | unit `wipeEverything` asserts all three clear fns called once + flag removed | ✅ |
| DBWIPE-07 | Transition to `needs-setup` | e2e: `Get Started` visible, Settings link gone after full reset | ✅ |
| DBWIPE-08 | Idempotent / cancel / double-submit guards | unit idempotent-on-empty; e2e cancel = no changes; `busy` disables confirm | ✅ |

---

## Discrimination Sensor (mutation)

| Mutation | Injected in | Test result | Killed? |
| -------- | ----------- | ----------- | ------- |
| Delete only the first table (`[SYNC_TABLES[0]]`) instead of all | `clearAllData` | `clear-all-data.test.ts` → 1 failed | ✅ killed |

Mutation reverted; suite green afterward. No surviving mutants.

---

## Gaps / Notes

- **G1 (low):** DBWIPE-05 (`notifyChange` propagation) is verified structurally, not by an
  asserted cross-device convergence — consistent with the repo's existing deferral of a
  real two-device sync e2e (needs a shared cloud test server; see STATE.md AD-008). The
  `DELETE`-not-`DROP` choice that makes tombstones possible is covered by the unit test's
  "table structure intact" assertion.
- **Logged assumption confirmed:** full reset's cloud propagation is best-effort only (sync
  config is torn down before a push can fire); documented in `spec.md` Assumptions.

## Lessons

Clean PASS — no grounded failures to distill.

---

## Post-review update (PR #63)

Addressed three valid `copilot-pull-request-reviewer` comments:

1. **Atomicity** — `clearAllData` now wraps its deletes in a `BEGIN`/`COMMIT` transaction with
   `ROLLBACK` on failure and quotes table identifiers. New unit test asserts a mid-wipe failure
   rolls back (no `COMMIT`).
2. **Meaningful vault test** — replaced the tautological inline `wipeEverything` test with a
   jsdom `renderHook(VaultProvider)` test (`vault-provider.render.test.ts`) that invokes
   `result.current.wipeEverything()` and asserts the teardown calls + `status → needs-setup`.
3. **Dialog reuse** — extended `ConfirmDialog` with optional `children` + `confirmDisabled`
   and refactored `DangerZone` to reuse it instead of a bespoke modal.

Also fixed the failing CI **Quality** job (two files were not Prettier-formatted).

Re-verified: prettier/lint/typecheck clean, 387 unit tests, 4 wipe e2e + 23 shared-dialog
e2e (accounts/categories/transactions) pass, audit-ci clean.
