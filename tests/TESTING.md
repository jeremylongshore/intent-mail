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
| L1 pre-commit | ✅ enforced | husky `.husky/pre-commit` runs lint + typecheck + tests (auto-installed via the `prepare` script) |
| Escape-scan / bias / arch | ✅ available | vendored `scripts/audit-harness` (v0.1.0) |

## Frameworks

vitest 4 · @vitest/coverage-v8 · ESLint 8 + @typescript-eslint 6 · TypeScript
strict (NodeNext).

## Last audit

2026-06-23 — Grade C+ (74/100). Escape-scan clean, bias scan clean. Report
`TEST_AUDIT.md`. Lean remediation applied: ESLint config, coverage provider +
floor, this policy file, CI made blocking.

## Dependency audit (2026-06-26)

`npm audit` triaged from **22 → 5**:
- Cleared via `overrides` (no breaking direct-dep bumps): `minimatch ^9.0.9`
  (clears the whole `@typescript-eslint/*` ReDoS cluster without the v8/ESLint-9
  migration), `semver ^7.7.2`, `undici ^6.27.0`, `uuid ^11.1.1`.
- Direct bump: `nodemailer` 7 → 9. Removed unused dep `md-to-pdf` (cleared
  gray-matter / js-yaml / md-to-pdf). Declared `js-yaml` as a direct dep (it was
  imported in `rules/parser.ts` but only resolved via hoisting).
- **5 accepted residual (`fix=NONE`)**: `tar` / `cacache` / `make-fetch-happen`
  / `node-gyp` / `duckdb` — a single chain off `duckdb@1.4.4`'s bundled
  `node-gyp@9.4.1`. These are **install/build-time native-compile tooling, not
  runtime**; no patch exists until duckdb ships a newer node-gyp, and forcing one
  risks breaking the native build for ~zero real-world gain. Revisit on a duckdb
  upgrade. `gaxios` (moderate) was the one borderline case — its patch is in
  gaxios 7, which `googleapis` doesn't support, so it's left to avoid risking the
  primary Gmail client.

## L3 mutation testing (Stryker) — baseline 2026-06-28

Stryker (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`) is wired up
over the high-value pure-logic core. Run with `npm run test:mutation`
(`stryker run`). Config: `stryker.config.json` — `testRunner: vitest`,
`coverageAnalysis: perTest`, `mutate` scoped to four files so the run is fast
(~30 s) and meaningful:

- `src/rules/engine.ts`
- `src/connectors/shared/retry.ts`
- `src/storage/token-crypto.ts`
- `src/ai/daily-digest.ts`

**Report-only for now.** Thresholds are `{ high: 80, low: 60, break: null }` —
`break: null` means Stryker reports the score but **never fails CI**. This lets
us establish a baseline and improve incrementally before making it a blocking
gate. HTML report: `reports/mutation/mutation.html` (gitignored).

**Baseline (2026-06-28):** overall mutation score **24.88%** (58.74% over
covered mutants; 157 killed / 1 timeout / 111 survived / 366 no-coverage).
Per file:

| File | Mutation score | Killed | Survived | No-cov |
|---|---|---|---|---|
| `connectors/shared/retry.ts` | 76.27% | 44 | 9 | 5 |
| `storage/token-crypto.ts` | 52.53% | 52 | 17 | 30 |
| `ai/daily-digest.ts` | 34.66% | 61 | 85 | 30 |
| `rules/engine.ts` | 0.00% | 0 | 0 | 301 |

`rules/engine.ts` drags the total down — it has no co-located unit test, so
all 301 mutants are no-coverage. Highest-leverage next step: add
`src/rules/engine.test.ts`, then flip `break` from `null` to a real floor once
each file clears `low: 60`.

## Backlog (not in the lean pass)

- **L5 security** — add a secret/dep scan in CI (gitleaks / osv-scanner /
  semgrep); warranted because OAuth tokens are handled.
- **L3 mutation — promote to a gate** — add `src/rules/engine.test.ts` to lift
  it off 0%, then set `break` to a real floor (start ~25%, ratchet up) so
  mutation score becomes a blocking check.
- **Lint debt** — tighten `no-case-declarations` / `no-var-requires` from
  warning to error after cleaning `query-to-sql.ts` and `stores/index.ts`.

## Traceability

No `RTM.md` / `PERSONAS.md` / `JOURNEYS.md` yet (no MUST/SHOULD requirements
declared). Add when formal requirements traceability is needed.
