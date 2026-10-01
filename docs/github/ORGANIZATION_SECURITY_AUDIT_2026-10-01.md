# ZUI-WebOS Organization Security Audit

Audit timestamp: 2026-10-01T06:32:06+03:00  
Organization: `ZUI-WebOS`  
Organization ID: `336342662`  
Organization node ID: `O_kgDOFAwuhg`  
Method: read-only GitHub REST/GraphQL queries through authenticated GitHub CLI.

No credential, token value, secret value, or variable value is recorded in this document.

## Identity and membership

- Organization exists and is publicly resolvable.
- Authenticated account: `Simulate-X`.
- Membership: active.
- Role: organization owner (`admin` in the GitHub membership API).
- Members: 1.
- Owners: 1.
- Public repositories before the IPTV transfer: 0.
- Private repositories before the IPTV transfer: 0.

## Repository permissions

- Base repository permission: `read`.
- Members can create repositories: enabled.
- Members can create public repositories: enabled.
- Members can create private repositories: enabled.
- Members can create internal repositories: disabled/not applicable.
- Members can change repository visibility: enabled.
- Members can delete repositories: enabled.
- Members can fork private repositories: disabled.
- Members can create public and private Pages sites: enabled.
- A separate member repository-transfer policy is not exposed by the queried organization REST object.

## Authentication and signing

- Require two-factor authentication: disabled.
- Web commit signoff requirement: disabled.

## GitHub Actions

- Organization Actions policy: all actions and reusable workflows are allowed.
- Fork pull-request contributor approval policy: `first_time_contributors`.
- The selected-actions endpoint returned conflict because the organization permits all actions.

## Secrets and variables

- Organization Actions secrets: 0.
- Organization Actions variables: 0.
- No values were queried or recorded.

## Rulesets

- Organization rulesets could not be enabled or enumerated: GitHub returned `403 Upgrade to GitHub Team to enable this feature`.
- This is a plan limitation, not evidence of an API/authentication failure.

## Security observations

1. Organization-wide 2FA is now mandatory.
2. Repository creation, deletion, and visibility changes are now restricted by the organization member-policy flags.
3. GitHub Actions still accepts all third-party actions without an allowlist or SHA-pinning policy.
4. There is a single owner, creating an account-recovery and continuity risk.
5. Organization-level rulesets are unavailable on the current plan.

No organization-wide setting was changed during this audit.

## Post-transfer addendum

Verified at 2026-10-01T06:34:18+03:00 and again during final closeout:

- Public repositories after transfer: 1.
- `ZUI-WebOS/ZUI-IPTV-Player` retained repository ID `1247455998`.
- The repository remained public and retained default branch `main` at `ec2d16678839a6caf7d6ccef90c906fe160798c9`.
- Repository secret scanning and push protection were enabled before transfer but observed disabled after transfer. They were not automatically re-enabled in this task.
- Organization settings themselves were not mutated.

## Security hardening result

Hardening verification timestamp: 2026-10-01T06:44:48+03:00 and final closeout.  
Authenticated owner: `Simulate-X`.  
Repository: `ZUI-WebOS/ZUI-IPTV-Player`, ID `1247455998`.  
Repository HEAD remained `ec2d16678839a6caf7d6ccef90c906fe160798c9`.

| Control | Before | Action | After | Verification |
|---|---|---|---|---|
| Require organization 2FA | Off | Enabled manually in GitHub organization settings | On — **CLOSED / PASS** | `two_factor_requirement_enabled=true` |
| Member repository creation | On | Disabled through organization REST API | Off | General, public, and private creation flags all read back `false` |
| Member repository deletion | On | Disabled manually in GitHub organization settings | Off — **CLOSED / PASS** | `members_can_delete_repositories=false` |
| Member visibility changes | On | Disabled manually in GitHub organization settings | Off — **CLOSED / PASS** | `members_can_change_repo_visibility=false` |
| Base repository permission | `read` | Set to `none` | `none` | Organization REST readback; public repository readability is unaffected by base member permission |
| Secret scanning | Off after transfer | Enabled | On | Repository `security_and_analysis.secret_scanning.status=enabled` |
| Push protection | Off after transfer | Enabled | On | Repository `security_and_analysis.secret_scanning_push_protection.status=enabled` |
| `main` force push protection | No branch protection | Added classic branch protection with admin enforcement | Blocked | `allow_force_pushes.enabled=false`, `enforce_admins.enabled=true` |
| `main` deletion protection | No branch protection | Added classic branch protection with admin enforcement | Blocked | `allow_deletions.enabled=false`, `enforce_admins.enabled=true` |
| Vulnerability alerts | Off | Enabled | On | Vulnerability-alerts check returned success |
| Dependabot security updates | Off | Enabled | On | Automated security fixes readback: `enabled=true`, `paused=false` |

## 2FA safety gate evidence

- Members: one, `Simulate-X`.
- Owners: one, `Simulate-X`.
- Organization membership: active owner.
- Members returned by the owner-only `filter=2fa_disabled` query: zero.
- Outside collaborators: zero.
- 2FA-disabled outside collaborators: zero.
- Pending invitations: zero.
- The authenticated-user endpoint did not expose the personal 2FA field with the current token, but the organization compliance filter was accessible and returned no non-compliant member.

## Additional security feature state

- Dependabot version updates: not configured; no `.github/dependabot.yml` exists. No source/config file was created in this task.
- Private vulnerability reporting: disabled; left unchanged because enablement was not requested.
- CodeQL default setup: available for JavaScript/TypeScript but `not-configured`; left unchanged pending build/cost review.
- Organization Actions policy: unchanged, all actions allowed. There are currently no repository workflows.
- Repository-level rulesets: none. Organization rulesets remain unavailable on the GitHub Free plan.
- Classic `main` protection requires no pull-request approvals and no status checks, so direct non-force owner pushes remain possible.
- Admin enforcement is enabled, so the owner cannot bypass the force-push or branch-deletion blocks through normal GitHub branch operations.

## Final hardened state

Read-only API verification on 2026-10-01 confirmed the final organization and repository state. No GitHub setting was mutated during this closeout.

| Scope | Control | Final state | Result |
|---|---|---|---|
| Organization | Require 2FA | `two_factor_requirement_enabled=true` | **PASS** |
| Organization | Base repository permission | `default_repository_permission=none` | **PASS** |
| Organization | Member repository creation | general/public/private creation flags `false` | **PASS** |
| Organization | Member visibility changes | `members_can_change_repo_visibility=false` | **PASS** |
| Organization | Member repository deletion | `members_can_delete_repositories=false` | **PASS** |
| Organization | Active owner | `Simulate-X`, active, role `admin` | **PASS** |
| IPTV repository | Numeric identity | repository ID `1247455998` | **PASS** |
| IPTV repository | Secret scanning | enabled | **PASS** |
| IPTV repository | Push protection | enabled | **PASS** |
| IPTV repository | Vulnerability alerts | enabled | **PASS** |
| IPTV repository | Dependabot security updates | enabled, not paused | **PASS** |
| IPTV `main` | Force push | blocked; admin enforcement enabled | **PASS** |
| IPTV `main` | Branch deletion | blocked; admin enforcement enabled | **PASS** |

The former manual-action gates for 2FA, repository visibility changes, and repository deletion are closed. Residual recommendations—second-owner resilience, an Actions allowlist, optional CodeQL/private-vulnerability-reporting review, and stronger PR/check policy—are defense-in-depth items, not failures of the requested hardening baseline.
