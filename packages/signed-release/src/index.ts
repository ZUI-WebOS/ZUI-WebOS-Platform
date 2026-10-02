import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { readFile } from "node:fs/promises";

export type SigningKeyId = string;
export type SigningKeyStatus = "ACTIVE" | "RETIRED" | "REVOKED";
export type SigningKeyScope = "STAGING_RELEASE" | "PRODUCTION_RELEASE";
export type SignatureTrustDecision =
  | "SIGNED_TRUSTED"
  | "SIGNATURE_INVALID"
  | "SIGNING_KEY_UNKNOWN"
  | "SIGNING_KEY_RETIRED"
  | "SIGNING_KEY_REVOKED"
  | "SIGNING_KEY_SCOPE_MISMATCH"
  | "MANIFEST_INVALID";
export interface TrustedSigningKey {
  readonly keyId: SigningKeyId;
  readonly algorithm: "Ed25519";
  readonly publicKeySpkiDerBase64: string;
  readonly status: SigningKeyStatus;
  readonly scopes: readonly SigningKeyScope[];
  readonly notBefore: string;
  readonly notAfter?: string;
  readonly description: string;
}
export interface PublicTrustStore {
  readonly schemaVersion: 1;
  readonly keys: readonly TrustedSigningKey[];
}
export interface ReleaseManifestArtifact {
  readonly artifactId: string;
  readonly filename: string;
  readonly appId: string;
  readonly version: string;
  readonly deploymentClass: "staging" | "production";
  readonly size: number;
  readonly sha256: string;
  readonly contentType: "application/vnd.webos.ipk";
  readonly source: {
    readonly provider: "GITHUB_RELEASE";
    readonly repository: string;
    readonly releaseTag: string;
    readonly assetName: string;
  };
}
export interface ReleaseManifestPayload {
  readonly schemaVersion: 1;
  readonly productId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly channel: "staging" | "stable";
  readonly repository: string;
  readonly sourceCommit: string;
  readonly issuedAt: string;
  readonly artifacts: readonly ReleaseManifestArtifact[];
}
export interface ReleaseSignature {
  readonly algorithm: "Ed25519";
  readonly keyId: SigningKeyId;
  readonly signature: string;
}
export interface SignatureVerificationResult {
  readonly signatureValid: boolean;
  readonly keyTrusted: boolean;
  readonly keyStatus: SigningKeyStatus | "UNKNOWN";
  readonly keyScope: SigningKeyScope | null;
  readonly manifestCanonical: string;
  readonly artifactMetadataValid: boolean;
  readonly trustDecision: SignatureTrustDecision;
  readonly keyId: string;
}

function validateString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new Error("Lone Unicode surrogate is not canonical JSON.");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff)
      throw new Error("Lone Unicode surrogate is not canonical JSON.");
  }
}
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    validateString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite JSON number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${canonicalJson(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Unsupported canonical JSON value.");
}
export function keyIdFromPublicKey(publicKeySpkiDer: Buffer): SigningKeyId {
  return createHash("sha256")
    .update(publicKeySpkiDer)
    .digest("hex")
    .toUpperCase();
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function isStrictBase64(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value;
  } catch {
    return false;
  }
}
export function validateManifest(
  value: unknown,
): value is ReleaseManifestPayload {
  if (!isRecord(value)) return false;
  const item = value;
  return (
    item.schemaVersion === 1 &&
    typeof item.productId === "string" &&
    typeof item.releaseId === "string" &&
    typeof item.version === "string" &&
    (item.channel === "staging" || item.channel === "stable") &&
    typeof item.repository === "string" &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+$/u.test(item.repository) &&
    typeof item.sourceCommit === "string" &&
    /^[a-f0-9]{40}$/u.test(item.sourceCommit) &&
    isIsoDate(item.issuedAt) &&
    Array.isArray(item.artifacts) &&
    item.artifacts.length > 0 &&
    item.artifacts.every((artifact) => {
      if (!isRecord(artifact) || !isRecord(artifact.source)) return false;
      return (
        typeof artifact.artifactId === "string" &&
        artifact.artifactId.length > 0 &&
        typeof artifact.filename === "string" &&
        artifact.filename.endsWith(".ipk") &&
        typeof artifact.appId === "string" &&
        artifact.appId.length > 0 &&
        artifact.version === item.version &&
        (artifact.deploymentClass === "staging" ||
          artifact.deploymentClass === "production") &&
        typeof artifact.sha256 === "string" &&
        /^[A-Fa-f0-9]{64}$/u.test(artifact.sha256) &&
        Number.isSafeInteger(artifact.size) &&
        (artifact.size as number) > 0 &&
        artifact.contentType === "application/vnd.webos.ipk" &&
        artifact.source.provider === "GITHUB_RELEASE" &&
        artifact.source.repository === item.repository &&
        typeof artifact.source.releaseTag === "string" &&
        artifact.source.releaseTag.length > 0 &&
        artifact.source.assetName === artifact.filename
      );
    })
  );
}
export function validateTrustStore(value: unknown): value is PublicTrustStore {
  if (typeof value !== "object" || value === null) return false;
  const store = value as Partial<PublicTrustStore>;
  if (store.schemaVersion !== 1 || !Array.isArray(store.keys)) return false;
  const ids = new Set<string>();
  return store.keys.every((candidate) => {
    if (!isRecord(candidate)) return false;
    const key = candidate;
    if (
      key.algorithm !== "Ed25519" ||
      typeof key.keyId !== "string" ||
      !/^[A-F0-9]{64}$/u.test(key.keyId) ||
      ids.has(key.keyId) ||
      (key.status !== "ACTIVE" &&
        key.status !== "RETIRED" &&
        key.status !== "REVOKED") ||
      !Array.isArray(key.scopes) ||
      key.scopes.length === 0 ||
      !key.scopes.every(
        (scope) =>
          scope === "STAGING_RELEASE" || scope === "PRODUCTION_RELEASE",
      ) ||
      !isIsoDate(key.notBefore) ||
      (key.notAfter !== undefined && !isIsoDate(key.notAfter)) ||
      (typeof key.notAfter === "string" && key.notAfter <= key.notBefore) ||
      typeof key.description !== "string" ||
      !isStrictBase64(key.publicKeySpkiDerBase64)
    )
      return false;
    try {
      const der = Buffer.from(key.publicKeySpkiDerBase64, "base64");
      if (keyIdFromPublicKey(der) !== key.keyId) return false;
      const publicKey = createPublicKey({
        key: der,
        format: "der",
        type: "spki",
      });
      if (publicKey.asymmetricKeyType !== "ed25519") return false;
    } catch {
      return false;
    }
    ids.add(key.keyId);
    return true;
  });
}
export function verifyReleaseManifest(
  payload: unknown,
  envelope: ReleaseSignature,
  store: PublicTrustStore,
  now = new Date(),
): SignatureVerificationResult {
  let canonical = "";
  const envelopeKeyId =
    isRecord(envelope) && typeof envelope.keyId === "string"
      ? envelope.keyId
      : "";
  if (!validateManifest(payload))
    return {
      signatureValid: false,
      keyTrusted: false,
      keyStatus: "UNKNOWN",
      keyScope: null,
      manifestCanonical: canonical,
      artifactMetadataValid: false,
      trustDecision: "MANIFEST_INVALID",
      keyId: envelopeKeyId,
    };
  canonical = canonicalJson(payload);
  if (
    !isRecord(envelope) ||
    envelope.algorithm !== "Ed25519" ||
    !/^[A-F0-9]{64}$/u.test(envelopeKeyId) ||
    !isStrictBase64(envelope.signature)
  )
    return {
      signatureValid: false,
      keyTrusted: false,
      keyStatus: "UNKNOWN",
      keyScope: null,
      manifestCanonical: canonical,
      artifactMetadataValid: true,
      trustDecision: "SIGNATURE_INVALID",
      keyId: envelopeKeyId,
    };
  const key = store.keys.find((candidate) => candidate.keyId === envelopeKeyId);
  if (key === undefined)
    return {
      signatureValid: false,
      keyTrusted: false,
      keyStatus: "UNKNOWN",
      keyScope: null,
      manifestCanonical: canonical,
      artifactMetadataValid: true,
      trustDecision: "SIGNING_KEY_UNKNOWN",
      keyId: envelopeKeyId,
    };
  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(canonical),
      createPublicKey({
        key: Buffer.from(key.publicKeySpkiDerBase64, "base64"),
        format: "der",
        type: "spki",
      }),
      Buffer.from(envelope.signature, "base64"),
    );
  } catch {
    valid = false;
  }
  const requiredScope: SigningKeyScope = payload.artifacts.some(
    (artifact) => artifact.deploymentClass === "production",
  )
    ? "PRODUCTION_RELEASE"
    : "STAGING_RELEASE";
  const decision: SignatureTrustDecision = !valid
    ? "SIGNATURE_INVALID"
    : key.status === "REVOKED"
      ? "SIGNING_KEY_REVOKED"
      : key.status === "RETIRED"
        ? "SIGNING_KEY_RETIRED"
        : !key.scopes.includes(requiredScope)
          ? "SIGNING_KEY_SCOPE_MISMATCH"
          : now < new Date(key.notBefore) ||
              (key.notAfter !== undefined && now > new Date(key.notAfter))
            ? "SIGNATURE_INVALID"
            : "SIGNED_TRUSTED";
  return {
    signatureValid: valid,
    keyTrusted: decision === "SIGNED_TRUSTED",
    keyStatus: key.status,
    keyScope: requiredScope,
    manifestCanonical: canonical,
    artifactMetadataValid: true,
    trustDecision: decision,
    keyId: key.keyId,
  };
}
export interface ReleaseSigner {
  readonly keyId: string;
  sign(payload: ReleaseManifestPayload): ReleaseSignature;
}
export class NodeReleaseSigner implements ReleaseSigner {
  constructor(
    private readonly privateKey: ReturnType<typeof createPrivateKey>,
    readonly keyId: string,
  ) {}
  static async fromEncryptedPkcs8(
    path: string,
    passphrase: string,
  ): Promise<NodeReleaseSigner> {
    const privateKey = createPrivateKey({
      key: await readFile(path),
      format: "pem",
      passphrase,
    });
    const publicDer = createPublicKey(privateKey).export({
      format: "der",
      type: "spki",
    }) as Buffer;
    return new NodeReleaseSigner(privateKey, keyIdFromPublicKey(publicDer));
  }
  sign(payload: ReleaseManifestPayload): ReleaseSignature {
    return {
      algorithm: "Ed25519",
      keyId: this.keyId,
      signature: sign(
        null,
        Buffer.from(canonicalJson(payload)),
        this.privateKey,
      ).toString("base64"),
    };
  }
}
export function createEphemeralStagingSigner(now = new Date()): {
  signer: ReleaseSigner;
  trustEntry: TrustedSigningKey;
} {
  const pair = generateKeyPairSync("ed25519");
  const der = pair.publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const keyId = keyIdFromPublicKey(der);
  return {
    signer: new NodeReleaseSigner(pair.privateKey, keyId),
    trustEntry: {
      keyId,
      algorithm: "Ed25519",
      publicKeySpkiDerBase64: der.toString("base64"),
      status: "ACTIVE",
      scopes: ["STAGING_RELEASE"],
      notBefore: now.toISOString(),
      description:
        "Ephemeral staging distribution acceptance key; private key was never persisted.",
    },
  };
}
