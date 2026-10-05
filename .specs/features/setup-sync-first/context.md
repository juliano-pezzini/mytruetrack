# Setup Sync-First — Context

**Gathered:** 2026-09-15
**Spec:** `.specs/features/setup-sync-first/spec.md`
**Status:** Tasks drafted — awaiting confirmation
**Source:** Drive pull decrypt failure (leftover peer segments vs new local DEK) + discuss

---

## Feature Boundary

Close the onboarding hole where a user creates a new local vault (new DEK, new `crsql_site_id`) and only later attaches a cloud folder that already has encrypted history. Setup asks **cloud vs this-device-only before any passphrase or DEK is generated**. After that choice, the provider is **immutable**. Settings does not connect, switch, or migrate providers. Existing cloud-vault-metadata probe/restore/block rules still apply once a folder is connected.

---

## Implementation Decisions

### Setup sequence

- After Welcome, the next screen is **Use cloud sync?** with two outcomes: **Connect** (Google Drive or WebDAV) or **This device only**.
- Create passphrase, Restore, and Skip encryption appear only after that choice.
- If Connect: authenticate, persist provider config, probe the folder (`empty` / `ready` / `legacy`), then show Restore / Create / Skip according to the probe.
- If This device only: no Drive/WebDAV prompt. Offer Create passphrase or Skip encryption. No Restore.

### Create when the folder already has data

- Keep the existing hard block from cloud-vault-metadata.
- `empty`: Create passphrase (and Skip encryption) allowed, no extra confirm.
- `ready`: Restore is primary. Create is disabled until Clear / Start fresh.
- `legacy`: Restore and Create disabled until Clear / Start fresh, then Create.
- Extra confirmation is on **Clear cloud** and **Start fresh** only (Setup currently runs those in one click; match the Settings confirm dialogs).
- Do not offer Create-with-confirm beside existing remote history.

### Settings cloud provider after setup

- Provider choice is made once at setup and **cannot be changed**.
- Settings does not offer first-time Connect, provider radios, or switching Google ↔ WebDAV ↔ local-only.
- Settings still shows a read-only provider label, Push / Pull (if cloud), Clear / Start fresh, and device rename.
- Google **Reconnect** remains for the same Drive app when the access token expires. WebDAV may retry the **same** endpoint. That is auth refresh, not a provider change.
- This-device-only stays local until a future export/import feature. No “enable sync later.”
- Start fresh vault clears remote history and local keys, then returns to sync-first setup, so a provider may be chosen again.

### Agent's Discretion

- Exact Welcome → sync-choice copy, button labels, and whether Google vs WebDAV is on the same screen or a nested step after Connect.
- How the frozen provider is persisted so Settings cannot treat a missing token as “pick a new provider.”
- Whether Skip encryption remains offered after a successful Connect when the folder is empty (current product allows local-only unencrypted; keep unless spec says otherwise).

### Declined / Undiscussed Gray Areas → Assumptions

| Topic | Chosen default | Rationale |
| ----- | -------------- | --------- |
| What counts as remote “data” | Existing `probeRemoteVault`: metadata → `ready`; `changes-*.bin` without metadata → `legacy`; neither → `empty` | Already shipped; no new classification |
| Typed confirm on Create beside remote files | Not offered | Weaker than the hard block; still plants a new DEK next to old segments |
| Export / import to move data between devices or providers | Out of scope | User deferred to a future feature |
| Changing Google account or WebDAV endpoint after setup | Not allowed | Immutable provider; reconnect is same app / same endpoint |
| Separate OAuth clients for localhost vs GitHub Pages | Out of scope | Does not fix create-before-connect |

---

## Specific References

- Failure: pull `changes-394086bd…-3.bin` (peer Chrome · Windows) after wiping `github.io` data, creating a new passphrase, then connecting Drive in Settings. Same leftover site id as the 2026-09-13 Drive decrypt investigation.
- Existing guards already work **if** a provider is connected at the choice step: SetupWizard probe, Restore primary, Create disabled on `ready`/`legacy`.
- User rejected a second confirm on Create as the primary fix: cloud is unknown until connected, so the confirm never runs on the wipe path.
- User chose extreme Settings simplicity: no automatic data move; future export/import only.

---

## Deferred Ideas

- Export / import vault (portable backup that can seed another origin or provider)
- Enable sync later after This device only
- Soft-quarantine undecryptable peer segments
- Origin-aware OAuth client IDs (localhost vs production Drive folder isolation)
