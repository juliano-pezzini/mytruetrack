# AI Instructions Reorg Specification

## Problem Statement

Feature specs under `.specs/features` stay in the tree after the code ships. Agents treat them as current truth, even when later ADs superseded the plan (snapshot sync, PKCE, OPFS). `.github/copilot-instructions.md` is Copilot-only and tells agents to load those folders. The repo needs one evergreen instruction contract for Cursor, Claude, and Copilot, durable product memory in `.specs/project`, and historical specs off the working tree.

## Goals

- [ ] Cursor, Claude Code, and GitHub Copilot load the same canonical policy from one maintained file
- [ ] Shipped feature folders are gone from HEAD; their text lives on GitHub issues
- [ ] Agents are not instructed to read shipped `.specs/features` as current truth
- [ ] Evergreen layer gotchas remain available on demand, not as full historical specs

## Out of Scope

| Feature | Reason |
| -------- | ------ |
| Rewriting application source or tests | This is a docs and agent-context change |
| Implementing `setup-sync-first` | Separate in-flight feature on another branch |
| Implementing `xlsx-security-remediation` | Already a STATE.md todo; only the spec location moves |
| Deleting `.specs/project/{PROJECT,ROADMAP,STATE}.md` | User locked these in place |
| Dumping full feature specs into always-on agent context | That recreates the stale-context problem |
| Replacing `tlc-spec-driven` as the planning method | In-flight specs may still exist until a feature ships |
| Updating pull request bodies | User chose issues, not PRs |
| Cleaning `.tmp-cvm-sensor` | Local verifier leftover, not this feature |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Canonical instruction file | Root `AGENTS.md` is the only maintained policy | Cursor and Copilot load it; one source of truth | y |
| Claude entrypoint | Root `CLAUDE.md` contains only an `@AGENTS.md` import | Claude Code does not natively load `AGENTS.md` | y |
| Copilot entrypoint | `.github/copilot-instructions.md` becomes a short pointer to `AGENTS.md` | Many Copilot surfaces still auto-load that path | y |
| Spec archive target | GitHub **issues**, not pull requests | User override 2026-09-16 | y |
| Existing issues | Do not reuse #1–#11, #39, #42, #43, #60, #61 as spec bodies | Those tickets have different live scope (bugs, UX, P2 follow-ups). New archive issues may *link* them | y (agent, from issue bodies) |
| Missing archive issue | Create a new issue per shipped feature folder | User asked every feature mapped to an issue | y |
| Archive issue state | Create then **close** immediately, except unimplemented `xlsx-security-remediation` stays **open** | Closed issues are history, not backlog | y (agent default) |
| In-flight folders | Do not delete `setup-sync-first` if present; do not archive it in this feature | It is still the working spec | y (agent default) |
| Evergreen extraction | Promote only still-true layer rules into path-scoped files; do not copy tasks/ACs/history | Source code remains source of truth | y |
| GitHub writes | No issue create/edit until the user explicitly authorizes remote writes | Blast-radius rule: local commits only until go-ahead | y |
| Worktree | Implement on a new branch from `main` in a separate git worktree | User requested isolation from `setup-sync-first` | y |
| Issue body limit | If concatenated markdown would exceed 65536 characters, put `spec.md` (or the primary file) in the body and remaining files as comments | GitHub issue body cap | n (platform constraint) |
| Duplicate detection | Title prefix `docs(spec-archive): <folder>` ; if an issue with that title exists, update it instead of creating another | Idempotent re-run | n (agent default) |

**Open questions:** none - all resolved or logged above.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Issue bodies are markdown copied from existing files. IF concatenated size would exceed 65536 characters THEN the system SHALL split as specified above. |
| Failure / partial-failure | IF creating or updating an archive issue fails THEN the system SHALL leave that feature folder in the tree and SHALL NOT delete it. |
| Idempotency / retry / duplicate handling | WHEN an issue titled `docs(spec-archive): <folder>` already exists THEN the system SHALL update that issue rather than create a second one. |
| Auth boundaries & rate limits | GitHub writes require the user's credentials and an explicit go-ahead in this conversation. No org-wide tokens. |
| Concurrency / ordering | Archive a folder only after its issue URL is recorded. Local instruction-file changes do not depend on GitHub. |
| Data lifecycle / expiry | Shipped `.specs/features/<folder>` is deleted from HEAD after a successful archive. Git history retains the files. |
| Observability | A mapping table (folder → issue URL) is committed in `.specs/project` or the reorg feature docs so ROADMAP/STATE can link it. |
| External-dependency failure | GitHub API/auth failure blocks only the archive-and-delete path for the failed folder. Instruction files may still ship. |
| State-transition integrity | Legal: extract evergreen rules → write `AGENTS.md` → thin pointers → (authorized) create/update issues → delete shipped folders → fix broken project-doc links. Illegal: delete a shipped folder with no archive issue URL. |

---

## User Stories

### P1: One policy file for Cursor, Claude, and Copilot ⭐ MVP

**User Story**: As an engineer using Cursor, Claude Code, or GitHub Copilot, I want one maintained instruction file so agents share the same constraints and do not load shipped feature specs as current truth.

**Why P1**: This is the always-on context agents actually read.

**Acceptance Criteria**:
1. The system SHALL maintain a root `AGENTS.md` as the only full copy of shared agent policy (project overview, stack, domain balance rules, architectural constraints, code style, testing, security, git conventions, and how to resolve ambiguity).
2. WHEN an agent needs Claude Code project instructions THEN the system SHALL provide a root `CLAUDE.md` whose body is only an import of `AGENTS.md` (no duplicated policy paragraphs).
3. WHEN an agent needs GitHub Copilot repository instructions THEN the system SHALL provide `.github/copilot-instructions.md` as a short pointer to `AGENTS.md` (no duplicated policy paragraphs).
4. The system SHALL instruct agents that shipped behavior is defined by source code plus `.specs/project/{PROJECT,ROADMAP,STATE}.md`, not by `.specs/features`.
5. IF a policy sentence appears in `CLAUDE.md` or `.github/copilot-instructions.md` THEN it SHALL be a pointer, import, or one-line discovery note, not a restatement of domain or architecture rules.

**Independent Test**: Open the three files. Only `AGENTS.md` contains the balance formula and “no backend” rules. The other two files are a few lines and name `AGENTS.md`.

---

### P1: On-demand evergreen layer rules ⭐ MVP

**User Story**: As an agent editing sync, crypto, storage, or import code, I want the still-true layer gotchas without loading a historical feature spec.

**Why P1**: Some durable rules are not obvious from code comments and are missing from `PROJECT.md` / `STATE.md`.

**Acceptance Criteria**:
1. The system SHALL publish path-scoped instruction files (discoverable by Cursor, Copilot, and Claude) for at least: `src/sync/**`, `src/crypto/**` plus keystore, `src/storage/**`, statement/InvestPass import paths, and Danger Zone wipe UI.
2. WHEN those scoped files are present THEN they SHALL contain only still-true conventions (filenames, probe kinds, delete rules, crypto parameters, wipe confirm word, peer-only pull, shared Drive `appDataFolder` trap), not task lists or superseded designs.
3. The system SHALL NOT copy full `.specs/features/*/spec.md` contents into always-on `AGENTS.md`.
4. WHERE a later AD in `.specs/project/STATE.md` contradicts a scoped rule, the scoped file SHALL match the AD (source of truth is code + STATE, not the old spec).

**Independent Test**: Grep scoped files for `OPFS` as the persistence plan, `PKCE`, and `last-blob-wins`; those superseded claims are absent. Grep for `vault-metadata.json` and `changes-` and they are present in sync-scoped files.

---

### P1: Archive shipped specs to GitHub issues ⭐ MVP

**User Story**: As a repo maintainer, I want each shipped feature folder’s markdown on a GitHub issue so git history and GitHub keep the archive, while HEAD no longer feeds stale specs to agents.

**Why P1**: Removing the folders without an archive would lose the planning record the user still wants.

**Acceptance Criteria**:
1. WHEN the user has explicitly authorized GitHub writes THEN the system SHALL ensure one archive issue exists per shipped feature folder listed in the mapping table, titled `docs(spec-archive): <folder>`.
2. WHEN that archive issue is created or updated THEN the system SHALL put the folder’s markdown files in the issue body and/or comments, and SHALL record the issue URL in the mapping table.
3. IF an existing issue is a live ticket with different scope (including #1–#11, #39, #42, #43, #60, #61) THEN the system SHALL NOT replace that ticket’s body with a feature spec and SHALL only link it from the new archive issue when related.
4. IF GitHub create/update for a folder fails THEN the system SHALL keep that folder in the working tree and SHALL NOT delete it.
5. WHEN a folder’s archive issue URL is recorded THEN the system SHALL delete that shipped folder from the repository tree.
6. The system SHALL NOT delete `.specs/project/` markdown files.
7. IF the user has not authorized GitHub writes THEN the system SHALL NOT create or edit remote issues.
8. WHERE `xlsx-security-remediation` is archived, the archive issue SHALL remain open.
9. WHERE other shipped feature folders are archived, those archive issues SHALL be closed after the body is written.

**Independent Test**: Mapping table has a URL per shipped folder; those folders are absent under `.specs/features`; `PROJECT.md` still exists; live issues like #3 still have their original product-request bodies.

---

### P1: Project docs do not point at deleted spec paths ⭐ MVP

**User Story**: As an agent reading `.specs/project` and `.specs/README.md`, I want links that resolve, pointing at issues or code rather than deleted folders.

**Why P1**: Broken links would send agents back into missing feature paths.

**Acceptance Criteria**:
1. WHEN shipped feature folders are removed THEN `.specs/README.md`, `.specs/project/ROADMAP.md`, and `.specs/project/STATE.md` SHALL NOT link to `.specs/features/<shipped-folder>/`.
2. WHEN an archive issue URL exists THEN ROADMAP phase entries that previously linked a spec SHALL link that issue (or the mapping table) instead.
3. The system SHALL describe `.specs/features/` as in-flight-only (optional working specs for unmerged work), not as the catalog of shipped features.

**Independent Test**: Grep `.specs/project` and `.specs/README.md` for `features/8.` and `features/cloud-vault` and `features/auto-sync`; no remaining path links to deleted folders.

---

## Edge Cases

- IF `investpass-import` or `cloud-vault-metadata` concatenated size is within 2 KB of 65536 characters THEN the system SHALL put the primary spec in the body and attach design/tasks/validation as comments rather than truncating.
- IF `setup-sync-first` exists in the worktree THEN the system SHALL leave it untouched.
- IF a second run of archive already finds `docs(spec-archive): <folder>` THEN the system SHALL update that issue and SHALL NOT open a duplicate.
- IF GitHub rate-limits the client THEN the system SHALL stop further creates, keep remaining folders, and report which folders are still local.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ADOC-01 | P1: One policy file | Design | Pending |
| ADOC-02 | P1: One policy file | Design | Pending |
| ADOC-03 | P1: One policy file | Design | Pending |
| ADOC-04 | P1: One policy file | Design | Pending |
| ADOC-05 | P1: One policy file | Design | Pending |
| ADOC-06 | P1: On-demand rules | Design | Pending |
| ADOC-07 | P1: On-demand rules | Design | Pending |
| ADOC-08 | P1: On-demand rules | Design | Pending |
| ADOC-09 | P1: On-demand rules | Design | Pending |
| ADOC-10 | P1: Archive to issues | Design | Pending |
| ADOC-11 | P1: Archive to issues | Design | Pending |
| ADOC-12 | P1: Archive to issues | Design | Pending |
| ADOC-13 | P1: Archive to issues | Design | Pending |
| ADOC-14 | P1: Archive to issues | Design | Pending |
| ADOC-15 | P1: Archive to issues | Design | Pending |
| ADOC-16 | P1: Archive to issues | Design | Pending |
| ADOC-17 | P1: Archive to issues | Design | Pending |
| ADOC-18 | P1: Archive to issues | Design | Pending |
| ADOC-19 | P1: Project docs links | Design | Pending |
| ADOC-20 | P1: Project docs links | Design | Pending |
| ADOC-21 | P1: Project docs links | Design | Pending |

**ID format:** `ADOC-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 21 total, 0 mapped to tasks, 21 unmapped

---

## Success Criteria

- [ ] Cursor, Claude, and Copilot can discover the same policy via `AGENTS.md` plus thin pointers
- [ ] No shipped feature spec folder remains on the branch HEAD
- [ ] Every shipped folder has a GitHub issue URL in the mapping table
- [ ] Live product issues were not overwritten
- [ ] `.specs/project` files remain and do not link to deleted feature paths
