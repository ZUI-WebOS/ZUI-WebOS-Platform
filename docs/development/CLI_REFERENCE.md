# CLI Reference

Build with `pnpm build`, then use `pnpm zui-webos -- <command>`. Add `--json` for structured output and `--timeout-ms <positive-number>` to bound public CLI calls.

| Command                                                                                        | Behavior                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `devices list`                                                                                 | Lists configured aliases.                                                                                                                          |
| `devices inspect --device tv`                                                                  | Reads selected-device health and capabilities.                                                                                                     |
| `apps list --device tv`                                                                        | Reads a timestamped installed-app inventory.                                                                                                       |
| `apps inspect --device tv --app <id>`                                                          | Reports installed state, public metadata, and registry classification.                                                                             |
| `package inspect <file.ipk>`                                                                   | Reads archive metadata, manifests, hash, and registry matches.                                                                                     |
| `package verify <file.ipk>`                                                                    | Performs the same deterministic structural validation and explicitly reports that authenticity is not verified.                                    |
| `release list`                                                                                 | Validates and lists local product release records.                                                                                                 |
| `release inspect <artifact-id>`                                                                | Displays one pinned artifact record.                                                                                                               |
| `trust keys list`                                                                              | Lists public key IDs, lifecycle state, and allowed scopes.                                                                                         |
| `release manifest build <artifact-id> <source-commit> <output.json>`                           | Builds a non-overwriting staging manifest from pinned metadata.                                                                                    |
| `release manifest sign <manifest.json> <signature.json> <public-key.json> --ephemeral-staging` | Creates an acceptance-only in-memory Ed25519 key and writes only its detached signature and public entry.                                          |
| `release manifest verify <manifest.json> <signature.json>`                                     | Reports signature, key, scope, canonical payload, metadata, and trust decision.                                                                    |
| `artifact fetch <owner/repo> <tag> <artifact-id>`                                              | Runs authenticated GitHub discovery and the complete signed streaming/cache path.                                                                  |
| `artifact cache list`                                                                          | Lists content-addressed cache digests.                                                                                                             |
| `artifact cache verify <sha256>`                                                               | Revalidates signature/key state and cached IPK bytes/identity.                                                                                     |
| `install plan <file.ipk> --device tv --save <plan.json>`                                       | Creates a canonical expiring plan without overwriting an existing file.                                                                            |
| `install execute <plan.json> --approve <digest>`                                               | Executes only an exact, current, pinned staging plan through InstallerService.                                                                     |
| `install receipts`                                                                             | Lists local receipt files outside Git.                                                                                                             |
| `doctor [--device tv]`                                                                         | Checks runtime, public CLI/device registry, product registry, and inspection support. TV connectivity is checked only when `--device` is explicit. |

`devmode status`, `devmode extend`, and `devmode ensure` retain their existing behavior. Use `--dry-run` for extension planning.

Package command success is exit code 0. Invalid input and safety-limit failures return deterministic structured error codes. Production plans always remain blocked. There is no `--yes`, `--force`, production override, uninstall, or storage-clear command.

Catalog/update intelligence is currently exposed by the local Web Manager rather than a second CLI command family. Its API accepts trusted logical IDs only, reuses `artifact fetch`/cache verification and the existing planner internally, and never exposes installation execution.

Catalog-specific structured failures use exit/status codes 70–77 for missing products/releases, incompatible releases, unavailable/failing artifacts, verification failure, invalid versions, and invalid catalog sources. Normal browser responses map these to stable messages and recovery actions without raw stack traces.

The current signing command intentionally supports only ephemeral staging acceptance. Operational persistent signing requires an encrypted external PKCS#8 key and a secret-input workflow; no private key is created in the repository.
