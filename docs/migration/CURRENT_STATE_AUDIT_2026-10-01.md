# Post-Migration Mevcut Durum — 1 Ekim 2026

## Durum ve kapsam

ZUI IPTV Player migrasyonu tamamlanmıştır. Bu belge artık pre-migration planını değil, doğrulanmış post-migration dosya sistemi, Git, build/package ve provenance arşiv durumunu kaydeder.

| Rol | Kanonik yol | Durum |
|---|---|---|
| Workspace | `C:\My_OS\LG-TV` | Yalnız bağımsız proje klasörlerini barındıran container; Git repository değildir. |
| Platform | `C:\My_OS\LG-TV\ZUI_WebOS_Platform` | Platform scaffold'u; bu görevlerde `git init` yapılmadı. |
| Canonical IPTV repo | `C:\My_OS\LG-TV\ZUI_IPTV_Player` | Aktif bağımsız Git repository. |
| Old IPTV source | `C:\My_OS\ZUI_IPTV_Player` | Migrasyon sonrasında artık yok. |
| IPTV provenance archive | `C:\My_OS\LG-TV\_Archive\ZUI_IPTV_Player` | Hash-doğrulamalı tarihsel RC/release arşivi. |
| YouTube source | `C:\My_OS\Youtube-webos` | Migrate edilmedi ve değiştirilmedi. |

`C:\My_OS\LG-TV\ZUI_YouTube_WebOS` henüz oluşturulmamıştır.

## Canonical ZUI IPTV Git durumu

```text
path:        C:\My_OS\LG-TV\ZUI_IPTV_Player
branch:      main
HEAD:        ec2d16678839a6caf7d6ccef90c906fe160798c9
origin/main: ec2d16678839a6caf7d6ccef90c906fe160798c9
commits:     28
tracked:     156
untracked:   7
git fsck:    PASS
```

Tracked çalışma ağacı temizdir. Korunan untracked kullanıcı dosyaları:

```text
docs/CLOUD_SYNC_PRODUCTION_INCIDENT_PLAN.md
docs/GITHUB_RELEASE_CHECKLIST.md
docs/LICENSE_DRAFT.md
docs/RELEASE_NOTES_DRAFT.md
docs/RELEASE_READINESS.md
docs/SECURITY_REVIEW.md
docs/cloud-sync/production-emergency-lockdown-draft.sql
```

Bu dosyalar migrasyon sırasında silinmedi, stash edilmedi, commitlenmedi veya ignore edilmedi. Pre-migration durum ve payload hashleri [recovery kaydında](recovery/ZUI_IPTV_Player_PRE_MIGRATION_2026-10-01.md) ve [SHA-256 manifestinde](recovery/ZUI_IPTV_Player_PRE_MIGRATION_SHA256.txt) korunur.

## Migrasyon ve bütünlük sonucu

- `.git` dizini, 28 commitlik tarihçe, `main`, origin ve `origin/main` ilişkisi korundu.
- Taşıma öncesi ve hemen sonrası `.git` dışındaki 7.053 payload dosyası SHA-256 olarak yüzde 100 eşleşti.
- `git fsck --full` exit 0 verdi. Raporlanan bir dangling commit ve bir dangling blob bütünlük hatası değildir; `.git` ile birlikte korundu.
- Eski kaynak yolu kaldırıldı; yeni kanonik yol tek aktif IPTV repository'sidir.
- Commit, push, remote değişikliği, stash, reset veya clean yapılmadı.

## Build ve package kabulü

Migrasyon provasında ve kanonik hedefte doğrulanan araç zinciri:

| Aşama | Gözlenen sürüm | Sonuç |
|---|---|---|
| Dependency integrity | npm / mevcut lockfile | PASS |
| TypeScript + Vite build | Node `v24.18.0` | PASS |
| webOS package | Node `v16.20.2` | PASS |
| webOS CLI | **observed `3.2.3`** | PASS |
| IPK inspection | `com.zui.player` 1.0.1 | PASS |

Bazı tarihsel RC belgeleri CLI `3.2.5` sürümünü expected/planned araç zinciri olarak kaydeder. Bu makinede doğrulanan sürüm `3.2.3` olduğundan iki değer eşdeğer veya güncel diye sunulmaz. Bu görevde CLI, Node veya dependency upgrade/downgrade yapılmadı.

TV install/uninstall/launch ve Developer Mode işlemleri migrasyon kabulünün parçası değildi.

## Tarihsel RC ve release-work provenance arşivi

İki Git-dışı eski çalışma alanı, benzersiz materyal seçimi ve hash-doğrulamalı ZIP geri-açma kabulinden sonra kaldırıldı:

| Eski kaynak | Arşiv paketi | Geri-açma sonucu | Eski kaynak durumu |
|---|---|---|---|
| `C:\My_OS\ZUI_IPTV_Player_RC` | `RC_1.0.1_Provenance.zip` | 58/58 dosya, `100% MATCH` | Silindi |
| `C:\My_OS\ZUI_IPTV_Player_release_work` | `Release_Work_1.0.0_Provenance.zip` | 139/139 dosya, `100% MATCH` | Silindi |

ZIP, paket manifesti ve dış checksum değerleri [ARCHIVE_CHECKSUMS_SHA256.txt](../../../_Archive/ZUI_IPTV_Player/ARCHIVE_CHECKSUMS_SHA256.txt) içinde kayıtlıdır. Sıkıştırılmamış provenance klasörleri de ZIP'lerin yanında korunur.

`C:\My_OS\ZUI_IPTV_Player_Backups` bu arşiv/silme işleminin kapsamı dışındadır ve `KEEP` olarak yerinde bırakılmıştır. Beş DPAPI dosyası, dört metadata, dört checksum dosyası ve `INVALID_DO_NOT_RESTORE.txt` korunur; dört kabul edilmiş checksum çifti yeniden PASS vermiştir.

## YouTube mevcut durumu

YouTube tarafı migrate edilmedi, kopyalanmadı, yeniden adlandırılmadı veya worktree repair işlemine alınmadı.

```text
webosbrew:
  branch: main
  HEAD:   f1b3b72926bb0cc312b5ceddc6a5b8c8ca081914
  status: clean

NicholasBly primary:
  branch: feature/turkish-auto-translate-poc
  HEAD:   5f7aa18fa0829b4e0607475222d5adacd85c6eff
  status: mevcut tracked/untracked çalışma korunuyor
```

Worktree topolojisi değişmemiştir:

| Yol | Branch/HEAD | Durum |
|---|---|---|
| `upstream/nicholasbly` | `feature/turkish-auto-translate-poc` @ `5f7aa18...` | dirty primary |
| `contrib/nicholasbly` | `feature/translated-caption-target` @ `954919a...` | clean |
| `work/patch-verify-20260906` | detached @ `5f7aa18...` | clean |
| `work/stability-patch-verify` | detached @ `5f7aa18...` | clean |

Üç linked worktree'nin `.git` işaretçileri ve primary repository kayıtları mevcut `C:/My_OS/Youtube-webos/...` mutlak yollarını kullanmaya devam eder. YouTube migrasyonu ayrı ve kontrollü bir görevdir.

## Güncel karar

- Workspace root meta-repo veya monorepo değildir.
- ZUI IPTV Player migrasyonu ve yerel build/package kabulü tamamlanmıştır.
- Tarihsel RC/release-work kanıtları doğrulanmış provenance arşivine dönüştürülmüştür.
- Backups kullanıcı kurtarma verisi olarak korunur.
- YouTube tarafı mevcut konumunda ve mevcut Git/worktree topolojisiyle bırakılır.
- Bir sonraki bağımsız migrasyon konusu yalnız kullanıcı tarafından ayrıca yetkilendirilirse `ZUI_YouTube_WebOS` olacaktır.

## İlgili belgeler

- [Güvenli migrasyon planı](SAFE_MIGRATION_PLAN.md)
- [Platform mimarisi](../architecture/PLATFORM_ARCHITECTURE.md)
- [Güvenlik ve güven modeli](../architecture/SECURITY_AND_TRUST_MODEL.md)
- [İsimlendirme standardı](../development/NAMING_CONVENTIONS.md)

