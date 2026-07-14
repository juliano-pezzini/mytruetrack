# Replace `xlsx` with `exceljs` — Security Remediation

**Status**: Draft
**Type**: Security / dependency remediation
**Depends on**: 8.6 (statement import parsers)
**Tracks**: `.specs/project/STATE.md` line 210 ("Replace `xlsx` with `exceljs`")

---

## Context

Dependabot alert [#1](https://github.com/juliano-pezzini/mytruetrack/security/dependabot/1)
flags the `xlsx` (SheetJS CE) dependency for **Prototype Pollution**.

| Field | Value |
| --- | --- |
| Advisory | GHSA-4r6h-8v6p-xvw6 |
| CVE | CVE-2023-30533 |
| CWE | CWE-1321 (Prototype Pollution) |
| Severity | High — CVSS 3.1 = 7.8 |
| Vulnerable range | `xlsx < 0.19.3` |
| First patched version (npm) | **none** — package unmaintained on npm |
| Installed | `xlsx@^0.18.5` (direct runtime dependency) |
| EPSS | ~1% (low exploitation probability in the wild) |

A second advisory for the same package — **ReDoS, GHSA-5pgg-2g8v-p4x9** — is
also currently allowlisted in `audit-ci.jsonc`.

## Analysis — is this a real concern?

**Yes, it is a legitimate high-severity CVE, and the vulnerable code path is
exercised by this project**, but real-world exposure is low.

- The advisory affects workflows that **read** untrusted spreadsheet files.
  This project reads user-selected statement files via `XLSX.read(...)` in
  `src/workers/xlsx-parser.ts` (`readXlsxGrid()` and `parseXlsx()`), so the
  vulnerable path is genuinely reachable.
- There is **no fix available on npm** (`first_patched_version: null`); the
  maintainers moved distribution to a self-hosted CDN and abandoned the npm
  package.

### Existing mitigations (why it is not urgent)

1. **Web Worker isolation** — parsing runs off the main thread; a polluted
   prototype in the worker does not reach the main app / DOM / crypto context.
2. **Local input only** — files are user-selected from the user's own machine.
   There is no server and no remote/attacker-supplied file; an attacker would
   effectively have to attack themselves.
3. **zod validation** — parsed output is schema-validated before persistence.
4. **CodeQL SAST** in CI specifically watches for prototype pollution.

The advisory is explicitly **allowlisted** in `audit-ci.jsonc` with rationale
and **tracked** in `STATE.md`.

### Verdict

Legitimate high-severity CVE with no upstream npm fix. Exposure is low given the
local-first, worker-isolated, single-user architecture — but it should not be
left indefinitely, because prototype pollution can corrupt app state even from a
self-inflicted malformed file. The correct long-term fix is to **remove the
unmaintained dependency**, which is already the recorded decision.

## Decision

Replace `xlsx` with **`exceljs`** (actively maintained, MIT-licensed,
worker-friendly). This eliminates **both** allowlisted `xlsx` advisories at once
(GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9).

Rejected alternative: pinning to the CDN-only `xlsx@0.19.3` build — pulling a
non-npm tarball into the supply chain is worse than a maintained swap.

## Plan

### Phase 1 — Swap the dependency (isolated to the worker layer)

1. `npm rm xlsx && npm i exceljs` (exceljs ships its own types).
2. Rewrite `src/workers/xlsx-parser.ts` against the exceljs API:
   - `readXlsxGrid(data)` → `new ExcelJS.Workbook(); await wb.xlsx.load(data)`,
     read rows into the existing `ImportGrid` shape.
   - `parseXlsx(data, options)` → same column-mapping / date / amount / type
     logic, sourced from exceljs cells.
   - exceljs reading is **async**, so these functions become `async`; update the
     worker message handler and any callers accordingly.
3. Preserve domain behavior **exactly**: date normalization (ISO / Excel-serial
   / DD-MM-YYYY), amount → integer cents via `fromDecimal`, and credit/debit
   inference from amount sign. This is the non-negotiable balance logic — no
   behavioral drift.

### Phase 2 — Verify

4. Run existing tests: `src/workers/xlsx-parser.test.ts` (unit) and
   `e2e/import.spec.ts` (Playwright import flow). Add a fixture with an
   edge-case sheet to confirm parity.
5. Run the full quality gate: typecheck, lint, unit, e2e, and `audit-ci`.

### Phase 3 — Clean up the security debt

6. Remove both `xlsx` entries (`GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`)
   from `audit-ci.jsonc`.
7. Tick the checkbox in `.specs/project/STATE.md` line 210.
8. After merge, the Dependabot alert auto-closes (dependency gone). Optionally
   record an AD-NNN in STATE.md noting the swap.

### Interim fallback (only if Phase 1 cannot be done now)

Keep the allowlist and formally **dismiss** the Dependabot alert as
"risk tolerated", linking to the STATE.md task, so it stops showing as
unaddressed.

## Acceptance criteria

- [ ] `xlsx` removed from `package.json` / `package-lock.json`.
- [ ] `exceljs` reads statement files with identical parsed output to the
      current implementation (unit + e2e green).
- [ ] Both `xlsx` advisories removed from `audit-ci.jsonc`; `audit-ci` passes
      with no allowlist for them.
- [ ] `STATE.md` line 210 checkbox ticked.
- [ ] Dependabot alert #1 closed (auto or dismissed).
