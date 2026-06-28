# InvestPass Import Specification

**Status:** Draft (Specify phase complete; awaiting confirmation → Design)
**Scope:** Complex (new artifact = browser extension; external dependency; multi-account; state)
**Depends on:** Phase 8.6 (import pipeline), 8.2 (domain types), 8.3 (storage/repositories), vault (DEK)

---

## Problem Statement

The user aggregates all of their bank accounts and credit cards in **InvestPass** (an Open Finance
aggregator) under "Finanças → Minha Carteira". Re-entering those transactions into mytruetrack by
hand is tedious and error-prone. We want to pull the user's already-aggregated transactions from
InvestPass into mytruetrack's encrypted local database, reusing the user's existing InvestPass
session, importing only what mytruetrack is missing, and routing each transaction to the correct
mytruetrack account.

This is **not** a real-time bank feed and does **not** introduce a server we control (which
`PROJECT.md` lists as a non-goal). Acquisition happens client-side in a companion browser
extension running inside the user's own InvestPass session; persistence happens in the PWA under
the unlocked vault. No mytruetrack-operated backend is involved.

## Goals

- [ ] Import InvestPass "Minha Carteira" transactions into mytruetrack for a chosen period, with
      every transaction routed to the correct mytruetrack account.
- [ ] Reuse the user's existing InvestPass session — no InvestPass credentials are entered into,
      handled by, or stored by mytruetrack.
- [ ] Make re-imports safe (idempotent) via per-transaction deduplication.
- [ ] Import **only the period missing** from mytruetrack per account (incremental).
- [ ] Persist a reusable **InvestPass account → mytruetrack account** mapping ("map once, reuse").

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Direct Open Finance / Plaid / bank-feed integration | Requires a server; `PROJECT.md` non-goal. We import from InvestPass, not banks. |
| Importing investments / portfolio ("Meus Investimentos") | This feature covers transactional cash-flow ("Minha Carteira") only. |
| Writing data back to InvestPass (two-way sync) | Read-only import; InvestPass remains source-of-truth for aggregation. |
| Mapping InvestPass categories to mytruetrack categories beyond an optional hint (P3) | mytruetrack has its own auto-categorization (Phase 8.x); category taxonomies differ. |
| Mobile/iOS support for the acquisition step | Desktop browser extensions only; the PWA import receiver still works if fed data. |
| Bundling/distributing the extension via a web store at launch | Local/unpacked install acceptable for v1; store publishing is a later concern. |
| Scraping the rendered HTML grid | A structured GraphQL API is available and preferred (see IPIMP-01). |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Acquisition data source | **InvestPass GraphQL API** (`pass-api.invest-pass.com/graphql`), not CSV/Excel/HTML | Structured JSON with **stable UUID ids** (clean dedup), no locale parsing, no download dance. | y |
| Dedup key | InvestPass transaction **UUID** stored as `externalId` | Existing `import-service` dedups by `externalId`; UUID is stable and exact. | y |
| `ignored` flag (InvestPass "excluded from graphs") | **Import all rows regardless of `ignored`** | mytruetrack balances need every leg (incl. transfers/investments InvestPass hides). | y |
| Account mapping | On first sight of an unknown InvestPass `Conta`, **prompt the user to map it** to an existing/new mytruetrack account; persist and reuse | User chose "map once, reuse". | y |
| Credit-card sign | **Uniform rule**: negative `Valor` → `debit`, positive → `credit`, for all account types | Verified in data: card purchases export negative (cardholder perspective); matches v1 domain. | y |
| Credit-card mapping | Card `Conta` must map to a mytruetrack account of type `credit_card` | So balance (amount owed) renders correctly. | y |
| Date/timezone | Convert ISO-8601 UTC `Data` to **America/São_Paulo** before deriving `YYYY-MM-DD` | UTC late-night transactions shift one local day, corrupting month boundaries and gap detection. | y |
| Extension ↔ PWA bridge mechanism | **Agent's discretion at Design**; must be private + sender-verified | User deferred; security constraints fixed (see IPIMP-08). | y (deferred to design) |
| Transactions GraphQL query/field names + confirmation of `id` | To be confirmed by a **Design-phase spike** | Could not fully capture the private transactions query during Specify; categories confirmed UUIDs, transactions inferred. | n (spike) |
| Browser target | **Chromium (Manifest V3)** first | Largest coverage; aligns with the user's environment. | y |
| Token handling | Extension reuses the in-session Bearer JWT / refresh cookie; **mytruetrack never stores InvestPass tokens** | Privacy-by-architecture; tokens stay in the InvestPass origin. | y |

**Open questions:** none blocking — the only unconfirmed item (exact transactions GraphQL query) is
explicitly assigned to a Design-phase spike before implementation.

---

## User Stories

### P1: Import a chosen period into mapped accounts ⭐ MVP

**User Story**: As a mytruetrack user, I want to pull my InvestPass "Minha Carteira" transactions
for a chosen month/range into mytruetrack — each routed to the right account — so that I don't
re-enter them by hand.

**Why P1**: This is the complete vertical slice (acquire → bridge → map → dedup → persist). Dedup
makes it immediately useful and safe to re-run, even before incremental gap detection (P2).

**Acceptance Criteria**:

1. WHEN the user starts an InvestPass import for a selected month/range AND an active InvestPass
   session exists THEN the extension SHALL fetch that period's transactions via the InvestPass
   GraphQL API without prompting for InvestPass credentials.
2. WHEN fetched transactions reach the PWA THEN the PWA SHALL validate the payload against a schema
   (zod) at the bridge boundary AND reject the whole payload if it is malformed, surfacing an error.
3. WHEN a transaction's InvestPass `Conta` has no saved mapping THEN the system SHALL prompt the
   user to map it to an existing or new mytruetrack account before importing that account's rows.
4. WHEN the user maps an InvestPass `Conta` to a mytruetrack account THEN the system SHALL persist
   that mapping AND reuse it on subsequent imports without re-prompting.
5. WHEN persisting a transaction THEN the system SHALL set `type = debit` for a negative `Valor`
   and `type = credit` for a positive `Valor`, with `amount` as the absolute value in integer cents.
6. WHEN deriving a transaction's date THEN the system SHALL convert the ISO-8601 UTC timestamp to
   America/São_Paulo local date (`YYYY-MM-DD`) before storing `transactionDate`.
7. WHEN a transaction's InvestPass UUID already exists as `externalId` for the target account THEN
   the system SHALL skip it (no duplicate).
8. WHEN an import completes THEN the system SHALL show a summary: counts of imported, skipped
   (duplicate), and errored transactions, broken down per mytruetrack account.
9. WHEN the vault is locked (no DEK) THEN the system SHALL NOT import AND SHALL prompt the user to
   unlock first.

**Independent Test**: With a mapped InvestPass account, run an import for June 2026; verify the
correct transactions appear in mytruetrack with right account/type/date/amount; re-run and verify
zero duplicates added.

---

### P2: Import only the missing period (incremental)

**User Story**: As a user who imports regularly, I want mytruetrack to pull only what it doesn't
already have per account, so re-imports are fast and I don't reselect date ranges.

**Why P2**: Builds on P1; P1's dedup already prevents duplicates, so this is an efficiency/UX win,
not a correctness prerequisite. The user emphasized it, so it is high-priority P2.

**Acceptance Criteria**:

1. WHEN an incremental import starts THEN the PWA SHALL provide the extension, per mapped account,
   the date of the latest already-imported InvestPass transaction (or "none").
2. WHEN the extension fetches transactions THEN it SHALL request only the range from each account's
   last-imported date (inclusive overlap) to today.
3. WHEN no mytruetrack data exists for an account THEN the system SHALL fetch that account's full
   available history (bounded by a configurable default window).
4. WHEN the missing-period fetch overlaps already-imported days THEN dedup (P1-7) SHALL still
   guarantee no duplicates.

**Independent Test**: Import June, add nothing in InvestPass, run incremental import → 0 imported;
add one InvestPass transaction dated today → incremental import brings exactly that one.

---

### P3: Optional category hinting

**User Story**: As a user, I want imported transactions to optionally carry a suggested category
derived from InvestPass's category, so I categorize less.

**Why P3**: Nice-to-have; mytruetrack auto-categorization already exists and taxonomies differ.

**Acceptance Criteria**:

1. WHEN importing AND a mapping from the InvestPass category to a mytruetrack category exists THEN
   the system SHALL apply it as a suggestion (not overriding user/auto-categorization rules).
2. WHEN no category mapping exists THEN the transaction SHALL import uncategorized (current behavior).

---

## Edge Cases

- WHEN the InvestPass Bearer token has expired mid-import THEN the extension SHALL attempt a silent
  session refresh AND, if that fails, surface a clear "re-open InvestPass and retry" message
  without partial-mapping corruption.
- WHEN the GraphQL API shape changes (missing expected fields) THEN schema validation SHALL fail
  closed with a diagnostic, importing nothing.
- WHEN a transaction has a whole-second (`.000Z`) timestamp (card postings) THEN dedup SHALL still
  rely on the stable UUID (not the timestamp), avoiding false collisions.
- WHEN two imports are triggered concurrently THEN the system SHALL serialize them (one at a time)
  to avoid racing the account-mapping prompts and writes.
- WHEN an unmapped `Conta` is encountered mid-batch THEN that account's rows SHALL be held until
  mapped (or skipped on user choice) WITHOUT blocking already-mapped accounts' imports.
- WHEN the bridge receives a message from any sender other than the trusted companion extension
  THEN the PWA SHALL ignore it.
- WHEN the same transfer appears as two legs across two accounts (e.g. "Transferência mesma
  titularidade") THEN both legs SHALL import (each affects its own account balance — correct).

---

## Implicit-Requirement Dimensions Sweep (Complex = full)

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | IPIMP: zod-validate the bridged payload at the trust boundary (AC P1-2); reject malformed. |
| Failure / partial-failure states | Per-transaction errors collected, import continues (reuse `import-service`); fetch/token failures fail closed without corrupting mappings (edge cases). |
| Idempotency / retry / duplicate handling | Dedup by InvestPass UUID `externalId` (AC P1-7, P2-4); safe re-runs. |
| Auth boundaries & rate limits | InvestPass session reused in-extension; mytruetrack stores no InvestPass tokens; bridge sender-verified (AC P1-2, IPIMP-08). Rate limits: N/A because — user-triggered, low volume; extension SHALL issue requests politely (no tight loops). |
| Concurrency / ordering | Serialize imports (edge case); ordering N/A because — balances are sum-based, order-independent. |
| Data lifecycle / expiry | Account map persisted in IndexedDB indefinitely (user-editable/removable); InvestPass tokens never persisted by mytruetrack. |
| Observability | Per-account import summary surfaced (AC P1-8); errors logged without secrets. |
| External-dependency failure | Token expiry + API-shape change handled (edge cases); PWA importer remains functional given valid data. |
| State-transition integrity | `Conta` mapping state unmapped → mapped (AC P1-3,4); import lifecycle serialized (edge case). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| IPIMP-01 | P1: GraphQL acquisition w/ session reuse | Design | Pending |
| IPIMP-02 | P1: Bridge payload schema validation | Design | Pending |
| IPIMP-03 | P1: Unknown-Conta mapping prompt | Design | Pending |
| IPIMP-04 | P1: Persist & reuse account mapping | Design | Pending |
| IPIMP-05 | P1: Sign→type + cents amount | Design | Pending |
| IPIMP-06 | P1: UTC→São_Paulo date conversion | Design | Pending |
| IPIMP-07 | P1: Dedup by InvestPass UUID externalId | Design | Pending |
| IPIMP-08 | P1: Sender-verified private bridge | Design | Pending |
| IPIMP-09 | P1: Import summary per account | Design | Pending |
| IPIMP-10 | P1: Block import when vault locked | Design | Pending |
| IPIMP-11 | P2: PWA supplies last-imported date per account | - | Pending |
| IPIMP-12 | P2: Extension fetches only missing range | - | Pending |
| IPIMP-13 | P2: Full-history fetch when account empty | - | Pending |
| IPIMP-14 | P3: Optional category hint mapping | - | Pending |

**ID format:** `IPIMP-NN`. **Status:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 14 total, 0 mapped to tasks yet (Tasks phase pending).

---

## Success Criteria

- [ ] User imports a full month from InvestPass into correctly-mapped accounts in under a minute,
      without typing InvestPass credentials into mytruetrack.
- [ ] Re-running the same import adds zero duplicate transactions.
- [ ] Imported credit-card purchases increase amount owed; payments reduce it (v1 balance semantics).
- [ ] No InvestPass token or credential is ever persisted by mytruetrack.
- [ ] A transaction timed late-night UTC lands on the correct Brazilian calendar day.

---

## Notes for Design (not requirements)

- **Architecture is two cooperating parts**: (1) a Chromium MV3 companion extension (acquirer —
  reuses session, calls GraphQL, asks PWA for the missing period, hands data over the bridge) and
  (2) the PWA importer (receives over the bridge, validates, maps accounts, dedups, persists via the
  existing Phase 8.6 `import-service`). The extension cannot write to the encrypted DB; only the PWA
  holds the DEK.
- **Reuse Phase 8.6**: feed `ParsedTransaction[]` (with `externalId = InvestPass UUID`) straight
  into `importTransactions(db, accountId, …)`. New work: GraphQL client (extension), bridge,
  account-map store (IndexedDB, mirror `import-mappings.ts`), `Conta`-split + routing, UTC→local
  date conversion.
- **Design-phase spike (required before implementation)**: capture the exact InvestPass transactions
  GraphQL operation, confirm a stable `id` field, and document the response schema for the zod
  validator.
- **Record an AD** for introducing the browser-extension artifact (new to the project) and the
  bridge/trust model.
