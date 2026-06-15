# Phase 8.4 — Crypto Layer Specification

## Problem Statement

All data synced to cloud must be encrypted. The user's passphrase is the only path to their data — there is no server, no password reset, no admin backdoor. This phase builds the key derivation, key wrapping, encrypt/decrypt primitives, session-based biometric unlock, and recovery sheet generator. Everything runs in the browser via Web Crypto API.

## Goals

- [ ] Passphrase → PBKDF2 → KEK → wrap/unwrap DEK pipeline
- [ ] Non-extractable DEK in memory; wrapped DEK + salt persisted in IndexedDB
- [ ] AES-GCM encrypt/decrypt for arbitrary blobs (sync payloads)
- [ ] WebAuthn biometric unlock gates session-scoped DEK access (passphrase entered once per session)
- [ ] Recovery sheet generator (printable HTML with passphrase verification instructions)
- [ ] Pure functions + types, testable in Node.js (Web Crypto available in Node 20+)

## Out of Scope

| Feature                          | Reason                                                                   |
| -------------------------------- | ------------------------------------------------------------------------ |
| Argon2-WASM                      | Deferred (AD-004); PBKDF2 600k iterations is sufficient for launch       |
| WebAuthn PRF extension           | Not yet supported on platforms (AD-004); fallback architecture covers it |
| Cloud sync integration           | Phase 8.5                                                                |
| Onboarding UI                    | Phase 8.8                                                                |
| Key rotation / passphrase change | Post-launch; requires re-wrapping DEK with new KEK                       |
| Multi-device key distribution    | Handled by sync layer — encrypted blob contains wrapped DEK              |

---

## User Stories

### P1: Key derivation and DEK lifecycle ⭐ MVP

**User Story**: As a user, I want my passphrase to derive an encryption key so that my data is protected with a key only I can produce.

**Acceptance Criteria**:

1. WHEN a passphrase is provided THEN the system SHALL derive a KEK via PBKDF2 (600k iterations, SHA-256, random 16-byte salt)
2. WHEN the KEK is derived THEN the system SHALL generate a random AES-GCM-256 DEK and wrap it with AES-KW using the KEK
3. WHEN the DEK is wrapped THEN the system SHALL store the wrapped DEK + salt + iteration count in IndexedDB
4. WHEN a returning user provides their passphrase THEN the system SHALL re-derive the KEK from the stored salt and unwrap the DEK
5. WHEN an incorrect passphrase is provided THEN the unwrap SHALL fail and the system SHALL throw a clear error (not expose the key)

**Independent Test**: Derive → wrap → store → unwrap → verify DEK can encrypt/decrypt.

**Requirement ID**: CRY-01

---

### P1: Encrypt/decrypt blob primitives ⭐ MVP

**User Story**: As a developer, I want encrypt/decrypt functions for arbitrary `Uint8Array` blobs so that the sync layer can encrypt data before upload and decrypt after download.

**Acceptance Criteria**:

1. WHEN `encrypt(dek, plaintext)` is called THEN it SHALL return `{ iv, ciphertext }` using AES-GCM with a random 12-byte IV
2. WHEN `decrypt(dek, iv, ciphertext)` is called THEN it SHALL return the original plaintext
3. WHEN decryption is attempted with a wrong key or tampered ciphertext THEN it SHALL throw (AES-GCM authentication tag failure)
4. WHEN the blob is large (≥ 5 MB) THEN encrypt/decrypt SHALL complete in < 500 ms (validated in spike at 15 ms)

**Independent Test**: Encrypt 1 KB and 5 MB blobs, decrypt, verify byte-for-byte match. Tamper test.

**Requirement ID**: CRY-02

---

### P1: Key store persistence (IndexedDB) ⭐ MVP

**User Story**: As a user, I want my wrapped key to persist across browser sessions so that I only need to set up my passphrase once per device.

**Acceptance Criteria**:

1. WHEN the key store is initialized THEN it SHALL use IndexedDB (via `idb` library) with a named database `mytruetrack-keystore`
2. WHEN `saveKeyData(wrappedDek, salt, iterations)` is called THEN it SHALL persist all three values
3. WHEN `loadKeyData()` is called THEN it SHALL return the stored data or `null` if no key exists
4. WHEN `clearKeyData()` is called THEN it SHALL remove all key material (for recovery/reset flow)
5. WHEN key data exists THEN the app knows a vault has been set up (vs. first-time user)

**Independent Test**: Save → load → verify. Clear → load → null.

**Requirement ID**: CRY-03

---

### P2: WebAuthn biometric session unlock

**User Story**: As a user, I want to unlock the app with my fingerprint/face after entering my passphrase once, so that subsequent opens within the same session are instant.

**Acceptance Criteria**:

1. WHEN the user first unlocks with a passphrase THEN the system SHALL offer to register a WebAuthn platform authenticator
2. WHEN `registerBiometric()` is called THEN it SHALL create a WebAuthn credential with `authenticatorAttachment: 'platform'` and `userVerification: 'required'`
3. WHEN `assertBiometric(credentialId)` is called THEN it SHALL perform a WebAuthn assertion to confirm the user's identity
4. WHEN biometric assertion succeeds THEN the session-scoped DEK (already in memory from passphrase unlock) SHALL remain accessible
5. WHEN `isBiometricAvailable()` is called THEN it SHALL return whether a platform authenticator is available on this device
6. WHEN WebAuthn is not available THEN the system SHALL gracefully degrade to passphrase-only unlock

**Independent Test**: Check availability, register, assert — all programmatic (manual trigger in browser).

**Requirement ID**: CRY-04

---

### P2: Recovery sheet generator

**User Story**: As a user, I want a printable recovery sheet during onboarding so that I can recover my data if I forget my passphrase.

**Acceptance Criteria**:

1. WHEN `generateRecoverySheet(passphrase)` is called THEN it SHALL return an HTML string containing the passphrase (masked by default), recovery instructions, and a verification checksum
2. WHEN the user prints/saves the sheet THEN it SHALL be self-contained (no external resources, inline CSS)
3. WHEN the sheet includes a verification checksum THEN it SHALL be a truncated hash of the passphrase that can be used to verify correct entry without exposing the full passphrase

**Independent Test**: Generate sheet, verify it contains expected sections, verify checksum matches.

**Requirement ID**: CRY-05

---

## Edge Cases

- WHEN the browser does not support Web Crypto THEN `initCrypto()` SHALL throw a clear error
- WHEN IndexedDB is unavailable (e.g., private browsing in some browsers) THEN key persistence SHALL throw with guidance
- WHEN the passphrase is empty THEN key derivation SHALL reject with a validation error
- WHEN `encrypt` is called without a DEK (vault not unlocked) THEN it SHALL throw, not silently produce garbage
- WHEN the wrapped DEK in IndexedDB is corrupted THEN unwrap SHALL throw a descriptive error

---

## Requirement Traceability

| ID     | Story                             | Priority |
| ------ | --------------------------------- | -------- |
| CRY-01 | Key derivation + DEK lifecycle    | P1       |
| CRY-02 | Encrypt/decrypt blob primitives   | P1       |
| CRY-03 | Key store persistence (IndexedDB) | P1       |
| CRY-04 | WebAuthn biometric session unlock | P2       |
| CRY-05 | Recovery sheet generator          | P2       |
