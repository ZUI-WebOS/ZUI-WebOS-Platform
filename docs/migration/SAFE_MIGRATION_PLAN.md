# Güvenli Git ve Workspace Migrasyon Planı

## Amaç ve sınırlar

Bu plan `ZUI_IPTV_Player` deposunu Git geçmişi, branch, remote, tracked/untracked dosyalar ve yerel release çıktıları kaybolmadan kanonik workspace'e taşır.

| Rol | Yol |
|---|---|
| Workspace root | `C:\My_OS\LG-TV` |
| Platform root | `C:\My_OS\LG-TV\ZUI_WebOS_Platform` |
| Product source | `C:\My_OS\ZUI_IPTV_Player` |
| Migration target | `C:\My_OS\LG-TV\ZUI_IPTV_Player` |
| Rehearsal copy | `C:\My_OS\LG-TV\ZUI_WebOS_Platform\.migration-rehearsal\ZUI_IPTV_Player` |

`C:\My_OS\Youtube-webos` bu planın fiziksel değişiklik kapsamı dışındadır. `C:\My_OS\LG-TV\ZUI_YouTube_WebOS` bu görevde oluşturulmaz.

## Kanonik topoloji

```text
C:\My_OS\LG-TV\
|-- ZUI_IPTV_Player\       # bağımsız Git repository
`-- ZUI_WebOS_Platform\    # bağımsız gelecek repository; bu görevde git init yok
```

Workspace root Git deposu değildir. Ürünler platform `apps/` dizinine gömülmez; submodule, subtree veya monorepo dönüşümü yapılmaz.

## Değişmez güvenlik kuralları

- `clean`, `reset`, `checkout`, `stash`, otomatik commit, force işlemi ve remote değişikliği yoktur.
- Untracked dosyalar kullanıcı verisi sayılır; silinmez, ignore edilmez veya otomatik commitlenmez.
- Hedef çakışması veya overwrite ihtiyacında gerçek migrasyon durur.
- Dependency upgrade, lockfile normalizasyonu ve `npm audit fix` yoktur.
- TV install/uninstall/launch, Developer Mode uzatma ve gerçek TV bağlantısı yoktur.
- Rehearsal klasörü kabul sonunda otomatik silinmez.

## Kapı M0 — Başlangıç ve çakışma denetimi

Doğrulanacaklar:

1. kaynak ve hedef mutlak yolları,
2. hedefin mevcut olmaması,
3. kaynak Git kökü, branch, HEAD ve origin,
4. tracked durum ve tüm untracked yollar,
5. platform ile workspace root'un Git deposu olmaması.

**PASS:** hedef yoktur ve kaynak beklenen bağımsız depodur.

## Kapı M1 — Kurtarma seti

Platform altında `docs/migration/recovery/` içine şu kanıtlar yazılır:

- source/target yolları,
- branch, HEAD, origin ve upstream ilişkisi,
- `git status --porcelain`, `git remote -v`, `git worktree list`,
- tracked/untracked sayıları ve untracked sınıflandırması,
- önemli yapılandırma hashleri,
- `package.json`, lockfile ve `appinfo.json` hashleri,
- toplam dosya sayısı/boyutu,
- `.git` dışındaki tüm payload dosyalarının SHA-256 manifesti.

Git object bütünlüğü ayrıca `git fsck --full` ile doğrulanır; secret içerikleri rapora kopyalanmaz.

## Kapı M2 — Tam rehearsal copy

Kaynak, `.git`, ignored çıktılar ve untracked dosyalar dahil rehearsal yoluna kopyalanır. Kaynak ile prova arasında:

- payload manifesti,
- HEAD, branch, origin, worktree ve status,
- tracked/untracked seti,
- mutlak eski yol referansları

karşılaştırılır. Herhangi bir uyuşmazlık gerçek taşıma kapısını kapatır.

## Kapı M3 — Rehearsal build/package

Prova kopyasında mevcut zincir kullanılır:

1. Node 24 ile dependency integrity ve `npm run build`,
2. Node 16.20.2 ile `ares-package dist -o dist-ipk`,
3. IPK varlığı ve yerel paket incelemesi.

`package.json` içinde ayrı lint/test scripti yoksa bu kontroller `NOT_AVAILABLE` olarak raporlanır; başarı uydurulmaz. TV komutları çalıştırılmaz.

## Kapı M4 — Gerçek migrasyon

Yalnız M0-M3 geçerse ve hedef hâlâ yoksa kaynak dizin aynı volume üzerinde hedefe taşınır. İşlemden hemen sonra:

- kaynak yolun artık bulunmadığı,
- hedefte `.git` ve bütün payload'ın bulunduğu,
- `main`, beklenen HEAD, origin/main eşitliği ve remote'un aynı kaldığı,
- 7 untracked dosyanın yol ve hash olarak korunduğu,
- son beş commitin değişmediği

doğrulanır.

Taşıma sonrası geri dönüş, hedefi aynı volume üzerinde kaynak yoluna geri taşımaktır. Eski veya yeni içerik silinmez.

## Kapı M5 — Hedefte yerel kabul

Dependency/lockfile hashleri önce ve sonra karşılaştırılır. Mevcut `node_modules` ile dependency integrity, build ve IPK package tekrar çalıştırılır. Build çıktılarındaki beklenen webOS dosyaları ve IPK kimliği kontrol edilir. Gerçek cihaz kabulü bu kapının parçası değildir.

## YouTube değişmezlik kontrolü

Görev başı ve sonunda aşağıdakiler karşılaştırılır:

- webosbrew repo branch/HEAD/status/remotes,
- NicholasBly ana repo branch/HEAD/kirli status/remotes,
- bağlı worktree listesi ve her worktree HEAD/status,
- `C:\My_OS\Youtube-webos` yolunun varlığı,
- `C:\My_OS\LG-TV\ZUI_YouTube_WebOS` yolunun yokluğu.

YouTube tarafında taşıma, kopyalama, worktree repair veya Git mutasyonu yapılmaz.

## İlgili belgeler

- [Mevcut durum denetimi](CURRENT_STATE_AUDIT_2026-10-01.md)
- [IPTV pre-migration recovery kaydı](recovery/ZUI_IPTV_Player_PRE_MIGRATION_2026-10-01.md)
- [Platform mimarisi](../architecture/PLATFORM_ARCHITECTURE.md)
- [Güvenlik ve güven modeli](../architecture/SECURITY_AND_TRUST_MODEL.md)
- [İsimlendirme standardı](../development/NAMING_CONVENTIONS.md)

