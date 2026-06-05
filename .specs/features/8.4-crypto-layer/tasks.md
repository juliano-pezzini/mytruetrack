# Phase 8.4 — Crypto Layer Tasks

**Spec**: `.specs/features/8.4-crypto-layer/spec.md`
**Status**: Done

---

## Test Strategy

Crypto layer tests are **unit tests** using Web Crypto API (available in Node.js 20+ and Vitest's Node environment). No browser required for core crypto — `crypto.subtle` works in Node.

WebAuthn (CRY-04) is browser-only and cannot be unit-tested in Node. It will get a type-safe module with manual browser verification + Playwright e2e coverage in Phase 8.8.

IndexedDB tests use `fake-indexeddb` (pure JS polyfill for Node).

- **Gate check**: `npx tsc --noEmit && npx vitest run`
- **Coverage gate**: `npx vitest run --coverage` (≥ 80% on `src/crypto/`)

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T2 → T3
```

### Phase 2: Features (Parallel)

```
     ┌→ T4 [P] ─┐
T3 ──┤           ├→ (done)
     └→ T5 [P] ─┘
```

---

## Task Breakdown

### T1: Key derivation module

**What**: Implement PBKDF2 key derivation (passphrase → KEK) and DEK generation/wrapping/unwrapping. Pure Web Crypto, no I/O.
**Where**: `src/crypto/key-derivation.ts`, `src/crypto/key-derivation.test.ts`
**Depends on**: None
**Reuses**: Spike B patterns (`spikes/src/spike-b-crypto-auth.ts`)
**Requirement**: CRY-01

**Done when**:
- [ ] `deriveKek(passphrase, salt, iterations)` → returns AES-KW CryptoKey (non-extractable)
- [ ] `generateDek()` → returns AES-GCM-256 CryptoKey (extractable for wrapping)
- [ ] `wrapDek(dek, kek)` → returns `Uint8Array` (wrapped DEK bytes)
- [ ] `unwrapDek(wrappedDek, kek)` → returns AES-GCM CryptoKey (non-extractable)
- [ ] `generateSalt()` → returns random 16-byte `Uint8Array`
- [ ] Constants: `DEFAULT_ITERATIONS = 600_000`, `SALT_LENGTH = 16`
- [ ] Rejects empty passphrase
- [ ] Wrong passphrase → `unwrapDek` throws
- [ ] Tests: derive + wrap + unwrap round-trip, wrong passphrase rejection, empty passphrase rejection
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

### T2: Encrypt/decrypt primitives

**What**: Implement AES-GCM encrypt/decrypt for arbitrary `Uint8Array` blobs. Random IV per encryption. Returns IV + ciphertext as a single `EncryptedBlob` type.
**Where**: `src/crypto/encryption.ts`, `src/crypto/encryption.test.ts`
**Depends on**: T1 (needs DEK type)
**Reuses**: Spike B encrypt/decrypt pattern
**Requirement**: CRY-02

**Done when**:
- [ ] `EncryptedBlob` type: `{ iv: Uint8Array; ciphertext: Uint8Array }`
- [ ] `encrypt(dek, plaintext)` → returns `EncryptedBlob` with random 12-byte IV
- [ ] `decrypt(dek, blob)` → returns `Uint8Array` (original plaintext)
- [ ] `encodeBlob(blob)` → packs IV + ciphertext into a single `Uint8Array` (for storage/upload)
- [ ] `decodeBlob(packed)` → unpacks back to `EncryptedBlob`
- [ ] Wrong key → decrypt throws
- [ ] Tampered ciphertext → decrypt throws
- [ ] Tests: small blob round-trip, large blob (1 MB), pack/unpack, wrong-key failure, tamper failure
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

### T3: Key store (IndexedDB persistence)

**What**: Implement IndexedDB-backed key store for persisting wrapped DEK + salt + iterations across browser sessions. Install `idb` + `fake-indexeddb`. Update vitest.config.ts to cover `src/crypto/`.
**Where**: `src/crypto/key-store.ts`, `src/crypto/key-store.test.ts`, `package.json`, `vitest.config.ts`
**Depends on**: T2 (types for wrapped DEK)
**Reuses**: `idb` library (already validated in Spike B)
**Requirement**: CRY-03

**Done when**:
- [ ] `idb` in dependencies, `fake-indexeddb` in devDependencies
- [ ] `KeyData` type: `{ wrappedDek: Uint8Array; salt: Uint8Array; iterations: number }`
- [ ] `saveKeyData(data)` → persists to IndexedDB `mytruetrack-keystore`
- [ ] `loadKeyData()` → returns `KeyData | null`
- [ ] `clearKeyData()` → removes all key data
- [ ] `hasKeyData()` → returns boolean (vault exists?)
- [ ] `vitest.config.ts` coverage includes `src/crypto/**`
- [ ] Tests (using `fake-indexeddb`): save + load round-trip, clear + load → null, hasKeyData
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration (fake-indexeddb)
**Gate**: quick

---

### T4: WebAuthn biometric module [P]

**What**: Implement WebAuthn registration and assertion functions. Browser-only — types and functions are fully typed but not unit-testable in Node (guards against missing API gracefully).
**Where**: `src/crypto/webauthn.ts`
**Depends on**: T3 (key store for credential ID persistence)
**Reuses**: Spike B WebAuthn pattern
**Requirement**: CRY-04

**Done when**:
- [ ] `isBiometricAvailable()` → checks `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`
- [ ] `registerBiometric(userId, userName)` → creates credential, returns `{ credentialId: Uint8Array }`
- [ ] `assertBiometric(credentialId)` → performs assertion, returns `true` on success
- [ ] `saveCredentialId(id)` / `loadCredentialId()` / `clearCredentialId()` via key store
- [ ] Graceful degradation: all functions return safe defaults when WebAuthn API is absent
- [ ] Type-checks with `npx tsc --noEmit`
- [ ] No unit tests (browser-only API) — manual verification deferred to Phase 8.8 e2e

**Tests**: none (browser-only)
**Gate**: build

---

### T5: Recovery sheet generator [P]

**What**: Generate a self-contained printable HTML recovery sheet with passphrase, verification checksum, and instructions.
**Where**: `src/crypto/recovery-sheet.ts`, `src/crypto/recovery-sheet.test.ts`
**Depends on**: T3 (uses same crypto primitives for checksum)
**Reuses**: None
**Requirement**: CRY-05

**Done when**:
- [ ] `generateVerificationChecksum(passphrase)` → truncated SHA-256 hex (first 8 chars)
- [ ] `generateRecoverySheet(passphrase)` → returns self-contained HTML string
- [ ] HTML includes: passphrase (in a reveal-on-click section), verification checksum, recovery instructions, app name, generation date
- [ ] HTML is self-contained (inline CSS, no external resources)
- [ ] Tests: checksum is deterministic, HTML contains expected sections, checksum in HTML matches
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

## Validation

### Diagram-Definition Cross-Check

| Task | Depends on (definition) | Depends on (diagram) | Match |
|------|------------------------|---------------------|-------|
| T1 | None | None | ✅ |
| T2 | T1 | T1 | ✅ |
| T3 | T2 | T2 | ✅ |
| T4 | T3 | T3 | ✅ |
| T5 | T3 | T3 | ✅ |

### Test Co-location Validation

| Task | Code layer | Test type | Co-located | Valid |
|------|-----------|-----------|------------|-------|
| T1 | crypto/key-derivation | unit | ✅ key-derivation.test.ts | ✅ |
| T2 | crypto/encryption | unit | ✅ encryption.test.ts | ✅ |
| T3 | crypto/key-store | integration | ✅ key-store.test.ts | ✅ |
| T4 | crypto/webauthn | none (browser-only) | N/A | ✅ |
| T5 | crypto/recovery-sheet | unit | ✅ recovery-sheet.test.ts | ✅ |

### Granularity Check

| Task | Files created/modified | Single concept | Atomic |
|------|----------------------|----------------|--------|
| T1 | 2 (module + test) | Key derivation | ✅ |
| T2 | 2 (module + test) | Encrypt/decrypt | ✅ |
| T3 | 4 (module + test + deps + config) | Key persistence | ✅ |
| T4 | 1 (module, no test) | WebAuthn | ✅ |
| T5 | 2 (module + test) | Recovery sheet | ✅ |
