# InvestPass Import Context

**Gathered:** 2026-06-27
**Spec:** `.specs/features/investpass-import/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Import "Minha Carteira" transactions from InvestPass (Open Finance aggregator) into mytruetrack's
encrypted local database via a companion Chromium extension (acquirer, reuses the user's InvestPass
session and calls the InvestPass GraphQL API) plus a PWA-side importer (maps accounts, dedups,
persists under the unlocked vault, reusing the Phase 8.6 pipeline). Read-only; transactional
cash-flow only (not investments); no mytruetrack-operated server.

---

## Implementation Decisions

### Data acquisition
- Source = InvestPass **GraphQL API** (`POST https://pass-api.invest-pass.com/graphql`, Apollo,
  client name `invest-pass-front`), **not** CSV/Excel/HTML scraping.
- Auth = the user's in-session **Bearer JWT** (~15 min expiry) + `refresh_token_v2` cookie (~30 d).
  The extension reuses these inside the InvestPass origin; mytruetrack stores none of them.
- `FindAllCategories` confirmed live: returns category UUID, name, icon, color, `kind`
  (INCOME/EXPENSE), `isIgnoredInGraphs`. The export `ignored` flag derives from
  `isIgnoredInGraphs`. Transactions are inferred (not yet captured) to also carry UUID `id` —
  to be confirmed by a Design spike.

### Verified InvestPass export shape (reference / fallback)
- CSV header: `categoryIcon,Data,Descrição,Conta,Valor,ignored` (UTF-8, CRLF).
- `Data` = ISO-8601 **UTC** datetime (e.g. `2026-06-27T16:48:38.000Z`); ms precision, some `.000Z`.
- `Valor` = signed decimal, **dot separator**, no thousands sep (`-243.84`, `26`).
  Negative = debit, positive = credit.
- `Conta` = account name; one export spans **all** accounts (sample: Mercado Pago, Cartão XP Visa
  Infinite [credit card], Conta Corrente, CAIXA, XP). No need to iterate accounts one at a time.
- Excel = identical columns; datetime stored as text, `Valor` numeric, `ignored` boolean.

### Account routing
- On first sight of an unknown `Conta`, prompt the user to bind it to an existing/new mytruetrack
  account; persist the binding (IndexedDB, mirroring `src/storage/import-mappings.ts`) and reuse it.
- Credit-card `Conta` must bind to a `credit_card`-type account.

### Transaction conversion
- `type`: negative `Valor` → `debit`, positive → `credit` (uniform across account types).
- `amount`: absolute value, integer cents.
- `transactionDate`: convert UTC → **America/São_Paulo** before taking `YYYY-MM-DD`.
- `externalId`: InvestPass transaction **UUID** → drives dedup via existing `import-service`.
- Import **all** rows regardless of InvestPass `ignored`.

### Incremental ("only the missing period")
- PWA supplies the extension each mapped account's last-imported date; extension fetches only the
  gap (with overlap); dedup guarantees no duplicates. Empty account → bounded full history.

### Agent's Discretion
- Extension ↔ PWA **bridge mechanism** (e.g. `externally_connectable` vs content-script
  `postMessage`): choose the most secure + simple option at Design. Must be private and
  sender-verified (only the trusted companion extension accepted; payload schema-validated).
- Default full-history window size for empty accounts.
- Whether category hinting (P3) ships at all.

### Declined / Undiscussed Gray Areas → Assumptions
- All surfaced gray areas were discussed and resolved; see spec Assumptions table. The single
  unconfirmed item (exact transactions GraphQL query/field for `id`) is intentionally deferred to a
  Design-phase spike, not silently dropped.

---

## Specific References

- "Filter all accounts — one at a time, only the missing period" (original ask) — **revised**: a
  single fetch/export already contains all accounts via `Conta`; per-account iteration is
  unnecessary. Incremental "missing period" retained per account via dedup + last-imported date.
- "Only the extension matters; skip the manual path" — **reconciled**: the manual file-picker UX is
  dropped, but the PWA-side importer cannot be skipped (only the PWA holds the DEK to write
  encrypted data). Feature = extension (acquire) + PWA (persist).

---

## Deferred Ideas

- Mapping InvestPass categories → mytruetrack categories beyond a simple hint (P3).
- Publishing the extension to a browser web store.
- Importing InvestPass "Meus Investimentos" (portfolio) data.
- Non-Chromium browser support for the acquirer.
</content>
