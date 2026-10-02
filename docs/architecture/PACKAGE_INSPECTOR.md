# Verified Package Inspector

The inspector treats every `.ipk` as hostile input. It streams SHA-256 over the outer file, validates a normal non-symlink file and Debian `ar` structure, then reads the bounded `data.tar.gz` payload in memory without extracting package files to disk.

Real platform packages use:

```text
!<arch>\n
debian-binary
control.tar.gz
data.tar.gz
```

Every `appinfo.json` is represented. No manifest is silently selected when a package contains more than one. Required manifest fields are `id`, `title`, and `version`; vendor, entry point, type, and icon references are optional.

Package inspection proves structural validity and reports a digest. Registry matching associates an app ID with a product identity and deployment class. Neither operation proves publisher or artifact authenticity.

