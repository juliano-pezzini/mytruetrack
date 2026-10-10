---
applyTo: "src/storage/**"
---

# Storage

- The browser database is `@vlcn.io/crsqlite-wasm` on `IDBBatchAtomicVFS` (`mytruetrack.db`). It does not need cross-origin isolation.
- Money is integer cents. Dates are ISO `TEXT` (`transaction_date`). Non-primary-key columns need a SQL default so cr-sqlite can sync them.
- Accounts are soft-deleted (`is_active = 0`). Transactions are hard-deleted (`DELETE FROM transactions`).
- `balance(date) = base_balance + sum(credits) - sum(debits)` over `[base_date, date]`. `credit` increases the balance. `debit` decreases it. Credit-card accounts are normally negative.
- Domain functions stay free of I/O. Repositories are the SQLite boundary.
