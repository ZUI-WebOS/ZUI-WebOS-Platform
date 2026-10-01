# ZUI İsimlendirme Standardı

Bu belge ZUI webOS çalışma alanı için resmi isimlendirme standardıdır. Mevcut çalışan uygulamaların kimliklerini geriye dönük değiştirmez.

## Yerel bağımsız proje klasörü

Biçim: `ZUI_<Product>_<SubProduct>`

Kelimeler PascalCase yazılır ve underscore ile ayrılır.

Örnekler:

- `ZUI_IPTV_Player`
- `ZUI_YouTube_WebOS`
- `ZUI_WebOS_Platform`
- `ZUI_Media_Player`
- `ZUI_Photo_Viewer`

Bu kural bağımsız proje kökleri içindir. `apps/devmode-keeper`, `packages/catalog-contracts` veya `services/release-service` gibi teknik alt klasörler normal yazılım terminolojisini korur.

## GitHub repository

Kelimeler tire ile ayrılır:

- `ZUI-IPTV-Player`
- `ZUI-YouTube-WebOS`
- `ZUI-WebOS-Platform`

## Kullanıcıya görünen ürün adı

- `ZUI IPTV Player`
- `ZUI YouTube for webOS`
- `ZUI webOS Platform`

## LG/webOS uygulama kimliği

Yeni uygulamalar için yaklaşım:

```text
com.zui.webos.<product>
```

Örnekler:

- `com.zui.webos.iptv`
- `com.zui.webos.youtube`
- `com.zui.webos.store`

Mevcut çalışan uygulamaların application ID değerleri bu standarda uyarlamak amacıyla kendiliğinden değiştirilmez. Kimlik değişimi veri, paket, güncelleme ve kurulum uyumluluğu etkileri incelenmiş ayrı bir migrasyon gerektirir.

## Marka yazımı

| Bağlam | Yazım |
|---|---|
| Kullanıcı arayüzü ve dokümantasyon | `webOS` |
| PascalCase dosya/klasör bileşeni | `WebOS` |
| YouTube markası | `YouTube` |

