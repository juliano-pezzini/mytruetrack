# Phase 8.8 — Onboarding Flow

## Goal

Onboard users with optional passphrase-based encryption. New users choose between:
- **Passphrase mode**: creates an encrypted vault (passphrase → KEK → DEK). Cloud sync encrypts data before upload.
- **Local-only mode**: skip passphrase entirely. No encryption, no unlock screen. Cloud sync is still allowed but uploads **plaintext** — a strong warning is shown before enabling.

Returning users with a vault unlock with their passphrase. Optional biometric enrollment for convenience. Cloud sync connection itself is deferred to Settings (Phase 8.9+).

**Re-encryption rule**: every time a passphrase is set (first time) or changed, the entire database must be re-exported, encrypted with the new DEK, and pushed to cloud (replacing the old blob).

## Requirements

### ONB-01: App gate — three states on launch

The app checks `hasKeyData()` on launch:
- **Key data exists** → show unlock screen (passphrase required)
- **No key data, first visit** → show setup wizard (choose passphrase or skip)
- **No key data, "skipped" flag in localStorage** → go straight to main app (local-only mode)

The main app is accessible either after DEK unlock OR in local-only mode (no DEK needed).

### ONB-01b: Cloud sync without passphrase

Users in local-only mode (no passphrase) can still enable cloud sync in Settings. Before enabling, the app shows a **strong warning**:

> ⚠️ Your data will be synced to the cloud **without encryption**. Anyone with access to your cloud storage can read your financial data. We strongly recommend setting a passphrase first.
>
> [Set a passphrase instead] [I understand, sync unencrypted]

If user proceeds: sync engine uploads/downloads plaintext snapshots (no encrypt/decrypt step).

### ONB-02: New user setup flow

1. **Welcome** — branding, "Get Started" button
2. **Passphrase Choice** — two clear options:
   - "Create a passphrase" → proceed to passphrase creation (step 3)
   - "Skip for now — I just want to track locally" → set `localStorage('vault-skipped', 'true')`, go to main app
   - Explanation text: passphrase enables cloud sync + encryption. Without it, data lives only in this browser.
3. **Create Passphrase** — input + confirm. Minimum 8 characters. Show strength indicator (length-based: weak/medium/strong). No backend validation.
4. **Recovery Sheet** — generate HTML via `generateRecoverySheet()`. "Download" button (Blob URL download). "I've saved it" checkbox to proceed.
5. **Biometric Enrollment (optional)** — if `isBiometricAvailable()`, offer Touch ID / Windows Hello enrollment. Skip button always visible.
6. **Done** — "Your vault is ready". Proceed to main app.

Key derivation on step 3 completion: `generateSalt()` → `deriveKek(passphrase, salt)` → `generateDek()` → `wrapDek(dek, kek)` → `saveKeyData({ wrappedDek, salt, iterations })`.

### ONB-03: Returning user unlock

- Single passphrase input + "Unlock" button
- `loadKeyData()` → `deriveKek(passphrase, salt, iterations)` → `unwrapDek(wrappedDek, kek)`
- On success → provide DEK to app context → proceed to main app
- On failure → show "Incorrect passphrase" error, stay on unlock screen
- If biometric credential exists and `isBiometricAvailable()`, show biometric button (unlocks session-scoped DEK without re-entering passphrase — requires DEK to already be cached from a prior passphrase unlock in the same browser session)

### ONB-04: App context — VaultContext

Create a `VaultContext` that holds:
- `dek: CryptoKey | null` — available after passphrase unlock, null in local-only mode
- `mode: 'encrypted' | 'local-only'` — determines whether sync encrypts data

The `DatabaseProvider` + router render when either:
- DEK is available (encrypted mode), OR
- User is in local-only mode (no DEK needed)

Sync engine behavior based on mode:
- `'encrypted'` → encrypt before upload, decrypt after download (uses DEK)
- `'local-only'` → upload/download plaintext snapshots (no crypto step)

### ONB-05: Re-encryption on passphrase set/change

When a passphrase is **set for the first time** (local-only → encrypted) or **changed**:
1. Derive new KEK + generate new DEK (or re-wrap existing DEK with new KEK)
2. Export full database snapshot
3. Encrypt snapshot with new DEK
4. Push encrypted blob to cloud (replacing any existing plaintext or old-encrypted blob)
5. Save new `KeyData` to IndexedDB
6. Update VaultContext mode to `'encrypted'`

This ensures the cloud always has data encrypted with the current key.

### ONB-05: Reset vault

On the unlock screen, provide a "Reset Vault" link (destructive: clears IndexedDB key store + SQLite data). Requires confirmation dialog.

## Non-requirements (deferred)

- Cloud sync connection UI (Settings page, Phase 8.9)
- Restore from cloud (requires cloud provider auth first)
- Passphrase change flow UI (Settings, future — but the re-encryption logic is specced here)
- Add passphrase to an existing local-only vault UI (Settings, future)
- Argon2 upgrade (PBKDF2 sufficient for launch)

## Architecture

```
App.tsx
  └─ VaultProvider              ← new: holds CryptoKey | null + mode
       ├─ (first visit, no vault) → SetupWizard
       ├─ (vault exists) → UnlockScreen
       ├─ (local-only mode) → DatabaseProvider → RouterProvider  (dek = null)
       └─ (vault unlocked) → DatabaseProvider → RouterProvider   (dek = CryptoKey)
```

## Files

| File | Purpose |
|------|---------|
| `src/app/vault-provider.tsx` | VaultContext + VaultProvider (gate component) |
| `src/ui/hooks/useVault.ts` | Hook to access DEK from context |
| `src/ui/pages/UnlockPage.tsx` | Passphrase input for returning users |
| `src/ui/pages/SetupWizard.tsx` | Multi-step new-user onboarding |
| `src/ui/components/PassphraseInput.tsx` | Reusable passphrase field with show/hide toggle |
| `src/ui/components/StrengthMeter.tsx` | Visual passphrase strength indicator |

## Testing

- **Unit tests**: VaultProvider state transitions (mock key-store, mock key-derivation)
- **Gate check**: `npx tsc --noEmit && npx vite build && npx vitest run`
- **E2e**: Phase 8.10 (Playwright)
