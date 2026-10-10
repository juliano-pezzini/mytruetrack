---
applyTo: "src/crypto/**"
---

# Keys and encryption

- Passphrase to key-encryption key: PBKDF2, 600000 iterations, SHA-256, then AES-KW-256.
- The data-encryption key is wrapped with AES-KW. Wrapped keys live in the IndexedDB database `mytruetrack-keystore`.
- Payload encryption is AES-GCM with a fresh 12-byte IV on every blob. The IV is stored with the ciphertext.
- WebAuthn prefers the PRF extension. When PRF is unavailable, the wrapped-key fallback unlocks the same vault.
- Keep keys non-extractable where the API allows it. Do not log keys or passphrases.
