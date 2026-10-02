# Signed Release Manifest

The platform signs a detached `ReleaseManifestPayload` with Ed25519. The signature envelope contains only `algorithm`, the SHA-256/SPKI-derived `keyId`, and a base64 signature; it is not part of the signed payload.

`canonicalJson` deterministically serializes supported JSON values by rejecting lone Unicode surrogates and non-finite numbers, using ECMAScript JSON number/string serialization, preserving array order, and sorting object keys by UTF-16 code units. Tests cover ordering, whitespace independence, representative number serialization, astral Unicode, and invalid Unicode. This implementation is intentionally described as JCS-compatible for the signed manifest contract, not as a claim of complete RFC 8785 conformance.

The payload binds product, release, version, channel, repository, source commit, issuance time, and one or more complete artifact identities. Every artifact binds filename, app ID, version, deployment class, byte size, SHA-256, content type, provider repository, tag, and asset name.

`SIGNED_TRUSTED` requires a valid schema, valid Ed25519 signature, a known ACTIVE key, a valid key time window, and a permitted scope. A staging-only key can never authorize a production artifact.
