# CLI Reference

Build with `pnpm build`, then use `pnpm zui-webos -- <command>`. Add `--json` for structured output and `--timeout-ms <positive-number>` to bound public CLI calls.

| Command | Behavior |
|---|---|
| `devices list` | Lists configured aliases. |
| `devices inspect --device tv` | Reads selected-device health and capabilities. |
| `apps list --device tv` | Reads a timestamped installed-app inventory. |
| `apps inspect --device tv --app <id>` | Reports installed state, public metadata, and registry classification. |
| `package inspect <file.ipk>` | Reads archive metadata, manifests, hash, and registry matches. |
| `package verify <file.ipk>` | Performs the same deterministic structural validation and explicitly reports that authenticity is not verified. |
| `install plan <file.ipk> --device tv` | Creates a non-executable comparison and risk plan. Never installs. |
| `doctor [--device tv]` | Checks runtime, public CLI/device registry, product registry, and inspection support. TV connectivity is checked only when `--device` is explicit. |

`devmode status`, `devmode extend`, and `devmode ensure` retain their existing behavior. Use `--dry-run` for extension planning.

Package command success is exit code 0. Invalid input and safety-limit failures return deterministic structured error codes. Installation planning may contain `BLOCK` risks but remains a successful read-only report because it never executes the proposed command.

