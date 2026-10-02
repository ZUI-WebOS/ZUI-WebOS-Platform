# Installation Planner

The planner is a pure policy module. Plan V2 combines package inspection, pinned release metadata, installed-app inventory, and device reachability into a canonical approval-gated contract.

Version ordering is used only for valid semantic versions. Other values produce `UNKNOWN`. The result contains creation/expiry timestamps, canonical artifact path/hash/identity/trust, protected-production state, comparison, risks, policy, proposed argv, and `planDigest`. `executable` is true only for policy-allowed pinned staging artifacts; the exact digest remains mandatory.

Product, release, and artifact are separate contracts:

- Product: stable external repository and allowed app identities.
- Release: product plus release version and source.
- Artifact: filename, SHA-256, app ID, and deployment class for one release.

The local repository now stores validated release/artifact records. No cloud download or publisher-signature channel is implemented.

