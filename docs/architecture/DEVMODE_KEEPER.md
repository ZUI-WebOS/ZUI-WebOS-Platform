# DevMode Keeper Architecture

## Contract

DevMode Keeper maintains Developer Mode continuity through LG's public webOS CLI and the Developer Mode application. It never roots the TV or performs package/storage operations.

The only extension operation is constructed as an argument vector equivalent to:

```text
ares-launch com.palmdts.devmode --params extend=true --device <validated-alias>
```

The implementation uses `shell: false`; no user value is interpolated into a shell command.

## Layers

```text
CLI parsing and config
        |
DevModeKeeperService
        |
WebOSCliAdapter
        |
mockable ProcessRunner
        |
LG webOS CLI device registry and Developer Mode app
```

- `shared-types` owns `WebOSDevice`, `DeviceAlias`, `DeviceConnectionStatus`, `DeveloperModeStatus`, `ExtensionResult`, and `CommandResult`.
- `webos-client` owns alias validation, argv construction, process timeout/capture, device-list parsing, connectivity probes, and structured errors.
- `devmode-keeper` owns config precedence, human/JSON output, redaction, and `status`, `extend`, `ensure`, and `doctor` behavior.

## Status and verification semantics

The public CLI confirms whether an alias is registered and whether the target is reachable. It does not expose a supported Developer Mode expiry query. Therefore:

- `expiresAt` and `remainingSeconds` are `null` until an official readable source exists;
- `status` does not claim Developer Mode app availability from an unrelated installed-app list;
- extension is accepted only when `ares-launch` exits successfully and emits the Developer Mode launch marker;
- a separate post-command reachability probe must also pass;
- `verified` means command acceptance plus post-check, while `expiryVerified` remains false.

This separation prevents a successful process exit from being misrepresented as a measured expiry renewal.

## Ensure policy

An explicit `ensure` invocation currently follows the same official idempotent extension path as `extend`, because no supported expiry signal is available. `--threshold-hours` is retained as configuration for a future official status provider but is not used to invent a decision today. `--dry-run` performs preflight only and never launches the Developer Mode app.

## Configuration

Precedence, highest first:

1. CLI arguments;
2. environment (`ZUI_WEBOS_DEVICE`, `ZUI_WEBOS_TIMEOUT_MS`, `ZUI_DEVMODE_RENEW_THRESHOLD_HOURS`, `ZUI_WEBOS_CONFIG`);
3. local user config under `%LOCALAPPDATA%\ZUI WebOS Platform\config.json`;
4. safe defaults (`tv`, 30-second timeout, 24-hour future threshold).

The device alias points to the existing webOS CLI registry. Host addresses and credentials are not stored in project configuration.

## Future scheduler extension point

A future Windows Task Scheduler or service wrapper may call `ensure --json`. It must be opt-in, use the same local config, apply retry/backoff, and notify on failure. This repository does not install or enable a background task by default.
