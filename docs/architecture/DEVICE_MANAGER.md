# Device Manager Core

Device Manager Core is the rootless, read-only device inventory layer. It uses the public LG webOS CLI device registry and never reads private application storage.

## Domain

`ManagedDevice` combines configured-device identity, observed health, and advertised capabilities. `InventorySnapshot` records the selected device, observation time, source, and every application returned by `ares-install --listfull`. `InstalledApplication` preserves normalized fields and the original public key/value metadata.

Device aliases and application/version identifiers are typed separately. Public failures use stable `PlatformError` codes rather than raw process exceptions.

## Adapter behavior

The adapter invokes executables with argument arrays, `shell: false`, a timeout, and captured output. Inventory is parsed as blank-line-delimited records containing stable `key : value` fields; optional fields are tolerated, while a record without `id` is rejected as malformed.

Supported read-only operations are device listing, device inspection/connectivity, installed-application listing, and one-app lookup. The milestone does not install, remove, launch, or clear an application.

