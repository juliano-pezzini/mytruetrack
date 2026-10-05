# AI Instructions Reorg Context

**Gathered:** 2026-09-16
**Spec:** `.specs/features/ai-instructions-reorg/spec.md`
**Status:** Ready for spec confirmation

---

## Feature Boundary

Reorganize agent context so source code plus `.specs/project` are the source of truth. One canonical `AGENTS.md` (with thin Claude and Copilot pointers). Evergreen layer gotchas as path-scoped on-demand files. Shipped `.specs/features/*` markdown archived onto GitHub issues, then deleted from HEAD. Implement in a git worktree branched from `main`.

---

## Implementation Decisions

### Instruction files

- Root `AGENTS.md` is the only maintained full policy.
- Root `CLAUDE.md` only imports `@AGENTS.md`.
- `.github/copilot-instructions.md` becomes a short pointer to `AGENTS.md`.
- No triple-copied domain/architecture text.

### Spec archive

- Archive target is **GitHub issues**, not pull requests.
- Every shipped feature folder maps to one issue titled `docs(spec-archive): <folder>`.
- Existing issues were checked (16 total). None is a spec home:
  - #2 Google Drive integration — “Coming soon” Settings button (closed)
  - #3 User onboarding — product tour + default tags (open, different feature)
  - #42 Review the web sync — “fast / only the diff” (open)
  - #43 Sync indicator visibility (open)
  - #60 / #61 InvestPass P2 follow-ups (open)
  - #1, #5–#11, #39 — small UX tickets
- Do **not** overwrite those bodies. New archive issues may link them as related.
- Close archive issues after writing, except `xlsx-security-remediation` stays open.
- Leave `setup-sync-first` on its own branch; this reorg does not archive or delete it.
- Do not create/edit issues until the user explicitly authorizes remote GitHub writes.

### Evergreen extraction (not full specs)

Promote still-true gotchas only:

- Sync/vault: `vault-metadata.json`, `changes-<siteId>.bin`, probe `empty|ready|legacy|corrupt`, peer-only pull, shared Drive `appDataFolder` for same OAuth client, auto-sync silent-fail / no idle “synced” badge
- Storage: ISO TEXT dates, INTEGER cents, accounts soft-delete, transactions hard-delete
- Crypto: `mytruetrack-keystore`, PBKDF2 600k/SHA-256, AES-KW wrap, AES-GCM 12-byte IV
- Wipe: type `DELETE`; Clear vs Full reset
- Import: amount always positive + credit/debit; InvestPass UUID `externalId`; no InvestPass tokens in the PWA

Do not promote superseded plans (OPFS as the shipped VFS, PKCE, last-blob-wins snapshots).

### Agent's Discretion

- Exact scoped-file mechanism (Cursor `.mdc` + Copilot `applyTo` + Claude `paths` vs nested `AGENTS.md` per directory) as long as all three tools can discover the same rules.
- Mapping table location under `.specs/project` (new file vs section in README).
- Issue comment vs body split when near the 64 KB cap.

### Declined / Undiscussed Gray Areas → Assumptions

| Topic | Chosen default | Rationale |
| ----- | -------------- | --------- |
| Archive issue state | Closed after write (xlsx open) | Keep history off the open backlog |
| In-flight `setup-sync-first` | Untouched | Still the working spec |
| Duplicate archive titles | Update in place | Idempotent re-run |

---

## Specific References

- User: move Copilot instructions to a file all main AI tools can use → layout A.
- User: keep `.specs/project` markdown.
- User: map **all** feature specs to **issues**, not PRs; search existing issues first.
- Goal: avoid outdated files; source code is source of truth; feature specs can confuse agents.

---

## Deferred Ideas

- Export/import vault (belongs to `setup-sync-first` / later work)
- Implementing exceljs swap (STATE.md todo; issue stays open as the spec home)
- Cleaning `.tmp-cvm-sensor`
