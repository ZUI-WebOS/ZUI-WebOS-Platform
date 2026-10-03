# Update Evaluation

`UpdateEvaluationService` correlates one registered application identity with installed inventory and compatible normalized catalog releases. It returns a `ProductUpdateComparison`; it never changes device state.

## Compatibility gate

A candidate must match all of the following:

- product;
- exact App ID;
- deployment class;
- compatible channel (`production` maps to `stable`, `staging` maps to `staging`).

This prevents a staging release such as `com.zui.webos.youtube.staging` from becoming an update candidate for production `youtube.leanback.v4`. Beta is represented in the domain for future use but is not silently mapped into either current deployment class.

## Version result

Semantic ordering is used only when both installed and candidate versions are valid SemVer. The highest compatible valid candidate is selected, including correct prerelease precedence.

| Condition                                   | Status                  |
| ------------------------------------------- | ----------------------- |
| No installed instance                       | `NOT_INSTALLED`         |
| No compatible release                       | `NO_COMPATIBLE_RELEASE` |
| Either compared version is not valid SemVer | `VERSION_UNKNOWN`       |
| Installed equals candidate                  | `UP_TO_DATE`            |
| Installed is older                          | `UPDATE_AVAILABLE`      |
| Installed is newer                          | `AHEAD_OF_CATALOG`      |

## Trust and policy separation

`versionStatus`, `trustStatus`, and `policyStatus` are independent. A newer version may therefore be `UPDATE_AVAILABLE` while trust is `UNVERIFIED` and policy is `BLOCK`.

The catalog reports `PLAN_AVAILABLE` only for a compatible staging candidate whose cache is currently `CACHED_VERIFIED` and whose trust is signed or repository-pinned. This is not installation approval. Actual plan creation revalidates cache evidence and delegates to the existing planner/risk policy. Production remains blocked and the Web Manager exposes no install execution control.
