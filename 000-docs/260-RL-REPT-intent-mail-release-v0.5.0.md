# Release Report: intent-mail v0.5.0

## Executive Summary

- **Version**: 0.5.0 (from 0.4.1)
- **Release Date**: 2026-06-30
- **Release Type**: MINOR (features + breaking dependency majors; 0.x semantics)
- **Approved By**: jeremy (SHA-confirmed at `abdbb0e`)
- **Release commit**: `fcc1c19`
- **Tag**: `v0.5.0` (annotated)
- **GitHub Release**: https://github.com/jeremylongshore/intent-mail/releases/tag/v0.5.0

The first release since the `v0.4.1` tag, which predated the entire feature
platform. This release captures the platform build (Outlook parity, daily-digest
engine, web API, token encryption, plugin packaging) **and** a large hardening
pass: multi-account sync, React 19, dependency modernization, a real test stack,
and removal of dead code.

## Pre-Release State

- **Pull Requests**: 0 open (all merged before release)
- **Branches**: `main` + `beads-sync` only; working tree clean
- **Beads**: 0 open / 0 in-progress (backlog fully cleared; `S7.3 multi-account
  sync` was the last, closed in this cycle)
- **Secrets scan**: PASS (no tracked `.env`, no key patterns)
- **Scaffolding**: complete (CHANGELOG, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT,
  LICENSE, .gitignore, CLAUDE.md)

## Changes Included

### Added
- Multi-account sync orchestration — bounded-concurrency rate limiting +
  active-account prioritization.
- L5 security CI (gitleaks + OSV); L3 mutation testing (Stryker baseline);
  rules-engine E2E suite; gated Gmail/Outlook integration harness.
- `build:web` gated in CI; governance scaffolding.

### Changed
- React 19 + Ink 7 migration (TUI + web).
- Dependency modernization (better-sqlite3 12, openai 6, googleapis 173,
  @anthropic-ai/sdk, @inquirer/prompts 8, conf 15, dotenv 17, commander 15,
  @types/node 26, CI actions).
- Web app is the decoupled DailyReview surface on `/api`.
- Lint rules `no-case-declarations` + `no-var-requires` promoted to errors.

### Fixed
- Sync daemon persists refreshed Gmail tokens (token drift) + guards overlapping
  poll cycles.
- OSV CI check no longer reports a phantom failure on every PR.

### Removed
- Dead `@anthropic-ai/claude-agent-sdk`; obsolete GCP deploy machinery (Cloud Run
  + Terraform); dead deps (`marked`, `md-to-pdf`, Playwright).

## Metrics

| Metric | Value |
|--------|-------|
| Merged PRs since v0.4.1 | 25 |
| Files changed | 164 |
| Lines added | +22,402 |
| Lines removed | -10,679 |
| Tests (at release) | 227 passed / 3 skipped |
| Days since last release | tag was early; this is the platform release |

## Quality Gates

| Gate | Status |
|------|--------|
| Lint (ESLint, 0 errors) | ✓ |
| Type check (tsc strict) | ✓ |
| Tests + coverage floor | ✓ (227 passed) |
| Build (tsc) | ✓ |
| Build web bundle (vite) | ✓ |
| Secrets scan | ✓ |
| CHANGELOG + SemVer conformance | ✓ |

## Security Posture

- **npm audit**: 8 findings (5 high, 2 moderate, 1 low) — all **dev/build-time
  tooling**, not runtime. The 5 high are the documented `duckdb` → bundled
  `node-gyp@9.4.1` build chain (`fix=NONE`); the 2 moderate are Stryker dev
  deps. Accepted residual per `tests/TESTING.md` § Dependency audit.
- OAuth tokens encrypted at rest (AES-256-GCM); the mailbox never leaves the
  user's machine (self-hosted MCP).

## External Artifacts

| Artifact | Status |
|----------|--------|
| GitHub Release | ✓ live (v0.5.0) |
| Public gist (one-pager + operator audit) | not created (no `.gist-id`); optional follow-up |

## Rollback Procedure

```bash
git push origin --delete v0.5.0
git tag -d v0.5.0
gh release delete v0.5.0 --yes
git revert fcc1c19 && git push origin main
```

## Post-Release Checklist

- [ ] (Optional) Generate the public one-pager + operator-audit gist.
- [ ] Consider promoting Stryker `break` off `null` once `engine.ts` has a
      co-located unit test (mutation score currently dragged by its 0%).
- [ ] Next feature candidates: hosted Graph-subscription Outlook watch;
      marketplace listing in `claude-code-plugins`.
