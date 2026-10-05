# Setup Sync-First Specification

## Problem Statement

Setup today lets a user create a passphrase (a new DEK) before any cloud provider is connected. After a site-data wipe, tokens are gone, so the existing restore/create guards never run. The user then attaches Drive in Settings and pull fails on leftover peer segments encrypted under the old vault. This feature asks cloud vs this-device-only before any DEK is generated, keeps the existing probe block on Create, and freezes the provider after setup so Settings cannot silently attach a folder later.

## Goals

- [ ] No new local DEK can be created until the user has chosen Connect cloud or This device only
- [ ] After Connect, Create is impossible while the folder is `ready` or `legacy` (same probe as cloud-vault-metadata)
- [ ] Settings cannot change provider type or first-connect a provider after setup
- [ ] Start fresh returns to sync-first setup so a provider may be chosen again

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Export / import vault between origins or providers | Deferred; user chose this as the later move path |
| Enable sync after This device only | Provider is immutable after setup |
| Create-with-confirm beside existing remote history | Weaker than the hard block; still plants a new DEK next to old segments |
| Separate OAuth clients for localhost vs GitHub Pages | Does not fix create-before-connect |
| Soft-quarantine of undecryptable peer segments | Already deferred in cloud-vault-metadata |
| Changing Google account or WebDAV endpoint/folder after setup | Immutable provider |
| Rewriting passphrase crypto or Drive folder layout | Existing vault-metadata probe/restore/push stay as-is |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Setup order | Welcome then Use cloud sync (Connect or This device only), then Restore/Create/Skip | Only way the probe can run before `generateDek()` | y |
| Create when folder has data | Keep hard block; extra confirm only on Clear / Start fresh | Existing CVM guards; confirm-on-Create does not prevent the wipe path | y |
| Provider after setup | Frozen; Settings has no Connect, no provider radios, no switch | User chose extreme simplicity; no automatic data move | y |
| Token / credential refresh | Google Reconnect same Drive app; WebDAV retry same endpoint (credentials may be re-entered) | Access tokens expire; that is not a provider change | y |
| This device only later | Cannot enable Drive/WebDAV until a future export/import feature | Immutable choice | y |
| Start fresh | Clears remote (if any) + local keys, then sync-first setup (provider may be chosen again) | New vault identity; CVM routed straight to Create, this feature replaces that | y |
| What counts as remote data | Existing `probeRemoteVault`: `ready` / `legacy` / `empty` | Already shipped | y |
| Skip encryption after Connect | Allowed only when probe is `empty`; blocked while `ready` or `legacy` | Matches current skip disable on remoteBlocked; empty unencrypted cloud stays possible | y (agent default) |
| Google vs WebDAV UI | Agent discretion whether both appear on one Connect screen or nested | Not a product fork | y |
| Frozen-provider persistence | Design picks the flag/record so a missing Google token is not treated as “pick a provider” | Implementation detail | y |

**Open questions:** none — all resolved or logged above.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Passphrase rules stay as today (min 8, confirm match). WebDAV endpoint/folder are chosen once at setup; Settings cannot edit them. |
| Failure / partial-failure | Connect or probe failure stays in setup, no new DEK. Clear/Start fresh that fail mid-network do not route into a new vault until the probe shows the folder is no longer `ready`/`legacy` (or no provider remains). |
| Idempotency / retry / duplicate handling | Failed Connect may be retried. Google Reconnect replaces tokens for the same app. Probe is re-run after successful Clear. |
| Auth boundaries & rate limits | N/A because auth is the existing GIS/WebDAV user credential; no new auth surface. |
| Concurrency / ordering | Single-tab setup; provider freeze is recorded before passphrase creation. Probe result at decision time is authoritative. |
| Data lifecycle / expiry | Provider choice lives until Start fresh (or site-data wipe, which restarts setup). Google tokens still expire and are refreshed via Reconnect. |
| Observability | User-visible errors for connect failure, probe failure, and Clear/Start fresh failure. No new telemetry backend. |
| External-dependency failure | IF Google/WebDAV connect or folder list/probe fails THEN the system SHALL show a recoverable error and SHALL NOT generate or persist a DEK. |
| State-transition integrity | Legal: Welcome → sync choice → (Connect+probe \| This device only) → Restore \| Create \| Skip. Illegal: Create/Restore/Skip before sync choice; Create/Skip while `ready`/`legacy`; Settings first-connect or provider switch. Start fresh → sync choice (not straight to Create). |

---

## User Stories

### P1: Sync-first setup before any vault ⭐ MVP

**User Story**: As a new or wiped-origin user, I want to choose cloud sync or this device only before creating a passphrase so the app can see existing Drive files before it mints a new DEK.

**Why P1**: This is the hole that caused the GitHub Pages pull decrypt failure.

**Acceptance Criteria**:

1. WHEN the user proceeds from Welcome THEN the system SHALL show a Use cloud sync choice (Connect cloud or This device only) before Create passphrase, Restore existing vault, or Skip encryption
2. The system SHALL NOT generate a DEK or persist key-store data until after the user has completed the Connect or This device only choice
3. WHEN the user chooses This device only THEN the system SHALL offer Create passphrase and Skip encryption and SHALL NOT offer Restore existing vault and SHALL NOT prompt for Google Drive or WebDAV
4. WHEN the user chooses Connect THEN the system SHALL require a successful Google Drive or WebDAV connection, persist that provider, and probe the folder before showing Restore, Create, or Skip
5. IF cloud connect or folder probe fails THEN the system SHALL show a recoverable error, SHALL NOT persist a new DEK, and SHALL remain in setup

**Independent Test**: Wipe origin; open setup; Create passphrase is unreachable until Connect or This device only; Connect + existing `vault-metadata.json` shows Restore, not a live Create button.

---

### P1: Probe still blocks Create on existing cloud history ⭐ MVP

**User Story**: As a user who connected cloud during setup, I want Create blocked when the folder already has a vault or leftover segments so I cannot recreate the decrypt collision.

**Why P1**: Reorder without the existing CVM guards would still allow Create on a non-empty folder.

**Acceptance Criteria**:

1. WHEN the connected folder probe is `empty` THEN the system SHALL allow Create passphrase and Skip encryption with no extra confirmation
2. WHEN the connected folder probe is `ready` THEN the system SHALL offer Restore existing vault as the primary action and SHALL disable Create passphrase until Clear cloud or Start fresh succeeds
3. WHILE the connected folder probe is `legacy` the system SHALL disable Restore and Create passphrase, SHALL disable Skip encryption, and SHALL explain that leftover sync files cannot be unlocked this way
4. WHILE the connected folder probe is `ready` the system SHALL disable Skip encryption
5. The system SHALL NOT offer a Create path that leaves remote change segments or vault metadata in place
6. WHEN the user chooses Clear cloud sync data or Start fresh vault during setup THEN the system SHALL require a second confirmation (same intent as Settings) before deleting remote files

**Independent Test**: Connect to a folder with `changes-*.bin` and metadata — Create and Skip disabled, Restore enabled; confirm Clear, then Create is enabled; cancel confirm leaves remote files and Create still disabled.

---

### P1: Frozen provider in Settings ⭐ MVP

**User Story**: As a user who already finished setup, I want Settings to show my chosen storage as read-only so I cannot attach a different cloud folder to this vault.

**Why P1**: Settings first-connect after a local DEK is the second half of the failure.

**Acceptance Criteria**:

1. WHILE setup has recorded a storage choice (Google Drive, WebDAV, or This device only) the system SHALL NOT present controls to select a different provider type
2. WHEN setup recorded This device only THEN Settings SHALL NOT offer Connect with Google, WebDAV configuration, or any enable-sync action
3. WHEN setup recorded Google Drive THEN Settings SHALL show a read-only Google Drive label and SHALL offer Reconnect for the same Drive app when the access token is missing or expired
4. WHEN setup recorded WebDAV THEN Settings SHALL show the setup endpoint and folder as read-only, SHALL allow retrying that same endpoint (including re-entering credentials for it), and SHALL NOT allow changing the endpoint or folder
5. WHERE a cloud provider was recorded at setup the system SHALL still offer Push Now, Pull Now, Clear cloud sync data, Start fresh vault, and device rename in Settings

**Independent Test**: Finish setup as This device only — Settings has no Connect; finish setup with Drive — Settings has Reconnect and no provider radio; WebDAV endpoint fields are not editable.

---

### P1: Start fresh returns to sync-first setup ⭐ MVP

**User Story**: As a user who wants a new vault, I want Start fresh to wipe cloud history and local keys and then ask cloud vs this-device-only again so I do not skip the probe.

**Why P1**: Today Start fresh jumps to Create (`setup-after-fresh=create`), which would recreate the hole.

**Acceptance Criteria**:

1. WHEN the user confirms Start fresh vault THEN the system SHALL delete remote change segments and vault metadata when a cloud provider is configured, reset local sync watermarks, clear local key data, and route to the Use cloud sync choice (not directly to Create passphrase)
2. WHEN Start fresh returns to setup THEN the system SHALL allow the user to choose Connect or This device only again
3. WHEN the user confirms Start fresh vault and no cloud provider is configured THEN the system SHALL clear local key data and route to the Use cloud sync choice without requiring a remote delete
4. IF Start fresh or Clear cloud fails before remote vault data is gone THEN the system SHALL report failure and SHALL NOT route into a new Create passphrase while the folder is still `ready` or `legacy`

**Independent Test**: Encrypted Drive vault, confirm Start fresh — metadata/segments gone, setup shows Use cloud sync; canceling the confirm leaves the vault and Settings provider unchanged.

---

## Edge Cases

- IF the user cancels Google/WebDAV connect before success THEN the system SHALL return to Use cloud sync without recording a frozen cloud provider
- IF the user completes Connect but the folder probe is `ready` and they abandon Restore THEN the system SHALL NOT generate a local DEK and SHALL keep them in setup until Restore, Clear/Start fresh then Create, or they go back to Use cloud sync
- WHEN site data for the origin is wiped THEN the system SHALL treat the next visit as new setup (sync-first), because local freeze state is gone
- IF Google Reconnect fails THEN the system SHALL keep the recorded Drive provider and SHALL NOT offer switching to WebDAV or This device only

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SSF-01 | P1: Sync-first setup before any vault | Execute | Verified |
| SSF-02 | P1: Sync-first setup before any vault | Execute | Verified |
| SSF-03 | P1: Sync-first setup before any vault | Execute | Verified |
| SSF-04 | P1: Sync-first setup before any vault | Execute | Verified |
| SSF-05 | P1: Sync-first setup before any vault | Execute | Verified |
| SSF-06 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-07 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-08 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-09 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-10 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-11 | P1: Probe still blocks Create on existing cloud history | Execute | Verified |
| SSF-12 | P1: Frozen provider in Settings | Execute | Verified |
| SSF-13 | P1: Frozen provider in Settings | Execute | Verified |
| SSF-14 | P1: Frozen provider in Settings | Execute | Verified |
| SSF-15 | P1: Frozen provider in Settings | Execute | Verified |
| SSF-16 | P1: Frozen provider in Settings | Execute | Verified |
| SSF-17 | P1: Start fresh returns to sync-first setup | Execute | Verified |
| SSF-18 | P1: Start fresh returns to sync-first setup | Execute | Verified |
| SSF-19 | P1: Start fresh returns to sync-first setup | Execute | Verified |
| SSF-20 | P1: Start fresh returns to sync-first setup | Execute | Verified |

**ID format:** `SSF-NN` (Setup Sync-First)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 total, 20 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] After a github.io (or any origin) wipe, the user cannot mint a new passphrase until they pick Connect or This device only
- [ ] Connecting a folder that already has vault metadata or leftover `changes-*.bin` cannot Create until Clear / Start fresh
- [ ] Settings has no path to attach Drive/WebDAV after This device only, and no path to switch providers
- [ ] Start fresh lands on Use cloud sync, not Create passphrase
- [ ] Google token expiry is handled with Reconnect on the same app
