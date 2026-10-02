import type {
  DeveloperModeStatus,
  DeviceAlias,
  ExtensionResult,
  InstalledApplication,
  InventorySnapshot,
  ManagedDevice,
  WebOSDevice,
} from "@zui-webos/shared-types";
import type { CommandResult } from "@zui-webos/shared-types";
import { PlatformError } from "@zui-webos/webos-client";

export interface ExtendOptions {
  readonly dryRun: boolean;
}

export interface WebOSClient {
  listDevices(): Promise<WebOSDevice[]>;
  status(device: DeviceAlias): Promise<DeveloperModeStatus>;
  inspectDevice(device: DeviceAlias): Promise<ManagedDevice>;
  listInstalledApplications(device: DeviceAlias): Promise<InventorySnapshot>;
  inspectInstalledApplication(
    device: DeviceAlias,
    appId: string,
  ): Promise<InstalledApplication | null>;
  extendDeveloperMode(device: DeviceAlias): Promise<CommandResult>;
  isAcceptedExtension(result: CommandResult): boolean;
}

export class DevModeKeeperService {
  constructor(private readonly adapter: WebOSClient) {}

  listDevices(): Promise<WebOSDevice[]> {
    return this.adapter.listDevices();
  }

  status(device: DeviceAlias): Promise<DeveloperModeStatus> {
    return this.adapter.status(device);
  }

  inspectDevice(device: DeviceAlias): Promise<ManagedDevice> {
    return this.adapter.inspectDevice(device);
  }

  listInstalledApplications(device: DeviceAlias): Promise<InventorySnapshot> {
    return this.adapter.listInstalledApplications(device);
  }

  inspectInstalledApplication(
    device: DeviceAlias,
    appId: string,
  ): Promise<InstalledApplication | null> {
    return this.adapter.inspectInstalledApplication(device, appId);
  }

  async extend(
    device: DeviceAlias,
    options: ExtendOptions,
  ): Promise<ExtensionResult> {
    const before = await this.adapter.status(device);
    if (options.dryRun) {
      return {
        device,
        decision: "dry-run",
        commandIssued: false,
        commandAccepted: false,
        verified: false,
        expiryVerified: false,
        reason:
          "Dry-run: the official Developer Mode extension command was not executed.",
        before,
        after: null,
        command: null,
      };
    }

    const command = await this.adapter.extendDeveloperMode(device);
    if (!this.adapter.isAcceptedExtension(command)) {
      throw new PlatformError(
        "EXTENSION_FAILED",
        `Developer Mode extension was not accepted for '${device}'.`,
      );
    }

    const after = await this.adapter.status(device);
    if (after.connectionStatus !== "reachable") {
      throw new PlatformError(
        "VERIFICATION_FAILED",
        `Device '${device}' did not pass the post-extension connectivity check.`,
      );
    }

    return {
      device,
      decision: "extended",
      commandIssued: true,
      commandAccepted: true,
      verified: true,
      expiryVerified: false,
      reason:
        "The official Developer Mode app accepted the extension launch and the device passed a separate post-command connectivity check. The public CLI does not expose the resulting expiry timestamp.",
      before,
      after: { ...after, appAvailability: "available" },
      command,
    };
  }

  ensure(
    device: DeviceAlias,
    options: ExtendOptions,
  ): Promise<ExtensionResult> {
    // The public CLI does not expose expiry. An explicit ensure invocation uses the
    // official idempotent extension path rather than claiming an unknown threshold.
    return this.extend(device, options);
  }
}
