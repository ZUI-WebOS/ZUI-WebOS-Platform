# Application Lifecycle

## External product lifecycle

ZUI applications remain in their product repositories. The platform consumes release metadata and never treats a local development checkout as a deployable release.

```text
product repository
  -> CI and tests
  -> version tag
  -> release artifact + SHA-256 + notes
  -> registry review
  -> catalog publication
  -> local Manager download and verification
  -> explicit Developer Mode install
  -> observation or rollback
```

## Registry states

Future registry entries move through `draft`, `validated`, `published`, `deprecated`, and `revoked`. An artifact is immutable after publication. Corrections require a new version or explicit revocation record.

## Installation authority

The Web Manager and catalog services do not directly control a TV. A future local Manager owns the install decision, validates SHA-256 and provenance, uses the configured device alias, and requests user confirmation for mutations. DevMode Keeper is separate and cannot install, uninstall, launch product applications, or clear storage.

## Rollback

A release record retains its artifact digest and release notes. Rollback means installing an explicitly selected earlier compatible artifact through the local Manager; it never means silently replacing registry bytes under an existing version.
