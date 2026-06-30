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

## Dependency audit (2026-06-30)

`npm audit` is at **0 critical / 0 high / 0 moderate / 0 low (0 total)**.

History — triaged from **22 → 5** (2026-06-26), then **5 → 0** (2026-06-30):
- Cleared via `overrides` (no breaking direct-dep bumps): `minimatch ^9.0.9`
  (clears the whole `@typescript-eslint/*` ReDoS cluster without the v8/ESLint-9
  migration), `semver ^7.7.2`, `undici ^6.27.0`, `uuid ^11.1.1`.
- Direct bump: `nodemailer` 7 → 9. Removed unused dep `md-to-pdf` (cleared
  gray-matter / js-yaml / md-to-pdf). Declared `js-yaml` as a direct dep (it was
  imported in `rules/parser.ts` but only resolved via hoisting).
- **2026-06-30 — the 5 prior "fix=NONE" residuals are now cleared.** The chain
  `tar` / `cacache` / `make-fetch-happen` / `node-gyp` hangs off `duckdb@1.4.4`'s
  bundled `node-gyp@9.4.1` (install/build-time native-compile tooling, not
  runtime). The `node-tar` advisories are range `<=7.5.15`; patched `tar@7.5.16+`
  now exists, so the chain is forced to patched versions via `overrides`:
  `node-gyp ^11.5.0`, `tar ^7.5.16` (resolves 7.5.19), `cacache ^20.0.4`,
  `make-fetch-happen ^15.0.6`. `cacache@20` / `make-fetch-happen@15` are pinned
  (not 21/16) so their `engines` stay `^20.17.0 || >=22.9.0` — compatible with
  the package's `engines.node >=20` and the dev box's Node 22.21.0 (no
  EBADENGINE). duckdb's native build uses `@mapbox/node-pre-gyp` prebuilds;
  node-gyp is only the compile fallback, so the bump is safe.
- Also bumped to clear the latest scan: direct devDep `esbuild` 0.27 → ^0.28.1
  (Windows dev-server arbitrary-file-read; esbuild is not imported in `src/`,
  vite keeps its own `esbuild@0.25.x`), and `overrides` `qs ^6.15.3` (DoS in
  `qs.stringify`; pulled transitively via express/typed-rest-client/googleapis).
- The scouted Dependabot critical/high set (vitest, vite, rollup, flatted,
  minimatch, @modelcontextprotocol/sdk) was **already satisfied** by the
  installed tree + the existing minimatch override; vitest is 4.x (alert range
  `<3.2.6`), mcp-sdk 1.29.0, vite 6.4.3, rollup 4.62.2, flatted 3.4.2 — those
  Dependabot alerts just need a lockfile refresh, not a bump.

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
