# Release Process

## Versioning

The platform uses Semantic Versioning. Tags use `vMAJOR.MINOR.PATCH`. Until the first stable contract, minor versions may add CLI and schema features while patch versions fix compatible behavior.

## Release gate

1. Start from a clean `main` synchronized with `origin/main`.
2. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm verify` and confirm CI/CodeQL status.
4. Review dependency, workflow permission, registry, and security-document changes.
5. Update release notes and version metadata.
6. Create an annotated tag and GitHub Release.
7. Attach only intentional artifacts; publish a SHA-256 manifest and provenance notes.

No release artifact is produced from `.migration-rehearsal`, sibling product repositories, local configuration, device logs, or secrets.

## Provenance

Each release records the Git commit, Node/pnpm versions, lockfile hash, CI run, artifact byte size, and SHA-256. Generated binaries are never silently replaced under an existing tag.

## Rollback

If a release is unsafe, mark it clearly in GitHub, publish a revocation/advisory note, and point users to the last validated tag. Do not rewrite a public tag. Corrective code ships as a new SemVer release.
