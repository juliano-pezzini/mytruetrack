---
paths: src/ui/components/DangerZone.tsx,src/storage/clear-all-data.ts
alwaysApply: false
---

# Danger Zone

- Both actions stay disabled until the user types `DELETE`.
- Clear all data removes accounts, transactions, categories, tags, and rules. The passphrase, encryption keys, and sync configuration stay. The user remains signed in. When sync is on, the deletion propagates.
- Full reset removes that data and also the passphrase, encryption keys, and cloud sync configuration on this device, then restarts onboarding.
