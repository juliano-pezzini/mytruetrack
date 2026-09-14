# Cloud Vault Metadata Specification

## Problem Statement

Encrypted sync today uploads only CRDT change segments. The vault DEK stays local to each browser origin, so a second device (or a wiped/recreated vault on the same Google account) cannot unwrap peer ciphertext and pull fails with “wrong key or tampered data.” Users also cannot tell which device wrote the remote history. This feature makes the vault portable via cloud metadata and attributes writers by device.

## Goals

- [ ] Every successful encrypted push upserts cloud vault metadata sufficient to restore the same DEK on another device with the passphrase
- [ ] Setup offers Restore existing vault when remote metadata exists, and blocks Create until cloud is cleared
- [ ] Device registry in metadata lets users identify which browser/device wrote prior sync data
- [ ] Start fresh vault clears remote segments + metadata, then allows Create
- [ ] Legacy remotes (segments without metadata) are treated as incompatible and require clear-then-create

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Soft-quarantine of undecryptable peer segments | Deferred (findings C); legacy path is clear-then-create |
| Per-vault folder / namespace isolation | Deferred (findings B); shared folder + shared vault identity |
| Separate OAuth clients for localhost vs production | Deferred (findings E); does not deliver restore |
| Encryption badge honesty when DEK is null | Deferred (findings F); related hygiene, not required for restore |
| Envelope magic headers for plaintext vs ciphertext | Deferred unless needed later; legacy forces clear |
| Full passphrase-change UX rewrite | Already local; only next encrypted push must upsert updated wrapped key material |
| Multi-user / shared vaults across different passphrases | Single-user vault model |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Create when remote metadata exists | Block create; lead with Restore | Prevents new DEK colliding with remote history | y |
| Device identity | Auto label + user rename in Settings | Useful default; rename covers S24 / Laptop XYZ | y |
| Metadata write timing | Upsert on every successful encrypted push | Keeps registry and wrapped key current | y |
| Start fresh | Settings action: clear segments + metadata → Create | Productizes operational mitigation | y |
| Wrong passphrase on restore | Error; stay on Restore; no remote/local key writes | Safe failure | y |
| Legacy segments without metadata | Incompatible; must clear then create | Cannot restore without wrapped DEK | y |
| Device history shape | Registry keyed by `crsql_site_id` | Attributes peer segments to devices | y |
| Providers covered | Google Drive and WebDAV via shared metadata module | Both use same sync folder contract | y (agent default) |
| Filename / JSON field names | Agent discretion at design | Not a product fork | y |
| Unencrypted / local-only push (`dek` null) | SHALL NOT upload or overwrite vault metadata | Metadata is for encrypted vaults only | y (agent default) |
| Concurrent first-time writers | First successful metadata upload wins; later device with different local vault must Restore or Start fresh | Matches first-writer-wins from findings A | y (agent default) |
| Clear cloud sync data | Existing clear action also deletes vault metadata once this feature ships | Start fresh and clear must not leave orphan key files | y (agent default) |

**Open questions:** none — all resolved or logged above.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Restore passphrase validated via unwrap failure; device label rename has a non-empty trimmed max length (design picks bound ≤ 64 chars) |
| Failure / partial-failure | Push that uploaded segments but failed metadata upsert SHALL surface a sync error and SHALL retry metadata on the next encrypted push; restore unwrap failure leaves remote and local key store unchanged |
| Idempotency / retry / duplicate handling | Metadata upsert is idempotent overwrite of a single well-known file; repeated pushes refresh the same registry entry for this `siteId` |
| Auth boundaries & rate limits | N/A because access is the user’s already-authorized cloud provider token; no new auth surface |
| Concurrency / ordering | Single metadata file; last successful upsert wins field values; create/restore guards use presence of remote metadata at decision time |
| Data lifecycle / expiry | Metadata lives with the vault until Clear cloud / Start fresh deletes it; no TTL |
| Observability | User-visible errors for restore failure, legacy incompatible remote, and metadata upsert failure; no new telemetry backend required |
| External-dependency failure | IF provider download/upload of metadata fails THEN the system SHALL show a recoverable error and SHALL NOT partially apply a new local vault from incomplete restore |
| State-transition integrity | Allowed setup paths: Create (only when no remote metadata and no legacy-only segments), Restore (when metadata present), Start fresh / Clear → Create; illegal transitions are blocked in UI and sync guards |

---

## User Stories

### P1: Upsert vault metadata on encrypted push ⭐ MVP

**User Story**: As a user, I want my encrypted pushes to also save vault key material and device identity in the cloud so another device can restore and recognize this vault.

**Why P1**: Without portable wrapped DEK + salt, multi-device pull cannot work.

**Acceptance Criteria**:

1. WHEN an encrypted push completes successfully THEN the system SHALL upsert a single well-known vault-metadata JSON file in the same provider folder as change segments
2. The vault-metadata file SHALL include the current wrapped DEK, salt, and PBKDF2 iteration count needed to unwrap the DEK with the user passphrase
3. WHEN an encrypted push completes successfully THEN the system SHALL upsert this device’s entry in the metadata device registry keyed by the local `crsql_site_id`, including display label, browser identifier, and `lastSeenAt`
4. WHEN a push runs without a DEK (local-only / unencrypted mode) THEN the system SHALL NOT create or overwrite the vault-metadata file
5. IF vault-metadata upsert fails after change segments were uploaded THEN the system SHALL report a sync error to the user and SHALL attempt the metadata upsert again on the next successful encrypted push path
6. WHEN the local wrapped DEK or salt changes (e.g. passphrase rewrap) and a later encrypted push succeeds THEN the system SHALL upsert metadata containing the updated wrapped DEK and salt

**Independent Test**: Push from device A with DEK; list provider folder — metadata file present with wrapped key fields and A’s `siteId` registry entry; second push updates `lastSeenAt`.

---

### P1: Restore existing vault on a second device ⭐ MVP

**User Story**: As a user setting up on a new device, I want to restore my existing cloud vault with my passphrase so I can pull and decrypt peer history.

**Why P1**: This is the product fix for the Drive pull decrypt failure across devices/origins.

**Acceptance Criteria**:

1. WHEN setup runs and the configured cloud provider already contains vault metadata THEN the system SHALL offer **Restore existing vault** as the primary path and SHALL NOT allow Create until cloud vault data is cleared
2. WHEN the user chooses Restore and enters the correct passphrase THEN the system SHALL download vault metadata, derive the KEK, unwrap the DEK, persist key data locally via the key store, and unlock the vault
3. WHEN Restore succeeds THEN the system SHALL be able to pull and decrypt remote change segments that were encrypted under that DEK
4. IF the user enters an incorrect passphrase during Restore THEN the system SHALL show a clear error, SHALL remain on the Restore flow, and SHALL NOT modify remote files or the local key store
5. IF metadata download or parse fails during Restore THEN the system SHALL show a recoverable error and SHALL NOT persist partial key data

**Independent Test**: Device A pushes encrypted data; device B (fresh origin) connects same provider, Restores with passphrase, pulls — peer segments decrypt; wrong passphrase leaves B without key data.

---

### P1: Guard create and handle legacy remotes ⭐ MVP

**User Story**: As a user, I want the app to stop me from creating a new vault on top of incompatible cloud history so I do not recreate the decrypt failure.

**Why P1**: Directly prevents the reproduced leftover-peer failure mode.

**Acceptance Criteria**:

1. WHILE remote vault metadata exists the system SHALL block Create new vault
2. WHEN the provider folder contains change segments but no vault-metadata file THEN the system SHALL treat the remote as incompatible legacy history
3. WHILE the remote is incompatible legacy history the system SHALL block Restore (no metadata to restore) and SHALL block Create until the user clears cloud sync data or starts fresh
4. WHEN the user is blocked by legacy incompatible history THEN the system SHALL explain that older sync files cannot be unlocked this way and SHALL offer Clear cloud sync data / Start fresh

**Independent Test**: Seed provider with only `changes-*.bin` (no metadata) — Create and Restore blocked with clear message; after clear, Create succeeds.

---

### P1: Start fresh vault ⭐ MVP

**User Story**: As a user, I want an explicit way to discard cloud vault history and create a new vault when I intend to start over.

**Why P1**: Required escape hatch once Create is blocked by remote metadata.

**Acceptance Criteria**:

1. WHEN the user confirms **Start fresh vault** in Settings THEN the system SHALL delete remote change segments and the vault-metadata file, reset local sync watermarks, and route the user into Create
2. WHEN **Clear cloud sync data** runs THEN the system SHALL delete remote change segments and the vault-metadata file (when present) and reset local sync watermarks
3. The system SHALL NOT create a new local DEK beside an existing remote vault-metadata file without an intervening clear/start-fresh

**Independent Test**: With remote metadata present, Start fresh removes metadata + segments; Create then succeeds and subsequent push writes new metadata.

---

### P2: Device labels and registry visibility

**User Story**: As a user, I want to see and rename devices in the vault registry so I can tell whether prior data came from my phone or laptop.

**Why P2**: Attribution is a stated goal; restore works without polished rename UX, but registry data is written in P1.

**Acceptance Criteria**:

1. WHEN the app first needs a device label THEN the system SHALL auto-generate one from available browser/OS/device-class signals
2. WHEN the user renames the device in Settings THEN the system SHALL persist the custom label locally and SHALL include it in the registry on the next successful encrypted push
3. WHERE vault metadata with a device registry is available the system SHALL present known devices (label and last seen) so the user can identify writers of prior sync history
4. WHEN peer change segments are listed or explained in sync UI THEN the system SHALL use the registry label for a matching `siteId` when present

**Independent Test**: Rename device to “Samsung S24”; push; on another restored device, registry shows “Samsung S24” for that `siteId`.

---

## Edge Cases

- IF two devices with different local vaults race to become first writer THEN the system SHALL treat whichever metadata file is present at restore/create decision time as authoritative; the other device MUST Restore or Start fresh
- IF Restore is attempted while no cloud provider is configured THEN the system SHALL prompt to connect a provider before Restore
- IF Start fresh / Clear fails partway (network error) THEN the system SHALL report failure and SHALL NOT route into Create until remote vault metadata is confirmed absent
- WHEN an encrypted push finds no remote metadata yet (post-feature first writer, same vault) THEN the system SHALL create the metadata file
- IF remote metadata JSON is corrupt or missing required key fields THEN the system SHALL treat it as restore-blocking error and SHALL offer Clear / Start fresh rather than Create-over

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CVM-01 | P1: Upsert vault metadata on encrypted push | Tasks | Verified |
| CVM-02 | P1: Upsert vault metadata on encrypted push | Tasks | Verified |
| CVM-03 | P1: Upsert vault metadata on encrypted push | Tasks | In Tasks |
| CVM-04 | P1: Upsert vault metadata on encrypted push | Tasks | In Tasks |
| CVM-05 | P1: Upsert vault metadata on encrypted push | Tasks | In Tasks |
| CVM-06 | P1: Upsert vault metadata on encrypted push | Tasks | In Tasks |
| CVM-07 | P1: Restore existing vault on a second device | Tasks | In Tasks |
| CVM-08 | P1: Restore existing vault on a second device | Tasks | In Tasks |
| CVM-09 | P1: Restore existing vault on a second device | Tasks | In Tasks |
| CVM-10 | P1: Restore existing vault on a second device | Tasks | In Tasks |
| CVM-11 | P1: Restore existing vault on a second device | Tasks | In Tasks |
| CVM-12 | P1: Guard create and handle legacy remotes | Tasks | In Tasks |
| CVM-13 | P1: Guard create and handle legacy remotes | Tasks | In Tasks |
| CVM-14 | P1: Guard create and handle legacy remotes | Tasks | In Tasks |
| CVM-15 | P1: Guard create and handle legacy remotes | Tasks | In Tasks |
| CVM-16 | P1: Start fresh vault | Tasks | In Tasks |
| CVM-17 | P1: Start fresh vault | Tasks | In Tasks |
| CVM-18 | P1: Start fresh vault | Tasks | In Tasks |
| CVM-19 | P2: Device labels and registry visibility | Tasks | In Tasks |
| CVM-20 | P2: Device labels and registry visibility | Tasks | In Tasks |
| CVM-21 | P2: Device labels and registry visibility | Tasks | In Tasks |
| CVM-22 | P2: Device labels and registry visibility | Tasks | In Tasks |

**ID format:** `CVM-NN` (Cloud Vault Metadata)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 22 total, 0 mapped to tasks, 22 unmapped (tasks phase pending)

---

## Success Criteria

- [ ] Second device can Restore with the same passphrase and pull-decrypt peer segments without “wrong key or tampered data”
- [ ] Create is impossible while remote vault metadata exists
- [ ] Start fresh / Clear removes metadata + segments and then allows Create
- [ ] Legacy segment-only remotes require clear before Create
- [ ] Device registry shows identifiable labels (including user renames) across devices after push
- [ ] Unencrypted pushes never write vault metadata
