import type {
  PlatformErrorCode,
  StructuredError,
} from "@zui-webos/shared-types";

const exitCodes: Record<PlatformErrorCode, number> = {
  DEVICE_NOT_FOUND: 10,
  DEVICE_UNREACHABLE: 11,
  DEVICE_INVENTORY_FAILED: 19,
  MALFORMED_APP_INVENTORY: 20,
  WEBOS_CLI_NOT_FOUND: 12,
  DEVMODE_APP_UNAVAILABLE: 13,
  EXTENSION_FAILED: 14,
  VERIFICATION_FAILED: 15,
  COMMAND_TIMEOUT: 16,
  INVALID_DEVICE_ALIAS: 17,
  INVALID_ARGUMENT: 18,
  PACKAGE_NOT_FOUND: 30,
  PACKAGE_NOT_FILE: 31,
  PACKAGE_TOO_LARGE: 32,
  INVALID_PACKAGE: 33,
  UNSUPPORTED_PACKAGE_FORMAT: 34,
  ARCHIVE_LIMIT_EXCEEDED: 35,
  UNSAFE_ARCHIVE_ENTRY: 36,
  PACKAGE_METADATA_INVALID: 37,
  RELEASE_METADATA_INVALID: 40,
  ARTIFACT_METADATA_INVALID: 41,
  ARTIFACT_HASH_MISMATCH: 42,
  ARTIFACT_SIZE_MISMATCH: 43,
  ARTIFACT_IDENTITY_MISMATCH: 44,
  UNTRUSTED_ARTIFACT: 45,
  PLAN_EXPIRED: 50,
  PLAN_TAMPERED: 51,
  PLAN_STALE: 52,
  APPROVAL_REQUIRED: 53,
  INSTALL_POLICY_BLOCKED: 54,
  INSTALL_FAILED: 55,
  INSTALL_VERIFICATION_FAILED: 56,
  RECEIPT_WRITE_FAILED: 57,
  SIGNATURE_INVALID: 60,
  SIGNING_KEY_UNKNOWN: 61,
  SIGNING_KEY_REVOKED: 62,
  SIGNING_KEY_SCOPE_MISMATCH: 63,
  MANIFEST_INVALID: 64,
  DISTRIBUTION_FAILED: 65,
  CACHE_VERIFICATION_FAILED: 66,
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
