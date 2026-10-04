# Release Signing Security

Release authenticity uses Node.js Ed25519 and SHA-256; no custom cryptographic primitive is used. Key IDs are the uppercase full SHA-256 digest of SPKI DER public-key bytes.

Only public keys belong in `repository/trust/keys.json`. Private keys, passphrases, tokens, and credentials are forbidden from Git, logs, receipts, CI artifacts, and command arguments. `ReleaseSigner` separates signing from verification. Persistent keys may be loaded only from an encrypted PKCS#8 PEM outside the repository, with the passphrase supplied by a protected caller.

The 2026-10-02 acceptance used an in-memory, staging-scoped ephemeral key. Its private key was never persisted; its checked-in public entry is retained as `RETIRED` for historical identity and cannot authorize a new trusted release.

The operational staging key is generated once outside Git as AES-256-CBC-encrypted PKCS#8 PEM. The CLI refuses overwrite, uses a hidden prompt by default, never accepts passphrases in argv, zeros local passphrase buffers after use, and applies restrictive ACL/mode controls. Environment input is optional for controlled automation but remains observable to sufficiently privileged local processes. The private key and passphrase are forbidden from GitHub releases, Actions secrets/artifacts in this milestone, logs, receipts, configuration, and documentation.

An ACTIVE key may validate within its time window. RETIRED signatures remain mathematically checkable but do not receive current `SIGNED_TRUSTED` status because trusted timestamp semantics are out of scope. REVOKED keys always fail trust, including on cached artifacts.

Local signing is operator-controlled. CI verifies schemas, signatures, scopes, and artifact identity with public material/test fixtures only; it does not receive the long-lived operational key or passphrase. Production signing remains out of scope and independently blocked.
