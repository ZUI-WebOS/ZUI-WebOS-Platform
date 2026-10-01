import type {
  PlatformErrorCode,
  StructuredError,
} from "@zui-webos/shared-types";

const exitCodes: Record<PlatformErrorCode, number> = {
  DEVICE_NOT_FOUND: 10,
  DEVICE_UNREACHABLE: 11,
  WEBOS_CLI_NOT_FOUND: 12,
  DEVMODE_APP_UNAVAILABLE: 13,
  EXTENSION_FAILED: 14,
  VERIFICATION_FAILED: 15,
  COMMAND_TIMEOUT: 16,
  INVALID_DEVICE_ALIAS: 17,
  INVALID_ARGUMENT: 18,
};

export class PlatformError extends Error {
  readonly exitCode: number;

  constructor(
    readonly code: PlatformErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "PlatformError";
    this.exitCode = exitCodes[code];
  }

  toJSON(): StructuredError {
    return {
      code: this.code,
      message: this.message,
      exitCode: this.exitCode,
      ...(this.detail === undefined ? {} : { detail: this.detail }),
    };
  }
}
