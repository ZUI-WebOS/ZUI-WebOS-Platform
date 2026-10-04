import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TvStoreCatalogResponse, TvStoreProduct } from "../contracts.js";
import { loadCatalog } from "./api-client.js";
import { TvFocusProvider, useTvFocusTarget } from "./focus.js";
import { text, trustLabel, updateLabel, type Locale } from "./i18n.js";

type View =
  | { readonly kind: "home" }
  | { readonly kind: "detail"; readonly product: TvStoreProduct };

function FocusButton({
  id,
  row,
  column,
  className,
  onClick,
  children,
  label,
}: {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly className?: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly label?: string;
}) {
  const focus = useTvFocusTarget(id, row, column);
  return (
    <button
      {...focus}
      className={className}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
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
}: {
  readonly product: TvStoreProduct;
  readonly locale: Locale;
  readonly back: () => void;
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
      <p className="read-only-note">
        {locale === "tr"
          ? "Bu sürüm salt okunurdur. Kurulum işlemi içermez."
          : "This release is read-only. Installation is not included."}
      </p>
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
  const changeLocale = (next: Locale) => {
    localStorage.setItem("zui-tv-store-locale", next);
    setLocale(next);
  };
  const back = useCallback(() => {
    if (view.kind === "detail") setView({ kind: "home" });
  }, [view.kind]);
  const initialFocus =
    view.kind === "detail" ? "detail-back" : error ? "retry" : restoreFocus;
  return (
    <TvFocusProvider
      key={`${view.kind}-${error ? "error" : "ok"}`}
      initialFocus={initialFocus}
      onBack={back}
    >
      <div className="app-shell">
        <Brand locale={locale} setLocale={changeLocale} />
        {error ? (
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
          <Detail product={view.product} locale={locale} back={back} />
        )}
      </div>
    </TvFocusProvider>
  );
}
