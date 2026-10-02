# Trusted Release Metadata

Release metadata separates stable product identity from versioned releases and byte-specific artifacts.

- **Product** defines the external repository and allowed production/staging app IDs.
- **Release** defines product ID, version, channel, source repository, optional release reference, and artifacts.
- **Artifact** defines filename, app ID, version, deployment class, byte size, SHA-256, and a source descriptor.

Records live under `repository/releases/<product-id>/<version>.json` and contain metadata only. Validation rejects unknown products, app IDs outside the product, version or deployment-class inconsistency, invalid hashes/sizes/sources, duplicate artifact IDs, duplicate releases, and conflicting hashes.

## Trust levels

- `UNVERIFIED`: metadata or bytes do not match.
- `REGISTRY_MATCH`: only product/app identity matches.
- `REPOSITORY_PINNED_HASH`: repository metadata pins SHA-256 and size, and current bytes/identity match.
- `SIGNED`: the repository-pinned artifact also matches a currently trusted Ed25519 release manifest and verified cache entry.

Pinned metadata and signed manifests are cumulative. Any hash, size, app ID, version, repository, or deployment-class disagreement blocks the signed path; neither source silently wins. Pinned metadata alone retains the prior staging policy behavior, while `SIGNED` adds release-key authenticity. Arbitrary repository URLs are not accepted.

