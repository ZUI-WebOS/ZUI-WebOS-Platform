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
    install: "Install",
    update: "Update",
    installNow: "Install now",
    cancel: "Cancel",
    pair: "Pair securely",
    pairCode: "Eight-digit pairing code",
    installMode: "STAGING INSTALL MODE",
    pairTitle: "Pair with the armed service",
    pairBody:
      "Enter the short-lived code shown by the operator. It is used only for this staging session.",
    preparing: "Preparing…",
    verifiedPackage: "Verified package",
    signedStagingRelease: "Signed staging release",
    reviewInstall: "Review before installing",
    reviewBody:
      "Confirm the exact staging application, version, device, and trust decision.",
    application: "Application",
    action: "Action",
    currentState: "Current state",
    targetVersion: "Target version",
    device: "Device",
    explicitApproval:
      "Cancel is selected by default. Move deliberately to Install now to approve once.",
    installingApplication: "Installing staging application",
    doNotTurnOff:
      "Keep the TV and developer PC available while verification completes.",
    installedSuccessfully: "Installed successfully",
    installFailed: "Installation stopped safely",
    backToProduct: "Back to product",
    installUnavailable:
      "Installation is available only for eligible, signed staging releases while Install Mode is armed.",
    installArmedHint:
      "Requires an operator-armed, short-lived staging session.",
    installPhases: {
      PREPARING: "Preparing",
      VERIFYING_PACKAGE: "Verifying package",
      CHECKING_TV: "Checking TV",
      INSTALLING: "Installing",
      VERIFYING_INSTALLATION: "Verifying installation",
      COMPLETE: "Complete",
    },
    installErrors: {
      INSTALL_FAILED: "The installation could not be completed.",
      PLAN_CHANGED: "The installation plan changed. Review again.",
      PLAN_STALE: "The installation plan changed. Review again.",
      PLAN_EXPIRED: "The installation plan expired. Review again.",
      SESSION_INVALID: "The install session expired. Re-arm and pair again.",
      SESSION_EXPIRED: "The install session expired. Re-arm and pair again.",
      DEVICE_UNREACHABLE: "The TV is not reachable.",
      INSTALL_VERIFICATION_FAILED:
        "The installation result could not be verified.",
      INSTALL_POLICY_BLOCKED: "Installation policy blocked this operation.",
    },
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
    install: "Yükle",
    update: "Güncelle",
    installNow: "Şimdi yükle",
    cancel: "İptal",
    pair: "Güvenli eşleştir",
    pairCode: "Sekiz haneli eşleştirme kodu",
    installMode: "STAGING KURULUM MODU",
    pairTitle: "Hazır kurulum hizmetiyle eşleştirin",
    pairBody:
      "Operatörün ekranındaki kısa süreli kodu girin. Kod yalnızca bu staging oturumunda kullanılır.",
    preparing: "Hazırlanıyor…",
    verifiedPackage: "Doğrulanmış paket",
    signedStagingRelease: "İmzalı staging sürümü",
    reviewInstall: "Yüklemeden önce kontrol edin",
    reviewBody:
      "Staging uygulamasını, sürümü, cihazı ve güven kararını doğrulayın.",
    application: "Uygulama",
    action: "İşlem",
    currentState: "Mevcut durum",
    targetVersion: "Hedef sürüm",
    device: "Cihaz",
    explicitApproval:
      "Başlangıçta İptal seçilidir. Bir kez onaylamak için bilinçli olarak Şimdi yükle seçeneğine geçin.",
    installingApplication: "Staging uygulaması yükleniyor",
    doNotTurnOff:
      "Doğrulama tamamlanana kadar TV'yi ve geliştirici bilgisayarını açık tutun.",
    installedSuccessfully: "Başarıyla yüklendi",
    installFailed: "Kurulum güvenli biçimde durduruldu",
    backToProduct: "Ürüne dön",
    installUnavailable:
      "Kurulum yalnızca Kurulum Modu hazırken uygun ve imzalı staging sürümleri için kullanılabilir.",
    installArmedHint:
      "Operatör tarafından açılan kısa süreli staging oturumu gerekir.",
    installPhases: {
      PREPARING: "Hazırlanıyor",
      VERIFYING_PACKAGE: "Paket doğrulanıyor",
      CHECKING_TV: "TV kontrol ediliyor",
      INSTALLING: "Yükleniyor",
      VERIFYING_INSTALLATION: "Kurulum doğrulanıyor",
      COMPLETE: "Tamamlandı",
    },
    installErrors: {
      INSTALL_FAILED: "Kurulum tamamlanamadı.",
      PLAN_CHANGED: "Kurulum planı değişti. Yeniden kontrol edin.",
      PLAN_STALE: "Kurulum planı değişti. Yeniden kontrol edin.",
      PLAN_EXPIRED: "Kurulum planının süresi doldu. Yeniden kontrol edin.",
      SESSION_INVALID:
        "Kurulum oturumunun süresi doldu. Hizmeti yeniden hazırlayıp eşleştirin.",
      SESSION_EXPIRED:
        "Kurulum oturumunun süresi doldu. Hizmeti yeniden hazırlayıp eşleştirin.",
      DEVICE_UNREACHABLE: "TV'ye ulaşılamıyor.",
      INSTALL_VERIFICATION_FAILED: "Kurulum sonucu doğrulanamadı.",
      INSTALL_POLICY_BLOCKED: "Kurulum politikası bu işlemi engelledi.",
    },
  },
} as const;

export function text(locale: Locale) {
  return strings[locale];
}
export function installErrorLabel(locale: Locale, code: string): string {
  const errors = strings[locale].installErrors as Record<string, string>;
  return errors[code] ?? strings[locale].installErrors.INSTALL_FAILED;
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
