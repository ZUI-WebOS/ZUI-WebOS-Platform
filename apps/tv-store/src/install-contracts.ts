export const TV_STORE_INSTALL_API_VERSION = 1 as const;
export const TV_STORE_INSTALL_API_PREFIX = "/api/tv-store-install/v1" as const;

export type InstallAction = "INSTALL" | "UPDATE";
export type InstallIntentState =
  | "AWAITING_APPROVAL"
  | "CANCELLED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";
export type InstallProgressPhase =
  | "PREPARING"
  | "VERIFYING_PACKAGE"
  | "CHECKING_TV"
  | "INSTALLING"
  | "VERIFYING_INSTALLATION"
  | "COMPLETE";

export interface InstallSelection {
  readonly productId: string;
  readonly releaseId: string;
  readonly artifactId: string;
}

export interface PairResponse {
  readonly sessionToken: string;
  readonly expiresAt: string;
  readonly deviceAlias: string;
  readonly scope: "STAGING_INSTALL";
}

export interface PublicInstallIntent {
  readonly intentId: string;
  readonly expiresAt: string;
  readonly deviceAlias: string;
  readonly productId: string;
  readonly releaseId: string;
  readonly artifactId: string;
  readonly displayName: string;
  readonly appId: string;
  readonly currentVersion: string | null;
  readonly targetVersion: string;
  readonly action: InstallAction;
  readonly channel: "staging";
  readonly trustDecision: "SIGNED_TRUSTED";
  readonly signingKeyId: string;
  readonly state: InstallIntentState;
  readonly phase: InstallProgressPhase;
}

export interface PublicInstallStatus extends PublicInstallIntent {
  readonly result: null | {
    readonly installedAppId: string;
    readonly installedVersion: string;
    readonly postInstallVerified: true;
  };
  readonly errorCode: string | null;
}

export function isInstallSelection(value: unknown): value is InstallSelection {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<InstallSelection>;
  const keys = Object.keys(value).sort();
  const logical = (candidate: unknown) =>
    typeof candidate === "string" &&
    candidate.length <= 128 &&
    /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/u.test(candidate);
  return (
    keys.length === 3 &&
    keys[0] === "artifactId" &&
    keys[1] === "productId" &&
    keys[2] === "releaseId" &&
    logical(item.productId) &&
    logical(item.releaseId) &&
    logical(item.artifactId)
  );
}
