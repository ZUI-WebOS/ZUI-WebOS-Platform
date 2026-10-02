# Release Signing Security

Release authenticity uses Node.js Ed25519 and SHA-256; no custom cryptographic primitive is used. Key IDs are the uppercase full SHA-256 digest of SPKI DER public-key bytes.

Only public keys belong in `repository/trust/keys.json`. Private keys, passphrases, tokens, and credentials are forbidden from Git, logs, receipts, CI artifacts, and command arguments. `ReleaseSigner` separates signing from verification. Persistent keys may be loaded only from an encrypted PKCS#8 PEM outside the repository, with the passphrase supplied by a protected caller.

The 2026-10-02 acceptance used an in-memory, staging-scoped ephemeral key. Its private key was never persisted; the checked-in public key is explicitly acceptance-only. This proves the distribution chain but is not an operational long-lived signing setup and cannot authorize production.

An ACTIVE key may validate within its time window. RETIRED signatures remain mathematically checkable but do not receive current `SIGNED_TRUSTED` status because trusted timestamp semantics are out of scope. REVOKED keys always fail trust, including on cached artifacts.
