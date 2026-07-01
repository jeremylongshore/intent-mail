# Release Report: intent-mail v0.5.1

## Executive Summary

- **Version**: 0.5.1 (from 0.5.0)
- **Release Date**: 2026-06-30
- **Release Type**: PATCH (3 fixes, no features)
- **Approved By**: jeremy (SHA-confirmed at `7c7b65a`)
- **Release commit**: `416e5ca`
- **Tag**: `v0.5.1` (annotated)
- **GitHub Release**: https://github.com/jeremylongshore/intent-mail/releases/tag/v0.5.1
- **npm**: `@intentsolutionsio/intentmail@0.5.1` (tagged `latest`)

**First release cut through the CI auto-publish pipeline.** Pushing the `v0.5.1`
tag triggered `release.yml` → `publish-npm` (build + `npm publish --provenance
--access public`) → `github-release`. Both jobs succeeded; a Sigstore provenance
attestation is attached (attestations URL present on the registry), so the
package shows the "Published from CI" badge. No manual `npm publish` /
`gh release create` this cycle.

## Pre-Release State

- **Pull Requests**: 0 open (3 merged since v0.5.0: #89 publish hardening,
  #90 import side-effect fix, #91 advisory cleanup)
- **Working tree**: clean · **Beads**: 0 open · **Secrets scan**: PASS
- **npm audit**: 0 vulnerabilities (was 5 high before #91)

## Changes Included (all Fixed/Changed — no features)

### Fixed
- Importing the package no longer creates `./data/intentmail.db` in the
  consumer's cwd (server bootstrap guarded behind an entry-point check); `serve`
  still initializes the DB. (#90)
- Cleared all critical/high npm/Dependabot advisories, `npm audit` 5 → 0, via
  targeted `overrides` + an `esbuild` devDep bump; runtime deps untouched. (#91)

### Changed
- Hardened the npm publish path: `publishConfig.access=public`, `types` +
  `exports`, `prepublishOnly` build guard, corrected repo URLs, and CI
  auto-publish with Sigstore provenance on tag push. (#89)

## Metrics

| Metric | Value |
|--------|-------|
| PRs since v0.5.0 | 3 |
| Files changed | 7 |
| Lines | +675 / -1,399 |
| Tests | 227 passed / 3 skipped |
| npm audit | 0 |

## Quality Gates

| Gate | Status |
|------|--------|
| Lint / typecheck / tests / build / build:web | ✓ |
| CHANGELOG + SemVer conformance | ✓ |
| Secrets scan | ✓ |
| npm audit (0 vulns) | ✓ |
| CI publish-npm job | ✓ (provenance attached) |
| CI github-release job | ✓ |

## External Artifacts

| Artifact | Status |
|----------|--------|
| npm `@intentsolutionsio/intentmail@0.5.1` | ✓ published (latest) |
| Sigstore provenance attestation | ✓ attached |
| GitHub Release v0.5.1 | ✓ created (by CI) |
| Public gist (one-pager + operator audit) | not created (no `.gist-id`); optional |

## Rollback Procedure

```bash
git push origin --delete v0.5.1 && git tag -d v0.5.1
gh release delete v0.5.1 --yes
npm unpublish @intentsolutionsio/intentmail@0.5.1   # within 72h; discouraged — prefer a 0.5.2
git revert 416e5ca && git push origin main
```

## Notes / Follow-ups

- The CI publish path is now proven; future releases are just `bump → CHANGELOG
  → tag push`. Consider swapping the reused personal npm token in `NPM_TOKEN`
  for a dedicated automation token.
- Optional: generate the public one-pager + operator-audit gist.
- Stryker `break` is still `null` (report-only) pending a co-located
  `engine.ts` unit test.
