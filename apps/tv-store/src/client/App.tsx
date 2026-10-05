import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TvStoreCatalogResponse, TvStoreProduct } from "../contracts.js";
import type {
  PublicInstallIntent,
  PublicInstallStatus,
} from "../install-contracts.js";
import {
  approveInstallIntent,
  cancelInstallIntent,
  createInstallIntent,
  loadCatalog,
  loadInstallStatus,
  pairInstallService,
} from "./api-client.js";
import { TvFocusProvider, useTvFocusTarget } from "./focus.js";
import {
  installErrorLabel,
  text,
  trustLabel,
  updateLabel,
  type Locale,
} from "./i18n.js";

type View =
  | { readonly kind: "home" }
  | { readonly kind: "detail"; readonly product: TvStoreProduct }
  | { readonly kind: "pair"; readonly product: TvStoreProduct }
  | {
      readonly kind: "review";
      readonly product: TvStoreProduct;
      readonly intent: PublicInstallIntent;
    }
  | {
      readonly kind: "progress";
      readonly product: TvStoreProduct;
      readonly intent: PublicInstallIntent;
    }
  | {
      readonly kind: "result";
      readonly product: TvStoreProduct;
      readonly status: PublicInstallStatus;
    };

function FocusButton({
  id,
  row,
  column,
  className,
  onClick,
  children,
  label,
  disabled,
}: {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly className?: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly label?: string;
  readonly disabled?: boolean;
}) {
  const focus = useTvFocusTarget(id, row, column);
  return (
    <button
      {...focus}
      className={className}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function FocusInput({
  id,
  value,
  onChange,
  label,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
}) {
  const focus = useTvFocusTarget(id, 1, 0);
  return (
    <input
      {...focus}
      className="pair-code"
      type="password"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={8}
      value={value}
      aria-label={label}
      onChange={(event) =>
        onChange(event.target.value.replace(/\D/gu, "").slice(0, 8))
      }
    />
  );
}

function Brand({
  locale,
  setLocale,
}: {
  readonly locale: Locale;
  readonly setLocale: (value: Locale) => void;
}) {
  const t = text(locale);
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./assets/store-mark.png" alt="" />
        <span>ZUI Store</span>
        <b>STAGING</b>
      </div>
      <div className="topbar-actions">
        <span className="privacy">{t.privacy}</span>
        <FocusButton
          id="language"
          row={0}
          column={9}
          className="language"
          onClick={() => setLocale(locale === "en" ? "tr" : "en")}
          label={locale === "en" ? "Türkçe" : "English"}
        >
          {locale === "en" ? "TR" : "EN"}
        </FocusButton>
      </div>
    </header>
  );
}

function ProductIcon({ kind }: { readonly kind: TvStoreProduct["icon"] }) {
  const initials = kind === "iptv" ? "TV" : kind === "youtube" ? "▶" : "Z";
  return (
    <div className={`product-icon ${kind}`} aria-hidden="true">
      {initials}
    </div>
  );
}

function StatusPill({
  product,
  locale,
}: {
  readonly product: TvStoreProduct;
  readonly locale: Locale;
}) {
  return (
    <span className={`status status-${product.updateStatus.toLowerCase()}`}>
      {updateLabel(locale, product.updateStatus)}
    </span>
  );
}

function ProductCard({
  product,
  index,
  locale,
  open,
}: {
  readonly product: TvStoreProduct;
  readonly index: number;
  readonly locale: Locale;
  readonly open: () => void;
}) {
  const t = text(locale);
  return (
    <FocusButton
      id={`product-${product.productId}`}
      row={1 + Math.floor(index / 3)}
      column={index % 3}
      className="product-card"
      onClick={open}
      label={`${t.details}: ${product.displayName}`}
    >
      <div className="card-head">
        <ProductIcon kind={product.icon} />
        <div className="card-tags">
          <span className={`channel ${product.deploymentClass}`}>
            {product.deploymentClass === "staging" ? t.staging : t.production}
          </span>
          <span className="trust">
            ✓ {trustLabel(locale, product.trustState)}
          </span>
        </div>
      </div>
      <div className="card-copy">
        <h3>{product.displayName}</h3>
        {product.deploymentClass === "staging" && (
          <p className="identity">{product.appId}</p>
        )}
        <p>{product.description[locale]}</p>
      </div>
      <div className="card-foot">
        <StatusPill product={product} locale={locale} />
        <span className="version">
          {product.availableVersion === null
            ? "—"
            : `v${product.availableVersion}`}{" "}
          <i>›</i>
        </span>
      </div>
    </FocusButton>
  );
}

function Home({
  catalog,
  locale,
  open,
}: {
  readonly catalog: TvStoreCatalogResponse;
  readonly locale: Locale;
  readonly open: (product: TvStoreProduct) => void;
}) {
  const t = text(locale);
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="summary">
          <strong>{catalog.summary.products}</strong>
          <span>{t.apps}</span>
          <small>
            {catalog.summary.updates}{" "}
            {updateLabel(locale, "UPDATE_AVAILABLE").toLocaleLowerCase(locale)}
          </small>
        </div>
      </section>
      <div className="section-heading">
        <h2>{t.apps}</h2>
        {catalog.mode === "MOCK" && <span className="demo">{t.mock}</span>}
        {catalog.mode === "LIVE" && <span className="live">LIVE</span>}
      </div>
      <section className="product-grid">
        {catalog.products.map((product, index) => (
          <ProductCard
            key={product.productId}
            product={product}
            index={index}
            locale={locale}
            open={() => open(product)}
          />
        ))}
      </section>
    </main>
  );
}

function Fact({
  label,
  value,
  wide = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly wide?: boolean;
}) {
  return (
    <div className={wide ? "fact wide" : "fact"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({
  product,
  locale,
  back,
  install,
}: {
  readonly product: TvStoreProduct;
  readonly locale: Locale;
  readonly back: () => void;
  readonly install: (() => void) | null;
}) {
  const t = text(locale);
  return (
    <main className="detail">
      <FocusButton
        id="detail-back"
        row={1}
        column={0}
        className="back"
        onClick={back}
      >
        ‹ {t.back}
      </FocusButton>
      <section className="detail-hero">
        <ProductIcon kind={product.icon} />
        <div>
          <div className="detail-tags">
            <span className={`channel ${product.deploymentClass}`}>
              {product.deploymentClass === "staging" ? t.staging : t.production}
            </span>
            <StatusPill product={product} locale={locale} />
          </div>
          <h1>{product.displayName}</h1>
          <p>{product.description[locale]}</p>
        </div>
      </section>
      <section className="facts">
        <Fact label={t.appId} value={product.appId} wide />
        <Fact
          label={t.installedVersion}
          value={
            !product.inventoryAvailable
              ? t.deviceUnavailable
              : (product.installedVersion ?? t.notInstalled)
          }
        />
        <Fact
          label={t.availableVersion}
          value={product.availableVersion ?? "—"}
        />
        <Fact
          label={t.channel}
          value={product.channel === "stable" ? t.production : t.staging}
        />
        <Fact
          label={t.trust}
          value={`${trustLabel(locale, product.trustState)} · ${product.trustState}`}
        />
        <Fact
          label={t.compatibility}
          value={product.rootlessCompatible ? t.rootless : "—"}
          wide
        />
      </section>
      {install === null ? (
        <p className="read-only-note">{t.installUnavailable}</p>
      ) : (
        <div className="detail-actions">
          <FocusButton
            id="detail-install"
            row={2}
            column={0}
            className="primary-action"
            onClick={install}
          >
            {product.updateStatus === "UPDATE_AVAILABLE" ? t.update : t.install}
          </FocusButton>
          <span>{t.installArmedHint}</span>
        </div>
      )}
    </main>
  );
}

function PairView({
  locale,
  code,
  setCode,
  submit,
  cancel,
  error,
  busy,
}: {
  readonly locale: Locale;
  readonly code: string;
  readonly setCode: (value: string) => void;
  readonly submit: () => void;
  readonly cancel: () => void;
  readonly error: string | null;
  readonly busy: boolean;
}) {
  const t = text(locale);
  return (
    <main className="install-flow pair-view">
      <p className="eyebrow">{t.installMode}</p>
      <h1>{t.pairTitle}</h1>
      <p className="install-lead">{t.pairBody}</p>
      <FocusInput
        id="pair-code"
        value={code}
        onChange={setCode}
        label={t.pairCode}
      />
      {error !== null && <p className="flow-error">{error}</p>}
      <div className="approval-actions">
        <FocusButton
          id="pair-cancel"
          row={2}
          column={0}
          className="secondary-action"
          onClick={cancel}
        >
          {t.cancel}
        </FocusButton>
        <FocusButton
          id="pair-submit"
          row={2}
          column={1}
          className="primary-action"
          onClick={submit}
          disabled={busy || code.length !== 8}
        >
          {busy ? t.preparing : t.pair}
        </FocusButton>
      </div>
    </main>
  );
}

function ApprovalView({
  locale,
  intent,
  cancel,
  approve,
  busy,
  error,
}: {
  readonly locale: Locale;
  readonly intent: PublicInstallIntent;
  readonly cancel: () => void;
  readonly approve: () => void;
  readonly busy: boolean;
  readonly error: string | null;
}) {
  const t = text(locale);
  return (
    <main className="install-flow approval-view">
      <div className="detail-tags">
        <span className="channel staging">{t.staging}</span>
        <span className="verified-badge">✓ {t.verifiedPackage}</span>
      </div>
      <h1>{t.reviewInstall}</h1>
      <p className="install-lead">{t.reviewBody}</p>
      <section className="facts approval-facts">
        <Fact label={t.application} value={intent.displayName} />
        <Fact
          label={t.action}
          value={intent.action === "UPDATE" ? t.update : t.install}
        />
        <Fact label={t.appId} value={intent.appId} wide />
        <Fact
          label={t.currentState}
          value={intent.currentVersion ?? t.notInstalled}
        />
        <Fact label={t.targetVersion} value={intent.targetVersion} />
        <Fact label={t.device} value={intent.deviceAlias} />
        <Fact label={t.trust} value={t.signedStagingRelease} />
      </section>
      <p className="approval-warning">{t.explicitApproval}</p>
      {error ? <p className="flow-error">{error}</p> : null}
      <div className="approval-actions">
        <FocusButton
          id="approval-cancel"
          row={3}
          column={0}
          className="secondary-action"
          onClick={cancel}
          disabled={busy}
        >
          {t.cancel}
        </FocusButton>
        <FocusButton
          id="approval-confirm"
          row={3}
          column={1}
          className="primary-action danger-aware"
          onClick={approve}
          disabled={busy}
        >
          {busy ? t.preparing : t.installNow}
        </FocusButton>
      </div>
    </main>
  );
}

function ProgressView({
  locale,
  status,
}: {
  readonly locale: Locale;
  readonly status: PublicInstallStatus | PublicInstallIntent;
}) {
  const t = text(locale);
  const phases = [
    "PREPARING",
    "VERIFYING_PACKAGE",
    "CHECKING_TV",
    "INSTALLING",
    "VERIFYING_INSTALLATION",
    "COMPLETE",
  ] as const;
  const active = phases.indexOf(status.phase);
  return (
    <main className="install-flow progress-view" aria-live="polite">
      <div className="spinner" />
      <p className="eyebrow">{t.installMode}</p>
      <h1>{t.installingApplication}</h1>
      <p className="install-lead">{status.displayName}</p>
      <ol className="phase-list">
        {phases.map((phase, index) => (
          <li
            key={phase}
            className={
              index < active ? "done" : index === active ? "active" : ""
            }
          >
            <span>{index < active ? "✓" : index === active ? "•" : "○"}</span>
            {t.installPhases[phase]}
          </li>
        ))}
      </ol>
      <p className="approval-warning">{t.doNotTurnOff}</p>
    </main>
  );
}

function ResultView({
  locale,
  status,
  back,
}: {
  readonly locale: Locale;
  readonly status: PublicInstallStatus;
  readonly back: () => void;
}) {
  const t = text(locale);
  const success = status.state === "SUCCEEDED" && status.result !== null;
  return (
    <main className="install-flow result-view">
      <div
        className={success ? "result-symbol success" : "result-symbol failure"}
      >
        {success ? "✓" : "!"}
      </div>
      <h1>{success ? t.installedSuccessfully : t.installFailed}</h1>
      <p className="install-lead">
        {success
          ? `${status.displayName} · ${status.result?.installedVersion ?? status.targetVersion}`
          : installErrorLabel(locale, status.errorCode ?? "INSTALL_FAILED")}
      </p>
      <FocusButton
        id="result-back"
        row={1}
        column={0}
        className="primary-action"
        onClick={back}
      >
        {t.backToProduct}
      </FocusButton>
    </main>
  );
}

function ErrorView({
  locale,
  retry,
}: {
  readonly locale: Locale;
  readonly retry: () => void;
}) {
  const t = text(locale);
  return (
    <main className="state" role="alert">
      <div className="error-symbol">!</div>
      <h1>{t.offlineTitle}</h1>
      <p>{t.offlineBody}</p>
      <FocusButton
        id="retry"
        row={1}
        column={0}
        className="retry"
        onClick={retry}
      >
        {t.retry}
      </FocusButton>
    </main>
  );
}

export function App() {
  const evidence = useMemo(
    () => new URLSearchParams(window.location.hash.replace(/^#/u, "")),
    [],
  );
  const [locale, setLocale] = useState<Locale>(() =>
    evidence.get("lang") === "tr" ||
    localStorage.getItem("zui-tv-store-locale") === "tr"
      ? "tr"
      : "en",
  );
  const [catalog, setCatalog] = useState<TvStoreCatalogResponse | null>(null);
  const [error, setError] = useState(evidence.get("state") === "offline");
  const [view, setView] = useState<View>({ kind: "home" });
  const [pairCode, setPairCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);
  const [installStatus, setInstallStatus] =
    useState<PublicInstallStatus | null>(null);
  const confirming = useRef(false);
  const [restoreFocus, setRestoreFocus] = useState(
    evidence.get("focus") ?? "product-zui-iptv-player-production",
  );
  const lastLoadedAt = useRef(0);
  const reload = useCallback(() => {
    if (evidence.get("state") === "offline") return () => undefined;
    setError(false);
    setCatalog(null);
    const controller = new AbortController();
    void loadCatalog(controller.signal)
      .then((next) => {
        lastLoadedAt.current = Date.now();
        setCatalog(next);
      })
      .catch(() => setError(true));
    return () => controller.abort();
  }, []);
  useEffect(() => reload(), [reload]);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const refreshWhenVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoadedAt.current >= 60_000
      ) {
        cancel?.();
        cancel = reload();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancel?.();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [reload]);
  useEffect(() => {
    const requested = evidence.get("product");
    if (catalog !== null && requested !== null && view.kind === "home") {
      const product = catalog.products.find(
        (item) => item.productId === requested,
      );
      if (product !== undefined) setView({ kind: "detail", product });
    }
  }, [catalog, evidence, view.kind]);
  useEffect(() => {
    if (view.kind !== "progress" || sessionToken === null) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await loadInstallStatus(
          sessionToken,
          view.intent.intentId,
        );
        if (stopped) return;
        setInstallStatus(next);
        if (next.state === "SUCCEEDED" || next.state === "FAILED") {
          if (next.state === "SUCCEEDED") {
            try {
              const refreshed = await loadCatalog();
              if (!stopped) setCatalog(refreshed);
            } catch {
              // The verified install result remains authoritative if catalog refresh is delayed.
            }
          }
          if (!stopped)
            setView({ kind: "result", product: view.product, status: next });
          return;
        }
        timer = setTimeout(() => void poll(), 350);
      } catch (pollError) {
        if (!stopped) {
          const code =
            typeof pollError === "object" &&
            pollError !== null &&
            typeof (pollError as { code?: unknown }).code === "string"
              ? (pollError as { code: string }).code
              : "INSTALL_FAILED";
          setView({
            kind: "result",
            product: view.product,
            status: {
              ...view.intent,
              state: "FAILED",
              result: null,
              errorCode: code,
            },
          });
        }
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [sessionToken, view]);
  const changeLocale = (next: Locale) => {
    localStorage.setItem("zui-tv-store-locale", next);
    setLocale(next);
  };
  const cancelReview = useCallback(() => {
    if (view.kind !== "review" || sessionToken === null || flowBusy) return;
    setFlowBusy(true);
    void cancelInstallIntent(sessionToken, view.intent.intentId)
      .then(() => {
        setFlowError(null);
        setView({ kind: "detail", product: view.product });
      })
      .catch((cancelError: unknown) =>
        setFlowError(
          cancelError instanceof Error
            ? cancelError.message
            : installErrorLabel(locale, "INSTALL_FAILED"),
        ),
      )
      .finally(() => setFlowBusy(false));
  }, [flowBusy, locale, sessionToken, view]);
  const back = useCallback(() => {
    if (view.kind === "detail") setView({ kind: "home" });
    else if (view.kind === "pair")
      setView({ kind: "detail", product: view.product });
    else if (view.kind === "review") cancelReview();
    else if (view.kind === "result")
      setView({ kind: "detail", product: view.product });
  }, [cancelReview, view]);
  const submitPair = () => {
    if (view.kind !== "pair" || flowBusy) return;
    const releaseId = view.product.release?.releaseId;
    const artifactId = view.product.artifact?.artifactId;
    if (releaseId === undefined || artifactId === undefined) return;
    setFlowBusy(true);
    setFlowError(null);
    void (async () => {
      const token =
        sessionToken ?? (await pairInstallService(pairCode)).sessionToken;
      setSessionToken(token);
      const intent = await createInstallIntent(token, {
        productId: view.product.catalogProductId,
        releaseId,
        artifactId,
      });
      setPairCode("");
      setView({ kind: "review", product: view.product, intent });
    })()
      .catch((pairError: unknown) =>
        setFlowError(
          pairError instanceof Error
            ? pairError.message
            : installErrorLabel(locale, "INSTALL_FAILED"),
        ),
      )
      .finally(() => setFlowBusy(false));
  };
  const confirmInstall = () => {
    if (
      view.kind !== "review" ||
      sessionToken === null ||
      flowBusy ||
      confirming.current
    )
      return;
    confirming.current = true;
    setFlowBusy(true);
    setFlowError(null);
    void approveInstallIntent(sessionToken, view.intent.intentId)
      .then((status) => {
        setInstallStatus(status);
        setView({
          kind: "progress",
          product: view.product,
          intent: view.intent,
        });
      })
      .catch((approvalError: unknown) =>
        setFlowError(
          approvalError instanceof Error
            ? approvalError.message
            : installErrorLabel(locale, "INSTALL_FAILED"),
        ),
      )
      .finally(() => {
        setFlowBusy(false);
        confirming.current = false;
      });
  };
  const initialFocus = (() => {
    if (view.kind === "detail") return "detail-back";
    if (view.kind === "pair") return "pair-code";
    if (view.kind === "review") return "approval-cancel";
    if (view.kind === "result") return "result-back";
    if (view.kind === "progress") return "progress-none";
    return error ? "retry" : restoreFocus;
  })();
  return (
    <TvFocusProvider
      key={`${view.kind}-${error ? "error" : "ok"}`}
      initialFocus={initialFocus}
      onBack={back}
    >
      <div className="app-shell">
        <Brand locale={locale} setLocale={changeLocale} />
        {view.kind === "pair" ? (
          <PairView
            locale={locale}
            code={pairCode}
            setCode={setPairCode}
            submit={submitPair}
            cancel={() => setView({ kind: "detail", product: view.product })}
            error={flowError}
            busy={flowBusy}
          />
        ) : view.kind === "review" ? (
          <ApprovalView
            locale={locale}
            intent={view.intent}
            cancel={cancelReview}
            approve={confirmInstall}
            busy={flowBusy}
            error={flowError}
          />
        ) : view.kind === "progress" ? (
          <ProgressView locale={locale} status={installStatus ?? view.intent} />
        ) : view.kind === "result" ? (
          <ResultView
            locale={locale}
            status={view.status}
            back={() => {
              const refreshed = catalog?.products.find(
                (item) =>
                  item.productId === view.product.productId &&
                  item.appId === view.product.appId,
              );
              setView({ kind: "detail", product: refreshed ?? view.product });
            }}
          />
        ) : error ? (
          <ErrorView locale={locale} retry={reload} />
        ) : catalog === null ? (
          <main className="state">
            <div className="spinner" />
            <h1>{text(locale).loading}</h1>
          </main>
        ) : view.kind === "home" ? (
          <Home
            catalog={catalog}
            locale={locale}
            open={(product) => {
              setRestoreFocus(`product-${product.productId}`);
              setView({ kind: "detail", product });
            }}
          />
        ) : (
          <Detail
            product={view.product}
            locale={locale}
            back={back}
            install={
              catalog.mode === "LIVE" &&
              view.product.deploymentClass === "staging" &&
              view.product.appId !== "com.zui.webos.store.staging" &&
              view.product.trustState === "SIGNED" &&
              (view.product.updateStatus === "NOT_INSTALLED" ||
                view.product.updateStatus === "UPDATE_AVAILABLE") &&
              view.product.release !== null &&
              view.product.artifact !== null
                ? () => {
                    setFlowError(null);
                    setView({ kind: "pair", product: view.product });
                  }
                : null
            }
          />
        )}
      </div>
    </TvFocusProvider>
  );
}
