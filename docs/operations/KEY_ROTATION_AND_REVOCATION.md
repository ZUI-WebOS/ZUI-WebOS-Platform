# Key Rotation and Revocation

1. Generate the replacement private key outside Git and publish only its SPKI-derived public entry as `ACTIVE` with the minimum required scope.
2. Validate new staging signatures before changing the old entry.
3. Change the old key from `ACTIVE` to `RETIRED` after issuance moves to the replacement. Platform tooling does not treat RETIRED as eligible for new trusted releases.
4. Change a compromised or disallowed key to `REVOKED`. Do not delete its entry: retained identity makes the denial explicit and auditable.
5. Re-run cache verification. Cached bytes remain on disk, but a signature from a REVOKED key no longer qualifies as `SIGNED_TRUSTED` and cannot enter the signed installation path.

Scopes are independent of lifecycle. `STAGING_RELEASE` must never be expanded to production as a shortcut. Production key creation and trusted-timestamp semantics require a separate milestone.
