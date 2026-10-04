import type {
  CatalogTrustState,
  UpdateStatus,
} from "@zui-webos/catalog-contracts";

export type Locale = "en" | "tr";
const strings = {
  en: {
    eyebrow: "YOUR ROOTLESS WEBOS LIBRARY",
    title: "Apps, clearly understood.",
    subtitle: "Browse trusted ZUI releases and see what is ready for your TV.",
    apps: "Available apps",
    installed: "Installed",
    notInstalled: "Not installed",
    details: "View details",
    back: "Back to apps",
    retry: "Try again",
    offlineTitle: "The catalog is taking a break",
    offlineBody:
      "Check that the local ZUI service is available, then try again.",
    loading: "Loading your catalog…",
    deviceUnavailable: "Device status unavailable",
    installedVersion: "Installed version",
    availableVersion: "Available version",
    appId: "App ID",
    channel: "Release channel",
    trust: "Release trust",
    compatibility: "Compatibility",
    rootless: "Rootless Developer Mode",
    privacy: "Local-first · No telemetry · No ads",
    mock: "DEMO CATALOG",
    staging: "STAGING",
    production: "PRODUCTION",
  },
  tr: {
    eyebrow: "ROOTLESS WEBOS KÜTÜPHANENİZ",
    title: "Uygulamalar, tüm ayrıntılarıyla.",
    subtitle:
      "Güvenilir ZUI sürümlerini keşfedin ve TV'niz için hazır olanları görün.",
    apps: "Kullanılabilir uygulamalar",
    installed: "Yüklü",
    notInstalled: "Yüklü değil",
    details: "Ayrıntıları görüntüle",
    back: "Uygulamalara dön",
    retry: "Tekrar dene",
    offlineTitle: "Kataloğa şu anda ulaşılamıyor",
    offlineBody:
      "Yerel ZUI hizmetinin kullanılabilir olduğunu kontrol edip tekrar deneyin.",
    loading: "Kataloğunuz yükleniyor…",
    deviceUnavailable: "Cihaz durumu kullanılamıyor",
    installedVersion: "Yüklü sürüm",
    availableVersion: "Kullanılabilir sürüm",
    appId: "Uygulama kimliği",
    channel: "Sürüm kanalı",
    trust: "Sürüm güveni",
    compatibility: "Uyumluluk",
    rootless: "Rootless Geliştirici Modu",
    privacy: "Önce yerel · Telemetri yok · Reklam yok",
    mock: "DEMO KATALOG",
    staging: "STAGING",
    production: "PRODUCTION",
  },
} as const;

export function text(locale: Locale) {
  return strings[locale];
}
export function updateLabel(locale: Locale, status: UpdateStatus): string {
  const labels: Record<Locale, Record<UpdateStatus, string>> = {
    en: {
      UP_TO_DATE: "Up to date",
      UPDATE_AVAILABLE: "Update available",
      AHEAD_OF_CATALOG: "Newer than catalog",
      NOT_INSTALLED: "Not installed",
      VERSION_UNKNOWN: "Version unknown",
      NO_COMPATIBLE_RELEASE: "No compatible release",
    },
    tr: {
      UP_TO_DATE: "Güncel",
      UPDATE_AVAILABLE: "Güncelleme mevcut",
      AHEAD_OF_CATALOG: "Katalogdan daha yeni",
      NOT_INSTALLED: "Yüklü değil",
      VERSION_UNKNOWN: "Sürüm bilinmiyor",
      NO_COMPATIBLE_RELEASE: "Uyumlu sürüm yok",
    },
  };
  return labels[locale][status];
}
export function trustLabel(locale: Locale, trust: CatalogTrustState): string {
  const labels: Record<Locale, Record<CatalogTrustState, string>> = {
    en: {
      SIGNED: "Verified",
      REPOSITORY_PINNED_HASH: "Repository verified",
      REGISTRY_MATCH: "Known app",
      UNVERIFIED: "Unverified",
      REVOKED: "Trust revoked",
      INVALID_SIGNATURE: "Signature invalid",
    },
    tr: {
      SIGNED: "Doğrulandı",
      REPOSITORY_PINNED_HASH: "Depo doğrulandı",
      REGISTRY_MATCH: "Bilinen uygulama",
      UNVERIFIED: "Doğrulanmadı",
      REVOKED: "Güven iptal edildi",
      INVALID_SIGNATURE: "İmza geçersiz",
    },
  };
  return labels[locale][trust];
}
