# ZUI webOS Platform Mimarisi

## Amaç

ZUI webOS Platform, LG TV'nin orijinal sistemini değiştirmeden uygulama keşfi, güvenli paket yayını ve yerel Developer Mode kurulumu sağlar. Bulut tarafı katalog ve yayın varlıklarını yönetir; TV erişimi ve kurulum yetkisi kullanıcının yerel ağında kalır.

Bu belge hedef mimariyi ve 2 Ekim 2026 itibarıyla uygulanan DevMode Keeper temelini tanımlar. Diğer bileşenler yalnız açıkça `implemented` olarak işaretlendiklerinde uygulanmış kabul edilir.

## Mimari ilkeler

1. **Rootless:** Platform LG TV'yi root etmez veya root gerektirmez; firmware, system partition ve sistem servislerini değiştirmez; privilege escalation uygulamaz.
2. **Local-first device control:** TV adresi, geliştirici anahtarı ve cihaz komutları yalnızca kullanıcının yerel makinesinde tutulur.
3. **Signed catalog:** Katalog ve sürüm metadatası imzalanır; istemciler imzayı ve paket özetini doğrular.
4. **Independent repositories first:** Mevcut ürün depoları, migrasyon doğrulanana kadar bağımsız Git geçmişlerini korur.
5. **Contract-driven:** TV, masaüstü ve servisler aynı sürümlenmiş katalog ve cihaz sözleşmelerini kullanır.
6. **Compatibility is evidence:** Bir webOS sürümü ancak gerçek cihaz veya tanımlı kabul matrisi ile doğrulandıysa desteklenmiş sayılır.
7. **No hidden remote control:** Bulut hizmeti yerel TV'ye doğrudan komut göndermez.

## Workspace ve repository topolojisi

```text
C:\My_OS\LG-TV\                     # workspace root; Git repository değil
|-- ZUI_IPTV_Player\                 # bağımsız product repo
|-- ZUI_YouTube_WebOS\               # bağımsız product repo
`-- ZUI_WebOS_Platform\              # platform monorepo
```

Platformun `apps/`, `packages/` ve `services/` dizinleri platform bileşenleri içindir. Bağımsız IPTV ve YouTube ürün depoları `apps/` altına kopyalanmaz, submodule yapılmaz ve workspace root bir meta-repo haline getirilmez.

## Sistem bağlamı

```text
 Publisher/Admin
       |
       v
  Web Portal --------> Release Service -------> Repository Service
       |                     |                          |
       |                     v                          v
       +--------------> Catalog Service <-------- Object Storage
                              |
                         signed catalog
                              |
              +---------------+----------------+
              |                                |
              v                                v
          TV Store                    ZUI webOS Manager
                                                |
                                      local network only
                                                |
                                                v
                                       LG TV Developer Mode
                                                ^
                                                |
                                         DevMode Keeper
```

## Bileşenler

### `apps/devmode-keeper`

İlk sürümü CLI-first yerel yardımcıdır. Public webOS CLI üzerinden cihaz alias'larını keşfeder, bağlantıyı denetler, resmi Developer Mode uzatma yolunu çalıştırır ve komut kabulü ile sonrasındaki bağlantıyı ayrı olarak doğrular. Otomatik arka plan zamanlayıcısı kurulmaz.

Sınırlar:

- TV erişim bilgileri cihazdan dışarı gönderilmez.
- TV kapalı veya erişilemezse işlem başarısız olarak kaydedilir ve sonraki zamanlamaya bırakılır.
- Oturum uzatma hiçbir zaman kalıcılık garantisi olarak sunulmaz.
- Public CLI expiry timestamp sağlamadığında kalan süre bilinmiyor olarak raporlanır.
- Gerçek TV uzatması yalnız açık kullanıcı isteği veya sonradan ayrıca kurulacak opt-in politika ile çalıştırılır.

### `apps/zui-webos-manager`

Yerel kontrol düzlemidir. TV eşleme, katalog okuma, paket indirme, hash/imza doğrulama, kurulum, başlatma ve tanılama işlemlerini yürütür.

Bu uygulama bulut ile TV arasındaki güven sınırıdır. Bulut yalnızca doğrulanabilir yayın varlıklarını sunar; Manager TV'ye hangi işlemin uygulanacağına yerel olarak karar verir.

### `apps/tv-store`

TV üzerinde çalışan salt okunur katalog ve uygulama ayrıntı arayüzüdür. İlk sürümde doğrudan ayrıcalıklı kurulum yapmaz. Kurulum isteğini QR/kısa kod veya yerel ağ eşlemesiyle Manager'a aktarır.

Bu ayrım TV uygulamasının yetki yüzeyini küçük tutar ve Developer Mode araçlarının masaüstünde kalmasını sağlar.

### `apps/web-portal`

Üç rolü destekleyecek şekilde tasarlanır:

- kullanıcı: katalog ve yardım içeriği,
- yayıncı: uygulama/sürüm taslağı ve doğrulama sonucu,
- yönetici: inceleme, geri çekme, uyumluluk ve politika yönetimi.

### `services/catalog-service`

Uygulama, sürüm, kanal, uyumluluk ve yayın durumu için okuma ağırlıklı API sağlar. TV Store ve Manager yalnızca yayınlanmış, imzalanmış katalog görünümünü tüketir.

Önerilen temel varlıklar:

- `Publisher`
- `Application`
- `Release`
- `Artifact`
- `Channel` (`stable`, `beta`, `internal`)
- `CompatibilityClaim`
- `CatalogSnapshot`
- `Revocation`

### `services/repository-service`

IPK, ikon, ekran görüntüsü, SBOM ve sürüm notu gibi varlıkları kabul eder. Dosyaları değişmez kimlik ve SHA-256 özetiyle saklar. Doğrulanmamış yüklemeler karantina alanında kalır; katalogda görünmez.

### `services/release-service`

Yayın hattını yönetir:

```text
upload -> quarantine -> schema validation -> malware/policy scan
       -> metadata review -> signature -> catalog publish -> observation
```

Her aşama tekrar çalıştırılabilir ve denetlenebilir olmalıdır. Geri çekme, dosyayı sessizce değiştirmek yerine yeni bir `Revocation` kaydı üretir.

## Paylaşılan paketler

| Paket | Sorumluluk |
|---|---|
| `catalog-contracts` | Katalog şeması, API DTO'ları ve imza zarfı |
| `device-contracts` | Yerel Manager/TV Store eşleme mesajları; gizli anahtar içermez |
| `design-system` | Web ve TV için ortak tokenlar; TV odak/focus davranışı ayrı adaptörle uygulanır |
| `shared-config` | Lint, TypeScript ve test ayarları; eski uygulamalara aşamalı uygulanır |

## Ortamlar

En az üç mantıksal ortam önerilir:

| Ortam | Amaç | Yayın kanalı |
|---|---|---|
| local | geliştirici makinesi, taklit servisler | local |
| staging | entegrasyon ve imza doğrulama | internal/beta |
| production | son kullanıcı kataloğu | stable |

Ortam gizli değerleri repoya yazılmaz. Her ortam ayrı kimlik, depo alanı, imzalama anahtarı ve denetim günlüğü kullanır.

## Gözlemlenebilirlik

Servislerde yapılandırılmış log, istek kimliği, metrik ve denetim izi bulunur. Yerel uygulama logları varsayılan olarak şu alanları redakte eder:

- TV IP/adres bilgisi,
- cihaz anahtarı ve SSH materyali,
- IPTV URL'leri ve kullanıcı bilgileri,
- hesap/cookie/token verileri,
- yerel dosya yollarındaki kullanıcı adı.

## Uygulama sırası

1. DevMode Keeper CLI ve güvenli public webOS CLI adaptörü. **Implemented.**
2. `catalog-contracts` ve imzalı statik katalog PoC'si.
3. Manager'da katalog doğrulama ve yerel paket indirme.
4. Repository/Release servislerinde karantina ve yayın kapıları.
5. TV Store katalog deneyimi ve Manager eşlemesi.
6. Opt-in DevMode Keeper zamanlaması ve hata toparlama.
7. Web Portal yayıncı/yönetici akışları.

Bu sıra, en riskli yüzey olan cihaz kontrolünü bulut servislerinden ayırırken erken bir uçtan uca değer akışı üretir.

## Açık kararlar

- SaaS altyapısı: yönetilen platform mu, kendi container ortamı mı?
- Kimlik sağlayıcısı ve organizasyon/tenant modeli.
- Paket imza biçimi ve çevrimdışı kök anahtar politikası.
- TV Store ile Manager arasındaki eşleme protokolü.
- Desteklenecek minimum webOS/Chromium matrisi.

Bu kararlar ilgili bulut/dağıtım bileşenlerine başlanmadan kapatılmalıdır. Hafif pnpm monorepo ve bağımsız sibling-product-repo modeli kararlaştırılmıştır.

## İlgili belgeler

- [Güvenlik ve güven modeli](SECURITY_AND_TRUST_MODEL.md)
- [Repository modeli](REPOSITORY_MODEL.md)
- [DevMode Keeper](DEVMODE_KEEPER.md)
- [Uygulama yaşam döngüsü](APP_LIFECYCLE.md)
- [Mevcut durum denetimi](../migration/CURRENT_STATE_AUDIT_2026-10-01.md)
- [Güvenli migrasyon planı](../migration/SAFE_MIGRATION_PLAN.md)
