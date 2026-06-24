# TEST_AUDIT.md — intent-mail

> Diagnostic from `/audit-tests` · 2026-06-23 · branch `main` · transient file.

## Grade

**C+ (74/100)** — strong, clean unit layer on a real type gate + CI, but coverage
is unmeasured, the lint gate is non-functional, and L4–L7 are thin/absent.

## Classification

Multi-surface Node/TypeScript project. UNION classification:
- **service** (the MCP server, `src/index.ts`, stdio) — primary
- **cli** (`src/cli`, Commander + Ink TUI)
- **frontend** (`src/web`, React/PWA dashboard)
- **library** (connectors, AI, rules, storage)

Test framework: **vitest 4.0.16**. Tests co-located in `src/**/*.test.ts`
(13 files, **192 tests**). Harness: `@intentsolutions/audit-harness` v0.1.0
(vendored, `scripts/audit-harness`).

## Per-layer presence / config / enforcement

| Layer | Status | Notes |
|---|---|---|
| **L1** Git hooks & CI | 🟡 Partial | `ci.yml` runs lint + typecheck + test on PRs. **No local git hooks** (no husky/pre-commit). CI **lint step is non-blocking** (`\|\| echo`). |
| **L2** Static & types | 🟡 Partial | **TypeScript strict ✓** (real, enforced gate). **ESLint is broken** — no config file, so `npm run lint` errors out (the gate is a no-op). |
| **L3** Unit & function | 🟢 Present | 192 tests, well-targeted (retry policy, Graph URL/empty-body/401, token crypto round-trip+tamper, provider routing, digest composition, action routing, context resolution, web router). **Bias scan: clean.** Gaps: no coverage measurement, no mutation. |
| **L4** Integration & regression | 🟡 Partial | Real-DB integration test (token crypto + v1–v6 migrations against a temp SQLite). No contract tests, no Docker-backed integration. |
| **L5** System quality | 🔴 Absent | No perf / a11y / security-scan. Mostly waivable for a local-first MCP, **except** a secret/dep security scan is warranted (handles OAuth tokens). |
| **L6** E2E / BDD | 🔴 Absent | No `.feature` files, no e2e specs. The web dashboard + CLI have no smoke/e2e. (Playwright was removed as unused — no e2e layer by choice.) |
| **L7** Acceptance / UAT | 🔴 Absent | No business-validation layer. |

## Gaps

### P0 (blocking) — none
No policy floor is breached because no `tests/TESTING.md` thresholds are pinned,
and there is no RTM with uncovered MUSTs. (Set thresholds to make these enforce.)

### P1 (should fix)
1. **ESLint non-functional** — no `.eslintrc`/`eslint.config.*`; `npm run lint`
   errors. The L2 lint gate doesn't run. (CI swallows it with `|| echo`.)
2. **No coverage provider** — `@vitest/coverage-v8` not installed, so coverage %
   is unmeasurable and no floor can be enforced.
3. **No `tests/TESTING.md`** — classification, thresholds, and waivers are not
   pinned, so gates can't enforce against policy.
4. **L6 dormant** — Playwright present but no smoke test for the web `/api` +
   DailyReview or the CLI happy path.

### P2 (advisory)
- No mutation testing (Stryker) on the core logic (rules engine, retry, crypto).
- No L5 security scan (gitleaks / osv-scanner / semgrep) despite OAuth-token handling.
- No pre-commit hook running typecheck/test locally.

## Escape-scan

`escape-scan --staged`: **REFUSE=0 CHALLENGE=0 FLAG=0** — clean.

## Freshness

audit-harness installed v0.1.0 (vendored). Hash manifest: **none** (`.harness-hash`
absent) — fresh repo, not a halt condition.

## Recommended next step

Hand off to `/implement-tests` on a fresh `feat/` branch to:
- install + configure ESLint (fix the L2 gate),
- add `@vitest/coverage-v8` + a coverage floor,
- scaffold `tests/TESTING.md` (classification + thresholds + waivers),
- (optional) add a pre-commit hook + a security scan.

Staged for review — never auto-committed, and on a feature branch (not `main`).
