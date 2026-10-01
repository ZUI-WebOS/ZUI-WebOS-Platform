import type { DeviceAlias } from "@zui-webos/shared-types";

import { PlatformError } from "./errors.js";

const DEVICE_ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validateDeviceAlias(value: string): DeviceAlias {
  if (!DEVICE_ALIAS.test(value)) {
    throw new PlatformError(
      "INVALID_DEVICE_ALIAS",
      "Device alias must be 1-64 characters and use only letters, digits, dot, underscore, or hyphen.",
    );
  }

  return value as DeviceAlias;
}
