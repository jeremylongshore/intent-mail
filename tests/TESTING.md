# tests/TESTING.md — intent-mail testing policy

Engineer-owned policy for the Intent Solutions testing SOP. Deterministic gates
read their floors from here. Established 2026-06-23 via `/audit-tests` →
`/implement-tests` (lean scope).

## Classification

Multi-surface Node/TypeScript project (UNION):

- **service** — the MCP server (`src/index.ts`, stdio) — primary
- **cli** — Commander + Ink TUI (`src/cli`)
- **frontend** — React/PWA dashboard (`src/web`)
- **library** — connectors, AI, rules, storage

Test framework: **vitest 4**. Tests are co-located as `src/**/*.test.ts`.

## Thresholds

Coverage floor (enforced by `npm run test:cov` via `vitest.config.ts`), pinned
just below the 2026-06-23 baseline. **Ratchet up, never down without sign-off.**

| Metric | Floor | Baseline (2026-06-23) |
|---|---|---|
| Statements | 65% | 69.0% |
| Branches | 55% | 59.4% |
| Functions | 60% | 68.9% |
| Lines | 65% | 69.1% |

Coverage is measured over the code the suite exercises (vitest default). The
frontend (`src/web`) and test/type/entrypoint files are excluded.

## Waived layers

- **L5 system** (perf / a11y / chaos) — waived: local-first single-user MCP, no
  hosted surface. (Security scan is *not* waived — see Backlog.)
- **L7 UAT** — waived: no formal business-acceptance stage.

## Installed gates

| Gate | Status | How |
|---|---|---|
| L1 CI | ✅ enforced | `.github/workflows/ci.yml` runs lint + typecheck + test:cov as required (blocking) steps on PRs |
| L2 types | ✅ enforced | `npm run typecheck` (tsc strict) |
| L2 lint | ✅ enforced | `npm run lint` (ESLint 8 + @typescript-eslint, `.eslintrc.cjs`) |
| L3 unit | ✅ enforced | `npm test` (vitest, 192 tests) |
| L3 coverage | ✅ enforced | `npm run test:cov` with the floor above |
| Escape-scan / bias / arch | ✅ available | vendored `scripts/audit-harness` (v0.1.0) |

## Frameworks

vitest 4 · @vitest/coverage-v8 · ESLint 8 + @typescript-eslint 6 · TypeScript
strict (NodeNext).

## Last audit

2026-06-23 — Grade C+ (74/100). Escape-scan clean, bias scan clean. Report
`TEST_AUDIT.md`. Lean remediation applied: ESLint config, coverage provider +
floor, this policy file, CI made blocking.

## Backlog (not in the lean pass)

- **L5 security** — add a secret/dep scan (gitleaks / osv-scanner / semgrep);
  warranted because OAuth tokens are handled.
- **L3 mutation** — Stryker over the high-value core (rules engine, retry,
  token-crypto, daily-digest).
- **L1 hooks** — a pre-commit hook running typecheck + test locally.
- **Lint debt** — tighten `no-case-declarations` / `no-var-requires` from
  warning to error after cleaning `query-to-sql.ts` and `stores/index.ts`.

## Traceability

No `RTM.md` / `PERSONAS.md` / `JOURNEYS.md` yet (no MUST/SHOULD requirements
declared). Add when formal requirements traceability is needed.
