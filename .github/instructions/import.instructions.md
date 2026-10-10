---
applyTo: "src/workers/**,extension/**"
---

# Imports

- Statement import parses in a web worker. The stored amount is a positive integer plus a `credit` or `debit` type. A non-positive amount is rejected.
- InvestPass rows keep the extension UUID as `externalId`. The PWA does not store InvestPass credentials or API tokens. The extension holds that session.
- Validate parsed rows before insert. Replacing the spreadsheet parser is a separate open item. Do not do it as a side effect of other import work.
