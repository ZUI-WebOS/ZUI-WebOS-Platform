# ZUI IPTV Player — Pre-Migration Recovery Kaydı

Tarih: 1 Ekim 2026  
Kapsam: kaynak değişmeden önce alınan geri dönüş ve bütünlük baz çizgisi

## Yol ve Git kimliği

| Alan | Değer |
|---|---|
| Source absolute path | `C:\My_OS\ZUI_IPTV_Player` |
| Target absolute path | `C:\My_OS\LG-TV\ZUI_IPTV_Player` |
| Current branch | `main` |
| HEAD | `ec2d16678839a6caf7d6ccef90c906fe160798c9` |
| `origin/main` | `ec2d16678839a6caf7d6ccef90c906fe160798c9` |
| Upstream farkı | `+0 -0` |
| Origin URL | `https://github.com/Simulate-X/ZUI_IPTV_Player.git` |
| Commit sayısı | 28 |
| Tracked file count | 156 |
| Untracked file count | 7 |
| Toplam dosya sayısı | 7.681 (`.git`, ignored ve untracked dahil) |
| Toplam boyut | 160.256.527 byte |
| Application ID | `com.zui.player` |
| Application version | `1.0.1` |

Son commit:

```text
ec2d16678839a6caf7d6ccef90c906fe160798c9
2026-09-23T14:37:09+03:00
feat: improve VOD history and playback resume
```

## `git status --porcelain=v2 --branch`

```text
# branch.oid ec2d16678839a6caf7d6ccef90c906fe160798c9
# branch.head main
# branch.upstream origin/main
# branch.ab +0 -0
? docs/CLOUD_SYNC_PRODUCTION_INCIDENT_PLAN.md
? docs/GITHUB_RELEASE_CHECKLIST.md
? docs/LICENSE_DRAFT.md
? docs/RELEASE_NOTES_DRAFT.md
? docs/RELEASE_READINESS.md
? docs/SECURITY_REVIEW.md
? docs/cloud-sync/production-emergency-lockdown-draft.sql
```

Tracked dosyalarda değişiklik yoktur. Yedi yolun tamamı untracked ve ignore edilmemiştir.

## `git remote -v`

```text
origin  https://github.com/Simulate-X/ZUI_IPTV_Player.git (fetch)
origin  https://github.com/Simulate-X/ZUI_IPTV_Player.git (push)
```

## `git worktree list --porcelain`

```text
worktree C:/My_OS/ZUI_IPTV_Player
HEAD ec2d16678839a6caf7d6ccef90c906fe160798c9
branch refs/heads/main
```

Tek worktree vardır. Repo submodule içermez.

## Untracked dosya sınıflandırması

| Dosya | Boyut | Tür | Amaç | Neden untracked tahmini | Önem |
|---|---:|---|---|---|---|
| `docs/CLOUD_SYNC_PRODUCTION_INCIDENT_PLAN.md` | 5.879 B | Markdown / incident runbook | Cloud Sync üretim güvenlik olayı müdahale ve onay kapıları | Son release commitinden sonra hazırlanmış, henüz yayın/commit kararı verilmemiş yerel güvenlik belgesi | Yüksek; olay müdahalesi ve kullanıcı onay sınırı içeriyor |
| `docs/GITHUB_RELEASE_CHECKLIST.md` | 3.955 B | Markdown / release checklist | Yayına girecek dosya ve commit gruplarını ayırmak | Yerel yayın hazırlık taslağı; bilinçli olarak commit dışında tutulmuş görünüyor | Yüksek; release kapsamı ve yerel artifact dışlama kararı içeriyor |
| `docs/LICENSE_DRAFT.md` | 1.833 B | Markdown / lisans taslağı | MIT lisans metni ve inceleme notu | Hukuki/yayın onayı bekleyen taslak | Yüksek; yayın lisans kararını etkiler |
| `docs/RELEASE_NOTES_DRAFT.md` | 3.681 B | Markdown / sürüm notu taslağı | 1.0.1 değişiklikleri ve doğrulama durumunu özetlemek | Sürüm yayımlanmadan önce onay bekleyen taslak | Yüksek; release provenance içeriyor |
| `docs/RELEASE_READINESS.md` | 5.872 B | Markdown / kabul raporu | Git, build, SSH/smoke ve yayın kapılarını izlemek | Açık kabul kapıları bulunduğu için commitlenmemiş çalışma belgesi | Yüksek; eksik kabul durumunu koruyor |
| `docs/SECURITY_REVIEW.md` | 11.220 B | Markdown / güvenlik incelemesi | Cloud Sync veri akışı, RLS ve tehdit modelini değerlendirmek | Güvenlik kararı ve doğrulama kapıları tamamlanmadan tutulmuş yerel inceleme | Kritik; güvenlik borcu ve üretim sınırı içeriyor |
| `docs/cloud-sync/production-emergency-lockdown-draft.sql` | 7.472 B | SQL / çalıştırılmaması gereken taslak | Üretim erişimini veri silmeden sınırlandırmak için kontrollü acil müdahale taslağı | Dosyanın kendi başlığı açıkça kullanıcı onayı olmadan çalıştırılmamasını söylüyor; bu nedenle kasıtlı taslak | Kritik; yalnız ayrı açık onayla değerlendirilmeli, bu görevde çalıştırılmadı |

Bu sınıflandırmadaki “neden untracked” alanı Git geçmişinden kanıtlanmış niyet değil, dosya adı/içeriği ve zamanına dayalı tahmindir. Dosyalar silinmedi, stash edilmedi, commitlenmedi veya ignore edilmedi.

## Untracked SHA-256

```text
0D615D7DCD7B179588BF907F5B8EDAB3CBCCE6504946E494C50E6A2691817EA9  docs/CLOUD_SYNC_PRODUCTION_INCIDENT_PLAN.md
F45AC64D0CAD855B454A6BF8E087514D196A18F4DBD3BC967EBF383B1EC8A714  docs/GITHUB_RELEASE_CHECKLIST.md
E3243401DCD928A31F0D6FAD2F3FEC0076EFDAE73FFF9797C18D07D1F4CADD83  docs/LICENSE_DRAFT.md
8E87989756E11A42FF54457818EA92C2159E770EC2E28A3DD543C852967253B0  docs/RELEASE_NOTES_DRAFT.md
47C31824865CE533F0F36213155E5D0F94DB7CE059E90209B4DF4DF3608A30CE  docs/RELEASE_READINESS.md
3CEEC2B0CE882C1165DA96293FF86952B06F63A6EC2DEB92B5E44B6281773D19  docs/SECURITY_REVIEW.md
E93684585BF697662819E740F469F9E1A087687F9788A717E65EFE0750919403  docs/cloud-sync/production-emergency-lockdown-draft.sql
```

## Önemli yapılandırma hashleri

| Dosya | SHA-256 |
|---|---|
| `.gitignore` | `5D8C7A6EB8B8007E695181454E8245817541CE0DAB6499280ADB757C113C5139` |
| `.gitattributes` | `6F32655D4A5C72A97A1651BCA77BC601901E74D00B99D27C4E0102E1EAC775A7` |
| `.env.example` | `FE2F62B2B5D70393657938FBA3F163256F8B8C524DCCFD3769081BDB13006461` |
| `.env.local` | `DDFF8E4DC9757D1F419758BDC3A06452411EAF22A98F2F9EF9130432326B8E9D` — içerik rapora alınmadı |
| `package.json` | `E7CF1462D21A4A2D7C2C9E6AE3BC37D4B42F3E61AA20435FC3A71C98AA7A1626` |
| `package-lock.json` | `67DC6D0369752073F7F7112FD6A7B566D096A6C364DDE933258AED12FC7019B9` |
| `appinfo.json` | `7DDB5B0E0848457F1FDDD54A5721198E3254A2994077F302E9F4A95462117A28` |
| `com.zui.player.manifest.json` | `56428701A6A9A7FB55D75F6FB8738BAD9410E95D282933AF59F0AF22D9A700AF` |
| `vite.config.ts` | `0588DAE8C2A3B412CC79807471F5054DA43E1650C871E9D0720BC52B12BE84B7` |
| `tsconfig.json` | `8335A6B1F6A66FB46D307A36AD29B9713CABA8915A0FEC463EAB3EF3B20848C7` |
| `tsconfig.node.json` | `9E2ABB169EA87B7190613A1D4DA57CA608463A453BD4231FA3AEEE5E308370DD` |
| `tailwind.config.js` | `C0338152B9ECCC380114609698BDA08DFE88CD5A3DFAEF290AC91528BA3405F3` |
| `postcss.config.js` | `251ECDDD4672C9CF467547E3DC535DE00AD2129DF26E7E7AE728FA4E5AC45FC5` |
| `scripts/deploy.ps1` | `DB3F5C23CA49678CF9C69B6BF3AE92051985DCFCE4D4DDFB1D5EC33C12FC34B9` |
| `scripts/windows-setup/verify-current-source.ps1` | `3C885014E35DA552ED36021954F9C7F7BCFB6011D796C05B91557707749C3125` |

## Tam payload manifesti

[ZUI_IPTV_Player_PRE_MIGRATION_SHA256.txt](ZUI_IPTV_Player_PRE_MIGRATION_SHA256.txt) `.git` dışındaki 7.053 dosyanın SHA-256 değerini içerir. Buna tracked, untracked, ignored dependency/build/release dosyaları dahildir.

- Manifest SHA-256: `B7D653FBAF585EBE2AF9BA6D5816C9DE9612A53E88729EEA108060DAC51FBB4E`
- Git metadata kapsamı: manifest dışı; branch/ref/status/worktree kayıtları ve `git fsck --full` ile doğrulanır.
- `git fsck --full`: exit `0`; bir dangling commit ve bir dangling blob raporlandı. Bunlar Git object veritabanında erişilemeyen nesnelerdir, bütünlük hatası değildir ve migrasyonda `.git` ile birlikte korunmalıdır.

## Geri dönüş prosedürü

Taşıma sonrası hedef doğrulaması başarısız olursa ve kaynak yol boşsa, `C:\My_OS\LG-TV\ZUI_IPTV_Player` aynı volume üzerinde `C:\My_OS\ZUI_IPTV_Player` yoluna geri taşınır. Hiçbir `clean`, `reset`, `checkout`, stash veya Git geçmişi yeniden yazımı uygulanmaz. Hedef veya kaynakta çakışma varsa otomatik geri taşıma yapılmaz; işlem durdurulur.

