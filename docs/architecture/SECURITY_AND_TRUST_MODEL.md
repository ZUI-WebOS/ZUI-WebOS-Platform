# Güvenlik ve Güven Modeli

## Rootless platform sınırı

ZUI webOS Platform:

- LG TV'yi root etmez ve root gerektirmez,
- firmware veya system partition değiştirmez,
- privilege escalation uygulamaz,
- mümkün olduğu ölçüde LG Developer Mode ve resmi developer tooling kullanır.

Developer Mode sınırları dışında kalan bir özellik platform kapsamına kendiliğinden alınmaz. Gerçek TV install, uninstall, launch veya oturum uzatma işlemi ayrıca açık kullanıcı onayı gerektirir.

## Korunan varlıklar

Platform aşağıdaki varlıkları yüksek hassasiyetli kabul eder:

- LG Developer Mode cihaz anahtarları ve yerel bağlantı bilgileri,
- IPTV kaynak URL'leri ve kimlik bilgileri,
- yayıncı imzalama anahtarları,
- portal oturumları ve erişim belirteçleri,
- yayınlanmamış IPK ve özel test varlıkları,
- denetim günlüklerindeki kişisel/yerel ağ bilgileri.

## Güven sınırları

```text
Untrusted publisher upload
          |
          v
   Quarantine boundary
          |
   validation + review
          v
  Signed catalog boundary
          |
          v
 Local Manager boundary ---- local-only secrets ----> LG TV
```

Bir yükleme, yayıncı hesabı doğrulanmış olsa bile güvenilir değildir. Bir katalog kaydı da imza ve sürüm politikası doğrulanmadan kurulum yetkisi vermez.

Dosya sistemi güven sınırı da açıktır: `C:\My_OS\LG-TV` yalnız workspace container'dır; `ZUI_WebOS_Platform` ile sibling ürün depoları birbirinden bağımsız Git ve release sınırlarına sahiptir.

## Zorunlu kurallar

1. TV anahtarı, IP adresi ve Developer Mode kimlik bilgileri bulut API'sine gönderilmez.
2. Manager, indirilen paketin katalogda bildirilen hash ve imzasını kurulumdan önce doğrular.
3. Repository Service yüklemeleri karantinaya alır; doğrudan yayın URL'si üretmez.
4. Yayınlanmış bir artifact değiştirilemez. Yeni dosya yeni kimlik ve yeni sürüm gerektirir.
5. İptal/geri çekme kaydı imzalı katalogda görünür ve istemcilerce uygulanır.
6. Portal yönetici işlemleri denetim günlüğüne yazılır.
7. Üretim gizli değerleri `.env`, doküman, hata raporu veya istemci bundle'ına yazılmaz.
8. Gerçek TV install/launch/extend işlemleri kullanıcı onayı olmadan otomatikleştirilmez.

## Tehditler ve kontroller

| Tehdit | Kontrol | Kabul kanıtı |
|---|---|---|
| Değiştirilmiş IPK | hash + yayın imzası | bozuk dosya kurulumdan önce reddedilir |
| Kötü niyetli yayıncı yüklemesi | karantina, tarama, manuel politika kapısı | yayınlanmamış artifact katalogda görünmez |
| Eski/güvensiz sürüme dönüş | kanal politikası ve minimum sürüm | yasaklı downgrade reddedilir |
| Çalınmış portal oturumu | kısa ömürlü oturum, MFA, rol sınırı | ayrıcalıklı işlem yeniden doğrulama ister |
| Yerel TV anahtarı sızıntısı | OS credential store, redakte log | tanılama paketi anahtar içermez |
| Katalog taklidi | sabitlenmiş kök anahtar ve imzalı snapshot | imzasız/yanlış imzalı katalog açılmaz |
| Tedarik zinciri riski | kilit dosyası, SBOM, bağımlılık taraması | yayın kaydı SBOM ve tarama sonucuna bağlanır |
| Buluttan LAN'a gizli komut | cloud-to-TV kontrol yolunun olmaması | Manager kapalıyken TV komutu çalışamaz |

## Yerel veri politikası

Manager ve DevMode Keeper, gizli cihaz verisini işletim sisteminin güvenli kimlik deposunda tutmalıdır. Düz JSON, log, registry export veya kaynak kontrolü kabul edilmez.

Tanılama dışa aktarımı iki aşamalıdır:

1. otomatik redaksiyon,
2. kullanıcıya gönderim öncesi içerik özeti ve açık onay.

## İmzalama modeli

Önerilen ayrım:

- çevrimdışı kök anahtar katalog güven kökünü imzalar,
- çevrimiçi kısa ömürlü yayın anahtarı katalog snapshot'larını imzalar,
- paket üreticisi imzası yayıncı kökenini kanıtlar,
- platform imzası tarama ve yayın politikasının geçtiğini kanıtlar.

Anahtar döndürme ve iptal bilgisi katalog sözleşmesinin ilk sürümünde yer almalıdır; sonradan eklenmesi güven zincirini kırar.

## Gizlilik sınırı

SaaS analitiği varsayılan olarak uygulama/sürüm indirme sayısı gibi toplu olaylarla sınırlanır. Kanal listesi, izleme geçmişi, IPTV sağlayıcısı, TV IP'si, cihaz anahtarı veya kurulu uygulama envanteri toplanmaz.

## Güvenlik kabul kapıları

Bir üretim yayını için en az:

- sözleşme şeması doğrulaması,
- hash ve imza doğrulama testleri,
- SBOM üretimi,
- bağımlılık ve kötü amaçlı dosya taraması,
- gizli değer taraması,
- yetki/rol entegrasyon testleri,
- geri çekme testi,
- redakte tanılama testi,
- yedek geri yükleme provası

geçmelidir.

## İlgili belgeler

- [Platform mimarisi](PLATFORM_ARCHITECTURE.md)
- [Güvenli migrasyon planı](../migration/SAFE_MIGRATION_PLAN.md)
