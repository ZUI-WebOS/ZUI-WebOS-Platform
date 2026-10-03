import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Badge,
  Button,
  EmptyState,
  Metric,
  Panel,
} from "@zui-webos/design-system";
import type {
  CatalogDto,
  DashboardDto,
  DeviceDetailDto,
  CatalogFetchResultDto,
  PackageResultDto,
  ProductUpdateComparison,
  PublicInstallationPlanDto,
  ReceiptDto,
  CacheDto,
} from "../contracts.js";
import { api, guardedHeaders } from "./api-client.js";
import { translate, type Locale, type MessageKey } from "./i18n.js";

type View =
  | "dashboard"
  | "devices"
  | "applications"
  | "catalog"
  | "packages"
  | "cache"
  | "receipts"
  | "settings";
const nav: readonly [View, MessageKey][] = [
  ["dashboard", "dashboard"],
  ["devices", "devices"],
  ["applications", "applications"],
  ["catalog", "catalog"],
  ["packages", "packages"],
  ["cache", "cache"],
  ["receipts", "receipts"],
  ["settings", "settings"],
];
const viewFromHash = (): View => {
  const candidate = window.location.hash
    .replace(/^#\/?/u, "")
    .split("/")[0] as View;
  return nav.some(([view]) => view === candidate) ? candidate : "dashboard";
};
function trustTone(value: string) {
  return value.includes("SIGNED")
    ? ("positive" as const)
    : value.includes("REVOKED") || value.includes("INVALID")
      ? ("danger" as const)
      : value.includes("PINNED")
        ? ("info" as const)
        : ("warning" as const);
}
function ErrorBox({
  error,
}: {
  error: Error & { code?: string; action?: string | null };
}) {
  return (
    <div className="error" role="alert">
      <strong>{error.message}</strong>
      {error.code && <code>{error.code}</code>}
      {error.action && <span>{error.action}</span>}
    </div>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem("zui-locale") === "tr" ? "tr" : "en",
  );
  const [view, setView] = useState<View>(viewFromHash);
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [catalog, setCatalog] = useState<CatalogDto | null>(null);
  const [cache, setCache] = useState<readonly CacheDto[]>([]);
  const [receipts, setReceipts] = useState<readonly ReceiptDto[]>([]);
  const [device, setDevice] = useState<DeviceDetailDto | null>(null);
  const [pkg, setPkg] = useState<PackageResultDto | null>(null);
  const [plan, setPlan] = useState<PublicInstallationPlanDto | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [fetchResult, setFetchResult] = useState<CatalogFetchResultDto | null>(
    null,
  );
  const [error, setError] = useState<
    (Error & { code?: string; action?: string | null }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const t = (key: MessageKey) => translate(locale, key);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, c, k, r] = await Promise.all([
        api<DashboardDto>("/api/dashboard"),
        api<CatalogDto>("/api/catalog"),
        api<readonly CacheDto[]>("/api/cache"),
        api<readonly ReceiptDto[]>("/api/receipts"),
      ]);
      setDashboard(d);
      setCatalog(c);
      setCache(k);
      setReceipts(r);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    localStorage.setItem("zui-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (viewFromHash() !== view) window.location.hash = `/${view}`;
    if (view === "packages" && plan === null)
      void api<PublicInstallationPlanDto | null>("/api/plans/latest")
        .then((latest) => {
          if (latest !== null) setPlan(latest);
        })
        .catch((reason: unknown) => setError(reason as Error));
  }, [view, plan]);
  useEffect(() => {
    const alias = window.location.hash.replace(/^#\/?/u, "").split("/")[1];
    if (view === "devices" && alias !== undefined)
      void api<DeviceDetailDto>(`/api/devices/${encodeURIComponent(alias)}`)
        .then(setDevice)
        .catch((reason: unknown) => setError(reason as Error));
  }, [view]);
  const inspectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    setError(null);
    void api<PackageResultDto>("/api/packages/inspect", {
      method: "POST",
      headers: {
        ...guardedHeaders,
        "X-ZUI-Filename": file.name,
        "Content-Type": "application/octet-stream",
      },
      body: file,
    })
      .then((result) => {
        setPkg(result);
        setPlan(null);
      })
      .catch((reason: unknown) => setError(reason as Error));
  };
  const generatePlan = (): void => {
    if (pkg === null || dashboard === null) return;
    void api<PublicInstallationPlanDto>("/api/plans", {
      method: "POST",
      headers: { ...guardedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        inspectionId: pkg.inspectionId,
        device: dashboard.selectedDevice,
      }),
    })
      .then(setPlan)
      .catch((reason: unknown) => setError(reason as Error));
  };
  const updateLabel = (update: ProductUpdateComparison | null) => {
    if (update === null) return "Not managed";
    return {
      UP_TO_DATE: t("upToDate"),
      UPDATE_AVAILABLE: t("updateAvailable"),
      AHEAD_OF_CATALOG: t("aheadOfCatalog"),
      NOT_INSTALLED: t("notInstalled"),
      VERSION_UNKNOWN: t("versionUnknown"),
      NO_COMPATIBLE_RELEASE: t("noCompatibleRelease"),
    }[update.versionStatus];
  };
  const updateBadge = (update: ProductUpdateComparison | null) => (
    <Badge
      tone={
        update?.versionStatus === "UPDATE_AVAILABLE"
          ? "warning"
          : update?.versionStatus === "UP_TO_DATE"
            ? "positive"
            : "info"
      }
    >
      {updateLabel(update)}
    </Badge>
  );
  const fetchArtifact = (
    productId: string,
    releaseId: string,
    artifactId: string,
  ) => {
    setError(null);
    void api<CatalogFetchResultDto>("/api/catalog/artifacts/fetch", {
      method: "POST",
      headers: { ...guardedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ productId, releaseId, artifactId }),
    })
      .then((result) => {
        setFetchResult(result);
        return refresh();
      })
      .catch((reason: unknown) => setError(reason as Error));
  };
  const generateCatalogPlan = (
    productId: string,
    releaseId: string,
    artifactId: string,
  ) => {
    if (dashboard === null) return;
    setError(null);
    void api<PublicInstallationPlanDto>("/api/catalog/plans", {
      method: "POST",
      headers: { ...guardedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        releaseId,
        artifactId,
        device: dashboard.selectedDevice,
      }),
    })
      .then((result) => {
        setPlan(result);
        setView("packages");
      })
      .catch((reason: unknown) => setError(reason as Error));
  };
  const classification = (value: string) =>
    value === "KNOWN_STAGING_PRODUCT" ? (
      <Badge tone="info">{t("staging")}</Badge>
    ) : value === "KNOWN_PRODUCT" ? (
      <Badge tone="positive">{t("production")}</Badge>
    ) : (
      <Badge tone="warning">Unknown</Badge>
    );
  const content = useMemo(() => {
    if (loading) return <p className="loading">{t("loading")}</p>;
    if (error) return <ErrorBox error={error} />;
    if (!dashboard || !catalog) return <EmptyState>{t("empty")}</EmptyState>;
    if (view === "dashboard")
      return (
        <>
          <div className="hero">
            <div>
              <p className="eyebrow">LOCAL CONTROL PLANE</p>
              <h1>ZUI webOS Platform</h1>
              <p>
                One local view for devices, applications, releases and trust.
              </p>
            </div>
            {dashboard.mode === "MOCK" && (
              <Badge tone="warning">{t("mock")}</Badge>
            )}
          </div>
          <div className="metrics">
            <Metric
              label={t("devices")}
              value={dashboard.devices.length}
              detail={`${dashboard.devices.filter((d) => d.connectionStatus === "reachable").length} ${t("online").toLowerCase()}`}
            />
            <Metric
              label={t("installed")}
              value={dashboard.applications.length}
              detail={`${dashboard.applications.filter((a) => a.match.deploymentClass === "staging").length} ${t("staging").toLowerCase()}`}
            />
            <Metric
              label={t("products")}
              value={dashboard.products}
              detail={`${dashboard.updatesAvailable} ${t("updateAvailable").toLowerCase()}`}
            />
            <Metric
              label={t("security")}
              value={dashboard.verifiedCacheEntries}
              detail={t("cache")}
            />
          </div>
          <div className="grid">
            <Panel
              title={t("devices")}
              action={
                <Button onClick={() => void refresh()}>{t("refresh")}</Button>
              }
            >
              {dashboard.devices.map((d) => (
                <button
                  className="device-row"
                  key={d.alias}
                  onClick={() => {
                    setView("devices");
                    void api<DeviceDetailDto>(
                      `/api/devices/${encodeURIComponent(d.alias)}`,
                    )
                      .then(setDevice)
                      .catch(setError);
                  }}
                >
                  <span>
                    <strong>{d.alias}</strong>
                    {d.isDefault && <small>{t("defaultDevice")}</small>}
                  </span>
                  <Badge
                    tone={
                      d.connectionStatus === "reachable" ? "positive" : "danger"
                    }
                  >
                    {d.connectionStatus === "reachable"
                      ? t("online")
                      : t("offline")}
                  </Badge>
                </button>
              ))}
            </Panel>
            <Panel title={t("developerMode")}>
              <p className="big-status">
                {dashboard.developerMode?.connectionStatus === "reachable"
                  ? t("online")
                  : t("offline")}
              </p>
              <small>
                {dashboard.developerMode?.observedAt ?? dashboard.generatedAt}
              </small>
            </Panel>
            <Panel title={t("recentActivity")} className="span-2">
              <p>
                {receipts.length} {t("receipts").toLowerCase()} · {cache.length}{" "}
                {t("cache").toLowerCase()}
              </p>
            </Panel>
          </div>
        </>
      );
    if (view === "devices")
      return (
        <div className="grid">
          <Panel title={t("devices")}>
            <div className="cards">
              {dashboard.devices.map((d) => (
                <button
                  className="device-card"
                  key={d.alias}
                  onClick={() =>
                    void api<DeviceDetailDto>(
                      `/api/devices/${encodeURIComponent(d.alias)}`,
                    )
                      .then(setDevice)
                      .catch(setError)
                  }
                >
                  <strong>{d.alias}</strong>
                  <Badge
                    tone={
                      d.connectionStatus === "reachable" ? "positive" : "danger"
                    }
                  >
                    {d.connectionStatus === "reachable"
                      ? t("online")
                      : t("offline")}
                  </Badge>
                </button>
              ))}
            </div>
          </Panel>
          {device && (
            <Panel title={`${device.device.alias} · ${t("applications")}`}>
              <p>
                {t("connection")}:{" "}
                <Badge
                  tone={
                    device.device.health.connectionStatus === "reachable"
                      ? "positive"
                      : "danger"
                  }
                >
                  {device.device.health.connectionStatus}
                </Badge>
              </p>
              <Table
                headers={[
                  t("applications"),
                  t("appId"),
                  t("version"),
                  t("classification"),
                  t("status"),
                ]}
                rows={device.applications.map((a) => [
                  a.application.title ?? a.application.id,
                  <code>{a.application.id}</code>,
                  a.application.version ?? "—",
                  classification(a.match.classification),
                  updateBadge(a.update),
                ])}
              />
            </Panel>
          )}
        </div>
      );
    if (view === "applications")
      return (
        <Panel title={t("applications")}>
          <Table
            headers={[
              t("applications"),
              t("appId"),
              t("version"),
              t("classification"),
              t("releaseChannel"),
              t("availableVersion"),
              t("status"),
              t("trust"),
            ]}
            rows={dashboard.applications.map((a) => [
              a.application.title ?? a.application.id,
              <code>{a.application.id}</code>,
              a.application.version ?? "—",
              classification(a.match.classification),
              a.update?.installed.channel ?? "—",
              a.update?.available.version ?? "—",
              updateBadge(a.update),
              a.update ? (
                <Badge tone={trustTone(a.update.trustStatus)}>
                  {a.update.trustStatus}
                </Badge>
              ) : (
                "—"
              ),
            ])}
          />
        </Panel>
      );
    if (view === "catalog") {
      const query = catalogSearch.trim().toLowerCase();
      const routeParts = window.location.hash.replace(/^#\/?/u, "").split("/");
      const routeProductId = routeParts[1];
      const routeReleaseId =
        routeParts[2] === "releases" ? routeParts[3] : undefined;
      const products = catalog.products.filter((product) => {
        const comparisons = catalog.comparisons.filter(
          (item) => item.productId === product.productId,
        );
        const searched =
          query.length === 0 ||
          product.displayName.toLowerCase().includes(query) ||
          product.appIdentities.some((identity) =>
            identity.appId.toLowerCase().includes(query),
          );
        const filtered =
          catalogFilter === "all" ||
          (catalogFilter === "installed" &&
            comparisons.some((item) => item.installed.installed)) ||
          (catalogFilter === "updates" &&
            comparisons.some(
              (item) => item.versionStatus === "UPDATE_AVAILABLE",
            )) ||
          product.appIdentities.some(
            (identity) => identity.deploymentClass === catalogFilter,
          );
        return (
          searched &&
          filtered &&
          (routeProductId === undefined ||
            routeProductId.length === 0 ||
            product.productId === routeProductId)
        );
      });
      return (
        <>
          <div className="catalog-tools">
            <label>
              {t("searchCatalog")}
              <input
                type="search"
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
              />
            </label>
            <label>
              {t("status")}
              <select
                value={catalogFilter}
                onChange={(event) => setCatalogFilter(event.target.value)}
              >
                <option value="all">{t("all")}</option>
                <option value="installed">{t("installedOnly")}</option>
                <option value="updates">{t("updatesOnly")}</option>
                <option value="production">{t("production")}</option>
                <option value="staging">{t("staging")}</option>
              </select>
            </label>
          </div>
          <div className="cards">
            {products.map((product) => {
              const comparisons = catalog.comparisons.filter(
                (item) => item.productId === product.productId,
              );
              return (
                <Panel key={product.productId} title={product.displayName}>
                  <p>
                    <a
                      href={product.repository}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {product.repository.replace("https://github.com/", "")}
                    </a>
                  </p>
                  <p>
                    {product.rootlessCompatible ? "Rootless compatible" : ""}
                  </p>
                  {comparisons.map((comparison) => (
                    <p key={comparison.appId}>
                      <code>{comparison.appId}</code> {updateBadge(comparison)}{" "}
                      · {comparison.installed.version ?? "—"} →{" "}
                      {comparison.available.version ?? "—"}
                    </p>
                  ))}
                  {product.releases
                    .filter(
                      (release) =>
                        routeReleaseId === undefined ||
                        release.releaseId === routeReleaseId,
                    )
                    .map((release) => (
                      <div className="release" key={release.releaseId}>
                        <h3>
                          {release.version} · {release.channel}
                        </h3>
                        <small>{release.releaseId}</small>
                        <p>
                          <Badge tone={trustTone(release.trustState)}>
                            {release.trustState}
                          </Badge>{" "}
                          <code>
                            {release.sourceCommit ?? "source unknown"}
                          </code>
                        </p>
                        {release.artifacts.map((artifact) => (
                          <div className="artifact" key={artifact.artifactId}>
                            <strong>{artifact.filename}</strong>
                            <p>
                              <code>{artifact.appId}</code> · {artifact.size}{" "}
                              bytes
                            </p>
                            <p>
                              <Badge tone={trustTone(artifact.trustState)}>
                                {artifact.trustState}
                              </Badge>{" "}
                              <Badge
                                tone={
                                  artifact.cacheAvailability ===
                                  "CACHED_VERIFIED"
                                    ? "positive"
                                    : "info"
                                }
                              >
                                {artifact.cacheAvailability}
                              </Badge>{" "}
                              <Badge tone="info">
                                {artifact.remoteAvailability}
                              </Badge>
                            </p>
                            <code>{artifact.sha256.slice(0, 20)}…</code>
                            {artifact.remoteAvailability ===
                              "REMOTE_AVAILABLE" && (
                              <p>
                                <Button
                                  onClick={() =>
                                    fetchArtifact(
                                      product.productId,
                                      release.releaseId,
                                      artifact.artifactId,
                                    )
                                  }
                                >
                                  {t("downloadVerify")}
                                </Button>
                              </p>
                            )}
                            {(artifact.cacheAvailability ===
                              "CACHED_VERIFIED" ||
                              fetchResult?.artifactId ===
                                artifact.artifactId) && (
                              <p>
                                <Button
                                  onClick={() =>
                                    generateCatalogPlan(
                                      product.productId,
                                      release.releaseId,
                                      artifact.artifactId,
                                    )
                                  }
                                >
                                  {t("generatePlan")}
                                </Button>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                </Panel>
              );
            })}
          </div>
        </>
      );
    }
    if (view === "packages")
      return (
        <div className="grid">
          <Panel title={t("packages")}>
            <label className="upload">
              {t("selectPackage")}
              <input type="file" accept=".ipk" onChange={inspectFile} />
            </label>
            {pkg && (
              <div className="inspection">
                <h3>{pkg.inspection.filename}</h3>
                <p>
                  <code>{pkg.inspection.manifests[0]?.id}</code> ·{" "}
                  {pkg.inspection.manifests[0]?.version}
                </p>
                <p>
                  SHA-256 <code>{pkg.inspection.hash.digest}</code>
                </p>
                <Badge
                  tone={trustTone(pkg.verification?.trustLevel ?? "UNVERIFIED")}
                >
                  {pkg.verification?.trustLevel ?? t("unverified")}
                </Badge>
                <p>
                  <Button onClick={generatePlan}>{t("generatePlan")}</Button>
                </p>
              </div>
            )}
          </Panel>
          {plan && (
            <Panel title={t("generatePlan")}>
              <div className="plan">
                <Badge
                  tone={plan.policyDecision === "BLOCK" ? "danger" : "warning"}
                >
                  {plan.policyDecision}
                </Badge>
                <p>
                  {plan.artifact.appId} · {plan.artifact.version}
                </p>
                <p>
                  {t("trust")}:{" "}
                  <Badge tone={trustTone(plan.artifact.trustLevel)}>
                    {plan.artifact.trustLevel}
                  </Badge>
                </p>
                <p>
                  {t("risk")}:{" "}
                  {plan.riskFlags.map((r) => (
                    <Badge
                      key={r.code}
                      tone={r.severity === "BLOCK" ? "danger" : "warning"}
                    >
                      {r.code}
                    </Badge>
                  ))}
                </p>
                <div className="notice">{t("installDisabled")}</div>
              </div>
            </Panel>
          )}
        </div>
      );
    if (view === "cache")
      return (
        <Panel title={t("cache")}>
          {cache.length ? (
            <Table
              headers={[
                t("products"),
                "Artifact",
                "SHA-256",
                t("trust"),
                "Key",
                t("status"),
              ]}
              rows={cache.map((c) => [
                c.productId,
                c.filename,
                <code title={c.digest}>{c.digest.slice(0, 16)}…</code>,
                <Badge tone={trustTone(c.trustDecision)}>
                  {c.trustDecision}
                </Badge>,
                <code>{c.signingKey.slice(0, 12)}…</code>,
                new Date(c.verifiedAt).toLocaleString(locale),
              ])}
            />
          ) : (
            <EmptyState>{t("empty")}</EmptyState>
          )}
        </Panel>
      );
    if (view === "receipts")
      return (
        <Panel title={t("receipts")}>
          {receipts.length ? (
            <Table
              headers={[
                "Time",
                t("devices"),
                t("appId"),
                t("version"),
                t("trust"),
                t("status"),
              ]}
              rows={receipts.map((r) => [
                new Date(r.timestamp).toLocaleString(locale),
                r.device,
                <code>{r.app}</code>,
                r.version,
                <Badge tone={trustTone(r.trust)}>{r.trust}</Badge>,
                r.postInstallVerified ? (
                  <Badge tone="positive">{r.result}</Badge>
                ) : (
                  <Badge tone="danger">{r.result}</Badge>
                ),
              ])}
            />
          ) : (
            <EmptyState>{t("empty")}</EmptyState>
          )}
        </Panel>
      );
    return (
      <Panel title={t("settings")}>
        <label>
          {t("language")}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </label>
        <p>
          {t("defaultDevice")}: <strong>{dashboard.selectedDevice}</strong>
        </p>
        <p>{t("noSecrets")}</p>
      </Panel>
    );
  }, [
    loading,
    error,
    dashboard,
    catalog,
    cache,
    receipts,
    device,
    pkg,
    plan,
    view,
    locale,
    catalogSearch,
    catalogFilter,
    fetchResult,
  ]);
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>Z</span>
          <div>
            <strong>ZUI</strong>
            <small>webOS Platform</small>
          </div>
        </div>
        <nav aria-label="Primary">
          {nav.map(([id, key]) => (
            <button
              className={view === id ? "active" : ""}
              key={id}
              onClick={() => setView(id)}
            >
              {t(key)}
            </button>
          ))}
        </nav>
        <footer>
          <span className="pulse" />
          127.0.0.1
        </footer>
      </aside>
      <main>{content}</main>
    </div>
  );
}
