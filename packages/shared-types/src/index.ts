declare const deviceAliasBrand: unique symbol;

export type DeviceAlias = string & { readonly [deviceAliasBrand]: true };

export type DeviceConnectionStatus = "reachable" | "unreachable" | "unknown";

declare const installedApplicationIdBrand: unique symbol;
declare const applicationVersionBrand: unique symbol;
export type InstalledApplicationId = string & {
  readonly [installedApplicationIdBrand]: true;
};
export type ApplicationVersion = string & {
  readonly [applicationVersionBrand]: true;
};

export type DeviceCapability =
  | "connectivity"
  | "installed-application-inventory"
  | "developer-mode-extension";
export type InventorySource = "ares-install-listfull";

export interface InstalledApplication {
  readonly id: InstalledApplicationId;
  readonly title?: string;
  readonly version?: ApplicationVersion;
  readonly type?: string;
  readonly vendor?: string;
  readonly source: InventorySource;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface InventorySnapshot {
  readonly device: DeviceAlias;
  readonly timestamp: string;
  readonly source: InventorySource;
  readonly applications: readonly InstalledApplication[];
}

export interface DeviceHealth {
  readonly connectionStatus: DeviceConnectionStatus;
  readonly checkedAt: string;
}

export interface ManagedDevice extends WebOSDevice {
  readonly health: DeviceHealth;
  readonly capabilities: readonly DeviceCapability[];
}

export interface DeviceInventory {
  readonly device: ManagedDevice;
  readonly snapshot: InventorySnapshot;
}

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
  | "DEVICE_INVENTORY_FAILED"
  | "MALFORMED_APP_INVENTORY"
  | "WEBOS_CLI_NOT_FOUND"
  | "DEVMODE_APP_UNAVAILABLE"
  | "EXTENSION_FAILED"
  | "VERIFICATION_FAILED"
  | "COMMAND_TIMEOUT"
  | "INVALID_DEVICE_ALIAS"
  | "INVALID_ARGUMENT"
  | "PACKAGE_NOT_FOUND"
  | "PACKAGE_NOT_FILE"
  | "PACKAGE_TOO_LARGE"
  | "INVALID_PACKAGE"
  | "UNSUPPORTED_PACKAGE_FORMAT"
  | "ARCHIVE_LIMIT_EXCEEDED"
  | "UNSAFE_ARCHIVE_ENTRY"
  | "PACKAGE_METADATA_INVALID";

export interface StructuredError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly exitCode: number;
  readonly detail?: string;
}
