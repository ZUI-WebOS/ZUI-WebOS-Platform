# Security Baseline

## Repository

- Public repository with MIT-licensed original platform code.
- Secret scanning, push protection, vulnerability alerts, and Dependabot security updates enabled where GitHub supports them.
- Protected `main`: force push and deletion blocked; admin enforcement enabled.
- CI token permission is `contents: read`.
- CodeQL has only `contents: read` and `security-events: write`.
- Third-party actions are pinned to immutable commit SHAs.
- No automatic dependency merge or deployment workflow.

## Development

- Node.js 22 or newer and strict TypeScript.
- Frozen pnpm lockfile in CI.
- Only the required `esbuild` install script is allowed by workspace policy.
- All platform-owned TypeScript must pass format, lint, type-check, unit tests, and build.
- Secrets, IPKs, diagnostics, captures, and local config are ignored.

## Runtime

- Validated device aliases only.
- No IP address hard-coded in source.
- Child processes run without a shell and with a timeout.
- Output is locally captured and sanitized before display.
- Structured errors map to deterministic non-zero exit codes.
- No root, firmware, protected-file, private-service, install/uninstall, or storage-clear operation exists in DevMode Keeper.

## Release gate

Before a platform tag:

1. `pnpm install --frozen-lockfile` succeeds;
2. `pnpm verify` passes;
3. dependency changes and permitted install scripts are reviewed;
4. generated artifacts receive SHA-256 digests;
5. release notes include security-relevant changes and rollback instructions;
6. GitHub Actions and security findings are reviewed.
