# Installation Planner

The planner is a pure policy module. It combines a package inspection, product registry, installed-app inventory, and device reachability into `PackageDeploymentComparison` and `InstallationPlan`.

Version ordering is used only for valid semantic versions. Other values produce `UNKNOWN`. The result contains a proposed `ares-install` argument array for review, but `executable` is always `false` and `requiresExplicitApproval` is always `true`.

Product, release, and artifact are separate contracts:

- Product: stable external repository and allowed app identities.
- Release: product plus release version and source.
- Artifact: filename, SHA-256, app ID, and deployment class for one release.

The current local registry stores product identities. A future trusted release feed may provide release and artifact records; no cloud registry or trusted hash channel is implemented here.

