# ZUI-WebOS Organization Security Baseline

Prepared: 2026-10-01  
Scope: recommended target state for the `ZUI-WebOS` organization and its repositories.  
Enforcement status: requested organization hardening baseline applied and read back on 2026-10-01; remaining defense-in-depth and plan-limited controls are identified below.

## Current-to-target summary

| Control | Current state | Recommended target | Priority |
|---|---|---|---|
| Organization 2FA | Required; **CLOSED / PASS** | Keep required and review membership compliance before adding members | Critical |
| Owner resilience | One owner | At least two trusted owners with recovery procedures | High |
| Base repository permission | None, applied | Keep `none`; grant explicit repository roles | Medium |
| Repository creation | Non-owner creation disabled, applied | Keep owner-only behavior | High |
| Repository deletion | Non-owner member deletion disabled; **CLOSED / PASS** | Keep restricted | Critical |
| Visibility changes | Non-owner member visibility changes disabled; **CLOSED / PASS** | Keep restricted | High |
| GitHub Actions | All actions allowed | GitHub-owned plus an explicit allowlist; pin third-party actions to commit SHAs | High |
| Organization rulesets | Unavailable on current Free plan | Use repository branch protection now; reconsider organization rulesets if the plan changes | High |
| IPTV `main` protection | Force pushes/deletion blocked with admin enforcement | Add PR/check requirements only when CI and team workflow justify them | High |
| IPTV Dependabot security updates | Enabled, applied | Keep enabled and triage alerts | Medium |
| IPTV secret scanning | Secret scanning and push protection enabled, applied | Keep enabled and review after ownership/visibility changes | Critical |
| Vulnerability alerts | Enabled, applied | Keep enabled and establish triage ownership | High |
| Private vulnerability reporting | Disabled | Consider enabling for coordinated reports | Medium |
| CodeQL default setup | Available for JavaScript/TypeScript; not configured | Evaluate query/build cost, then enable in a separate task if acceptable | Medium |
| Organization secrets/variables | None | Add only when required, with minimum repository visibility | Medium |

## Authentication and owner recovery

1. Require two-factor authentication for every organization member.
2. Maintain at least two trusted owners so loss of one account does not lock the organization.
3. Store organization recovery procedures outside GitHub in an access-controlled location.
4. Review owner and member lists quarterly and immediately after role changes.
5. Prefer hardware-backed or passkey authentication for owners.

## Least-privilege repository permissions

- Keep the organization base permission at `none` and grant repository roles explicitly. Public repository readability remains governed by repository visibility.
- Limit repository creation, deletion, transfer, and visibility changes to owners.
- Grant `admin` and `maintain` only for concrete operational needs.
- Review outside collaborators and deploy keys regularly.

## GitHub Actions policy

- Permit GitHub-owned actions and a short reviewed allowlist.
- Pin third-party actions to immutable commit SHAs rather than movable tags.
- Set `GITHUB_TOKEN` permissions to read-only by default and elevate per workflow/job.
- Require approval for workflows from fork contributors.
- Do not expose secrets to untrusted fork workflows.
- Add CI only when checks are deterministic enough to become branch requirements.

## Branch protection and rulesets

For `ZUI-WebOS/ZUI-IPTV-Player` `main`, the first two controls are now applied:

- block force pushes and branch deletion, including admin/owner bypass;
- require pull requests for non-emergency changes;
- require at least one owner/code-owner approval when more maintainers join;
- dismiss stale approvals after relevant changes;
- require conversation resolution;
- require status checks once CI exists;
- consider linear history and signed commits after validating contributor workflow.

Organization rulesets currently require a GitHub Team upgrade. Until then, configure equivalent repository-level branch protection where supported.

## Dependabot and security scanning

- Vulnerability alerts and Dependabot security updates are enabled; define who triages alerts.
- Secret scanning and push protection are enabled again after the repository transfer disabled them.
- Treat alerts as triage inputs; do not auto-merge dependency upgrades without tests.
- Review security settings after every ownership transfer or visibility change.

## Secret management

- Keep credentials out of source, issues, release notes, Actions logs, and audit documents.
- Prefer environment- or repository-scoped secrets over organization-wide secrets.
- Limit selected-repository access and rotate credentials after role or provider changes.
- Record only secret names, ownership, purpose, and rotation dates in inventories; never values.
- Use environments with required reviewers for sensitive deployment credentials.

## Release permissions and provenance

- Limit release creation and tag management to trusted maintainers.
- Protect release tags operationally; do not delete or recreate published tags without an incident record.
- Build releases from a documented commit and retain SHA-256 checksums and a reproducible build recipe.
- Prefer signed tags/releases once key management and recovery are documented.
- Verify repository ID, commit SHA, artifact hash, and release metadata during migration or recovery.

## CODEOWNERS strategy

- Add `CODEOWNERS` in a separate source-change task.
- Start with owner review for workflow files, packaging/deployment scripts, security policy, cloud-sync policy, and release configuration.
- Avoid creating a single-person bottleneck when a second trusted maintainer becomes available.

## Recovery policy

- Keep a periodic repository bundle or verified clone outside the active checkout.
- Record repository numeric ID, default-branch SHA, tags, release IDs, and remote URL before transfers.
- Test recovery documentation periodically without rewriting production history.
- Require two-person review before repository deletion, transfer, visibility downgrade, or credential rotation when staffing permits.

## Final hardened state

Read-only API verification on 2026-10-01 established this enforced baseline:

- organization 2FA required;
- base repository permission `none`;
- member repository creation disabled, including public/private creation;
- member repository deletion disabled;
- member repository visibility changes disabled;
- `Simulate-X` active as organization owner;
- `ZUI-WebOS/ZUI-IPTV-Player` identity retained as repository ID `1247455998`;
- secret scanning, push protection, vulnerability alerts, and Dependabot security updates enabled;
- force pushes and deletion blocked on `main`, with admin enforcement.

The former manual-action items for 2FA, deletion, and visibility changes are **CLOSED / PASS**. No organization or repository security setting was changed during the final read-only verification.

## Remaining defense-in-depth follow-up

1. Keep the applied owner-only repository creation policy and `none` base permission.
2. Restrict GitHub Actions to an allowlist before adding workflows.
3. Evaluate CodeQL default setup for JavaScript/TypeScript in a separate task.
4. Consider private vulnerability reporting for coordinated disclosure.
5. Add a second trusted organization owner and document recovery.
