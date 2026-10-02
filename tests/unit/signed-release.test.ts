import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createEphemeralStagingSigner,
  validateManifest,
  validateTrustStore,
  verifyReleaseManifest,
  type PublicTrustStore,
  type ReleaseManifestPayload,
  type TrustedSigningKey,
} from "@zui-webos/signed-release";

function manifest(
  deploymentClass: "staging" | "production" = "staging",
): ReleaseManifestPayload {
  const repository = "https://github.com/ZUI-WebOS/ZUI-YouTube-WebOS";
  return {
    schemaVersion: 1,
    productId: "zui-youtube-webos",
    releaseId: "zui-staging-0.8.4-acceptance",
    version: "0.8.4",
    channel: deploymentClass === "staging" ? "staging" : "stable",
    repository,
    sourceCommit: "ab05d0d220fc57c5c3a5b85f3f5423a1ccf940c2",
    issuedAt: "2026-10-02T00:00:00.000Z",
    artifacts: [
      {
        artifactId: `youtube-${deploymentClass}`,
        filename: `youtube-${deploymentClass}.ipk`,
        appId:
          deploymentClass === "staging"
            ? "com.zui.webos.youtube.staging"
            : "youtube.leanback.v4",
        version: "0.8.4",
        deploymentClass,
        size: 42,
        sha256: "A".repeat(64),
        contentType: "application/vnd.webos.ipk",
        source: {
          provider: "GITHUB_RELEASE",
          repository,
          releaseTag: "zui-staging-0.8.4-acceptance",
          assetName: `youtube-${deploymentClass}.ipk`,
        },
      },
    ],
  };
}

function store(key: TrustedSigningKey): PublicTrustStore {
  return { schemaVersion: 1, keys: [key] };
}

describe("signed release manifests", () => {
  it("canonicalizes object order, numbers, and Unicode deterministically", () => {
    expect(canonicalJson({ z: -0, "😀": "ok", a: [1, 1e30] })).toBe(
      '{"a":[1,1e+30],"z":0,"😀":"ok"}',
    );
    expect(canonicalJson(JSON.parse('{ "z": 0, "a": [1, 1e30] }'))).toBe(
      '{"a":[1,1e+30],"z":0}',
    );
    expect(() => canonicalJson("\ud800")).toThrow(/surrogate/u);
    expect(() => canonicalJson(Number.NaN)).toThrow(/Non-finite/u);
  });

  it("verifies a valid Ed25519 staging signature and rejects mutation", () => {
    const generated = createEphemeralStagingSigner(
      new Date("2026-10-01T00:00:00.000Z"),
    );
    const payload = manifest();
    const signature = generated.signer.sign(payload);
    expect(validateTrustStore(store(generated.trustEntry))).toBe(true);
    expect(
      verifyReleaseManifest(
        payload,
        signature,
        store(generated.trustEntry),
        new Date("2026-10-02T00:00:00.000Z"),
      ).trustDecision,
    ).toBe("SIGNED_TRUSTED");
    expect(
      verifyReleaseManifest(
        { ...payload, version: "0.8.5" },
        signature,
        store(generated.trustEntry),
      ).trustDecision,
    ).toBe("MANIFEST_INVALID");
    expect(
      verifyReleaseManifest(
        { ...payload, releaseId: "changed" },
        signature,
        store(generated.trustEntry),
      ).trustDecision,
    ).toBe("SIGNATURE_INVALID");
    expect(
      verifyReleaseManifest(
        {
          ...payload,
          artifacts: [{ ...payload.artifacts[0]!, sha256: "B".repeat(64) }],
        },
        signature,
        store(generated.trustEntry),
      ).trustDecision,
    ).toBe("SIGNATURE_INVALID");
  });

  it.each([
    ["RETIRED", "SIGNING_KEY_RETIRED"],
    ["REVOKED", "SIGNING_KEY_REVOKED"],
  ] as const)("enforces %s key lifecycle state", (status, decision) => {
    const generated = createEphemeralStagingSigner(
      new Date("2026-10-01T00:00:00.000Z"),
    );
    const payload = manifest();
    expect(
      verifyReleaseManifest(
        payload,
        generated.signer.sign(payload),
        store({ ...generated.trustEntry, status }),
      ).trustDecision,
    ).toBe(decision);
  });

  it("rejects an unknown key, malformed signature, and scope mismatch", () => {
    const a = createEphemeralStagingSigner();
    const b = createEphemeralStagingSigner();
    const staging = manifest();
    expect(
      verifyReleaseManifest(
        staging,
        a.signer.sign(staging),
        store(b.trustEntry),
      ).trustDecision,
    ).toBe("SIGNING_KEY_UNKNOWN");
    expect(
      verifyReleaseManifest(
        staging,
        { ...a.signer.sign(staging), signature: "not-base64" },
        store(a.trustEntry),
      ).trustDecision,
    ).toBe("SIGNATURE_INVALID");
    expect(
      verifyReleaseManifest(
        staging,
        { ...a.signer.sign(staging), algorithm: "RSA" as "Ed25519" },
        store(a.trustEntry),
      ).trustDecision,
    ).toBe("SIGNATURE_INVALID");
    const production = manifest("production");
    expect(
      verifyReleaseManifest(
        production,
        a.signer.sign(production),
        store(a.trustEntry),
      ).trustDecision,
    ).toBe("SIGNING_KEY_SCOPE_MISMATCH");
  });

  it("validates all signed artifact metadata and key identifiers", () => {
    const generated = createEphemeralStagingSigner();
    expect(validateManifest({ ...manifest(), issuedAt: "not-a-date" })).toBe(
      false,
    );
    expect(
      validateTrustStore(
        store({ ...generated.trustEntry, keyId: "A".repeat(64) }),
      ),
    ).toBe(false);
  });
});
