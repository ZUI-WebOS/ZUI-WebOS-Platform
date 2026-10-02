# Package Security

## Trust boundary

Local IPKs are untrusted. Inspection does not execute contents and does not extract them. The parser rejects non-files, symlinks, wrong extensions, malformed `ar`/gzip/tar structures, absent Debian members, unsafe or invalid paths, absolute paths, drive paths, traversal, backslashes, duplicate case-insensitive paths, and tar symlinks/hardlinks.

Default bounds are 512 MiB per IPK, 20,000 archive entries, 64 MiB per member/entry, and 256 MiB total uncompressed tar content. SHA-256 is streamed; only the already bounded compressed payload and bounded uncompressed tar are held in memory.

## Meaning of verification

- Inspection means the supported archive and metadata structure passed local validation.
- An app ID match does not establish a trusted publisher.
- A calculated hash identifies bytes but does not establish a trusted source.
- A hash comparison establishes provenance only when the expected hash arrived through a separately trusted channel.

Matching repository-pinned release metadata raises trust to `REPOSITORY_PINNED_HASH`; it still does not prove authorship. Mismatch, missing metadata, production identity, and unknown provenance are execution blocks.

Before installation, the service rehashes and reparses the artifact and compares device inventory with the approved plan. File size, mtime, or path alone is never trusted. Semantic plan edits invalidate its canonical digest, expired/used plans are rejected, and approval cannot be reused for another artifact or device.

