# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When import dedupes by external id, assert re-insert after the row is hard-deleted so the id is gone from the store
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `import` · harmful: 0
- features: mercado-pago-import
- evidence: Period AC10 / validation.md (import)
- last seen: 2026-10-13T04:40:48Z

### L-002 - UI delete/confirm flows with ConfirmDialog need automated assertions for list contents, dismiss no-op, and no typed DELETE requirement
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: mercado-pago-import
- evidence: Review AC3-AC5 / validation.md (ui)
- last seen: 2026-10-13T04:40:48Z

### L-003 - When a mapper omits optional fields that must stay empty, assert the persisted empty values on read-back not only the mapped shape
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `import` · harmful: 0
- features: mercado-pago-import
- evidence: Import AC7 / validation.md (import)
- last seen: 2026-10-13T04:40:48Z

### L-004 - Institution or mode toggles that hide UI must also assert data retention and that toggling back restores the action and related history
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: mercado-pago-import
- evidence: Dashboard AC3-AC5 / validation.md (ui)
- last seen: 2026-10-13T04:40:48Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
