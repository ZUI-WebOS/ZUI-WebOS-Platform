declare const deviceAliasBrand: unique symbol;

export type DeviceAlias = string & { readonly [deviceAliasBrand]: true };

export type DeviceConnectionStatus = "reachable" | "unreachable" | "unknown";

export type DeveloperModeAvailability = "available" | "unavailable" | "unknown";

export interface WebOSDevice {
  readonly alias: DeviceAlias;
  readonly isDefault: boolean;
  readonly profile?: string;
  readonly connectionStatus: DeviceConnectionStatus;
}

export interface DeveloperModeStatus {
  readonly device: DeviceAlias;
  readonly connectionStatus: DeviceConnectionStatus;
  readonly appAvailability: DeveloperModeAvailability;
  readonly expiresAt: string | null;
  readonly remainingSeconds: number | null;
  readonly observedAt: string;
  readonly detail: string;
}

export interface CommandResult {
  readonly executable: string;
  readonly args: readonly string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

export type ExtensionDecision =
  "dry-run" | "extended" | "not-required" | "failed-verification";

export interface ExtensionResult {
  readonly device: DeviceAlias;
  readonly decision: ExtensionDecision;
  readonly commandIssued: boolean;
  readonly commandAccepted: boolean;
  readonly verified: boolean;
  readonly expiryVerified: boolean;
  readonly reason: string;
  readonly before: DeveloperModeStatus;
  readonly after: DeveloperModeStatus | null;
  readonly command: CommandResult | null;
}

export type PlatformErrorCode =
  | "DEVICE_NOT_FOUND"
  | "DEVICE_UNREACHABLE"
  | "WEBOS_CLI_NOT_FOUND"
  | "DEVMODE_APP_UNAVAILABLE"
  | "EXTENSION_FAILED"
  | "VERIFICATION_FAILED"
  | "COMMAND_TIMEOUT"
  | "INVALID_DEVICE_ALIAS"
  | "INVALID_ARGUMENT";

export interface StructuredError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly exitCode: number;
  readonly detail?: string;
}
