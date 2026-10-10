# Cloud Vault Metadata — Context

**Gathered:** 2026-09-13  
**Spec:** `.specs/features/cloud-vault-metadata/spec.md`  
**Status:** Validated PASS — ready for optional UAT  
**Source:** `.specs/features/drive-pull-decrypt-investigation/findings.md` (Recommendation A) + discuss

---

## Feature Boundary

Ship multi-device encrypted sync key portability: whenever encrypted data is saved to the cloud provider, upsert a JSON vault-metadata file that (1) lets a second device restore the same vault via passphrase, and (2) records a device registry so the user can see which device/browser wrote prior sync history. Guard create-new-vault when remote vault metadata exists; productize start-fresh as clear-cloud then create. Legacy remotes with segments but no metadata are treated as incompatible and must be cleared before a new vault.

---

## Implementation Decisions

### Create vs restore when remote vault metadata exists

- Block “create new vault” when cloud vault metadata is present.
- Lead with **Restore existing vault** (download metadata → unwrap with passphrase → `saveKeyData` → pull).
- Create is allowed only after cloud vault metadata (and sync history) has been cleared.

### Device identity

- Auto-generate a device label from available signals (browser / OS / coarse device class).
- User can rename the device in Settings.
- Labels feed the device registry shown when identifying where prior data came from.

### Metadata write timing

- Upsert vault metadata on **every successful encrypted push**.
- Also write on first connect/push if the remote metadata file is missing (same vault, first writer after feature ships).

### Intentional start fresh

- Settings action **Start fresh vault**: clears cloud sync data (change segments **and** vault metadata), then routes the user into Create.
- No path that silently creates a new DEK beside an existing remote vault.

### Wrong passphrase on restore

- Clear error; remain on Restore; do not modify remote files or local key store.

### Legacy cloud (segments without vault metadata)

- Treat as incompatible remote history.
- Block restore-from-metadata and block create until the user clears cloud sync data (or uses Start fresh), then create a new vault.
- Do not soft-skip undecryptable peers as the primary strategy in this feature.

### Device history in metadata

- Metadata JSON includes a **device registry**: `siteId → { label, browser, lastSeenAt, … }`.
- Registry updates on each encrypted push from that site.
- UI can list known devices and attribute peer history when `siteId` matches.

### Agent's Discretion

- Exact JSON schema field names, filename (`vault-metadata.json` vs similar), and UA→label formatting details.
- Whether WebDAV and Google Drive share one metadata module (preferred) vs provider-specific wrappers.
- Precise Settings copy and SetupWizard step order, within the decisions above.

### Declined / Undiscussed Gray Areas → Assumptions

| Topic | Chosen default | Rationale |
| ----- | -------------- | --------- |
| Separate OAuth clients for localhost vs production (findings E) | Out of scope for this feature | Fixes dev contamination only; does not deliver multi-device restore |
| Soft-fail / quarantine incompatible peers (findings C) | Out of scope as primary fix | User chose clear-then-create for legacy; quarantine may return later |
| Folder/namespace isolation per vault (findings B) | Out of scope | Metadata + shared vault identity is the chosen model |
| Envelope magic headers / versioning for plaintext vs ciphertext | Defer unless needed for AC precision | Legacy path already forces clear; distinguish modes later if still needed |
| Key rotation / passphrase change rewriting remote metadata | In scope only as: after local rewrap, next encrypted push upserts updated wrapped DEK + salt | Full rotation UX already exists locally in SecuritySection |

---

## Specific References

- Inspiration: findings Recommendation A — upload vault key metadata; Restore existing vault; guard create when remote key exists.
- User example for device attribution: “saved from Chrome on Samsung S24” vs “Edge on Laptop XYZ”.
- Recovery sheet already instructs: choose “Restore existing vault” (today unimplemented in SetupWizard).
- Crypto spec 8.4 out-of-scope note: multi-device key distribution via wrapped DEK in sync blob — this feature implements that intent.

---

## Deferred Ideas

- Soft-quarantine of undecryptable peer segments (findings C)
- Per-vault folder / namespace isolation (findings B)
- Origin-aware OAuth client IDs for localhost vs production (findings E)
- Encryption badge / Settings honesty when `dek` is null (findings F) — related hygiene, not required to ship metadata restore
