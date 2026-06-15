# Phase 8.8 — Onboarding Flow Tasks

**Spec**: `.specs/features/8.8-onboarding/spec.md`  
**Status**: Done

---

## Test Strategy

- **VaultProvider**: Unit-tested with mocked IndexedDB (fake-indexeddb) and mocked crypto functions
- **UI components**: Type-check + build gate only (visual validation, e2e in 8.10)
- **Gate check**: `npx tsc --noEmit && npx vite build && npx vitest run`

---

## Execution Plan

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

T1-T2 are foundation (context + hook). T3-T5 are UI. T6 wires it into the app. T7 is vault provider tests.

---

## Task Breakdown

### T1: VaultProvider + VaultContext

**What**: Create the vault gate. Checks `hasKeyData()` + localStorage `vault-skipped` on mount to determine state. Holds DEK + mode in state. Renders children (main app) when unlocked OR in local-only mode.
**Where**: `src/app/vault-provider.tsx`
**Depends on**: None
**Reuses**: `hasKeyData()`, `loadKeyData()`, `clearKeyData()` from `src/crypto/key-store.ts`
**Requirement**: ONB-01, ONB-04

**Done when**:

- [ ] `VaultContext` created with `{ dek: CryptoKey | null; mode: 'encrypted' | 'local-only'; status: 'loading' | 'needs-setup' | 'needs-unlock' | 'ready'; unlock: (dek: CryptoKey) => void; skipToLocalOnly: () => void; reset: () => Promise<void> }`
- [ ] `VaultProvider` checks `hasKeyData()` + `localStorage.getItem('vault-skipped')` on mount → sets status
- [ ] `skipToLocalOnly()` sets localStorage flag, sets mode to 'local-only', status to 'ready'
- [ ] `unlock(dek)` sets DEK, mode to 'encrypted', status to 'ready'
- [ ] `reset()` clears key store + localStorage flag, status back to 'needs-setup'
- [ ] Children only rendered when `status === 'ready'`
- [ ] Loading/setup/unlock states render corresponding UI (wired in T6)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: T7
**Gate**: build

---

### T2: useVault hook

**What**: Convenience hook to access VaultContext. Throws if used outside VaultProvider.
**Where**: `src/ui/hooks/useVault.ts`
**Depends on**: T1
**Requirement**: ONB-04

**Done when**:

- [ ] Exports `useVault()` returning VaultContext value
- [ ] Throws descriptive error if context is null
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (thin wrapper)
**Gate**: build

---

### T3: PassphraseInput + StrengthMeter components

**What**: Reusable passphrase input with show/hide toggle. Strength meter shows weak/medium/strong based on length.
**Where**: `src/ui/components/PassphraseInput.tsx`, `src/ui/components/StrengthMeter.tsx`
**Depends on**: None
**Requirement**: ONB-02

**Done when**:

- [ ] `PassphraseInput`: controlled input, type toggle (password/text), label prop
- [ ] `StrengthMeter`: takes passphrase string, shows colored bar (red < 8, yellow 8-15, green 16+)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T4: SetupWizard page

**What**: Multi-step new-user onboarding flow. Steps: Welcome → Passphrase Choice → (if chosen) Create Passphrase → Recovery Sheet → Biometric (optional) → Done. "Skip" path goes straight to main app.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T1, T3
**Reuses**: `generateSalt`, `deriveKek`, `generateDek`, `wrapDek`, `saveKeyData`, `generateRecoverySheet`, `isBiometricAvailable`, `registerBiometric`
**Requirement**: ONB-02

**Done when**:

- [ ] Step 1 (Welcome): branding text + "Get Started" button
- [ ] Step 2 (Choice): "Create a passphrase" button + "Skip — local only" button with explanation text
- [ ] "Skip" path: calls `skipToLocalOnly()` on VaultContext → app loads
- [ ] Step 3 (Passphrase): passphrase + confirm inputs, strength meter, min 8 chars validation, "Continue" button
- [ ] On step 3 submit: derive KEK → generate DEK → wrap → save to IndexedDB
- [ ] Step 4 (Recovery): generate HTML, "Download Recovery Sheet" button (Blob URL), "I've saved my recovery sheet" checkbox to enable Continue
- [ ] Step 5 (Biometric): if available, offer enrollment with explanation. Skip button. If not available, auto-skip.
- [ ] Step 6 (Done): "Your vault is ready" message, "Go to Dashboard" button → calls `unlock(dek)` on VaultContext
- [ ] Error handling: show inline errors on derivation/save failures
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (e2e in 8.10)
**Gate**: build

---

### T5: UnlockPage

**What**: Passphrase input for returning users. Derives KEK, unwraps DEK. On success, calls `unlock(dek)` on VaultContext.
**Where**: `src/ui/pages/UnlockPage.tsx`
**Depends on**: T1, T3
**Reuses**: `loadKeyData`, `deriveKek`, `unwrapDek`
**Requirement**: ONB-03, ONB-05

**Done when**:

- [ ] Passphrase input + "Unlock" button
- [ ] On submit: load key data → derive KEK → unwrap DEK → unlock
- [ ] Wrong passphrase: show "Incorrect passphrase" error, clear input
- [ ] Loading state while deriving (PBKDF2 is slow)
- [ ] "Reset Vault" link → ConfirmDialog (destructive) → `reset()` on VaultContext
- [ ] Biometric button if credential exists + available → `assertBiometric()` → unlock cached DEK (only works if DEK was cached in current session)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (e2e in 8.10)
**Gate**: build

---

### T6: Wire VaultProvider into App

**What**: Wrap `App.tsx` with VaultProvider. VaultProvider renders SetupWizard or UnlockPage based on status. Only renders DatabaseProvider + RouterProvider when unlocked.
**Where**: `src/App.tsx`, `src/app/vault-provider.tsx` (update)
**Depends on**: T1, T4, T5
**Requirement**: ONB-01

**Done when**:

- [ ] `App.tsx`: `<VaultProvider>` wraps `<DatabaseProvider>` + `<RouterProvider>`
- [ ] VaultProvider: `status === 'needs-setup'` → `<SetupWizard />`
- [ ] VaultProvider: `status === 'needs-unlock'` → `<UnlockPage />`
- [ ] VaultProvider: `status === 'unlocked'` → render children
- [ ] VaultProvider: `status === 'loading'` → loading spinner
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none
**Gate**: build

---

### T7: VaultProvider unit tests

**What**: Test VaultProvider state transitions with mocked dependencies.
**Where**: `src/app/vault-provider.test.ts`
**Depends on**: T1, T6
**Requirement**: ONB-01, ONB-04

**Done when**:

- [ ] Test: no key data + no skip flag → status is 'needs-setup'
- [ ] Test: key data exists → status is 'needs-unlock'
- [ ] Test: skip flag in localStorage → status is 'ready', mode is 'local-only'
- [ ] Test: unlock(dek) → status is 'ready', mode is 'encrypted'
- [ ] Test: skipToLocalOnly() → sets localStorage flag, status 'ready', mode 'local-only'
- [ ] Test: reset() → clears key store + localStorage, status back to 'needs-setup'
- [ ] Gate: `npx tsc --noEmit && npx vite build && npx vitest run`

**Tests**: yes
**Gate**: full
