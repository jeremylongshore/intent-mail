# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This changelog was introduced at v0.4.1. Detailed history before that lives in
> the git log and the [GitHub releases](https://github.com/jeremylongshore/intent-mail/releases).

## [Unreleased]

## [0.5.0] - 2026-06-30

### Added
- **Multi-account sync orchestration** — bounded-concurrency rate limiting and
  active-account prioritization (the most recently active mailboxes sync first).
- **L5 security CI** (`security.yml`) — gitleaks secret scan + OSV dependency scan.
- **L3 mutation testing** — Stryker over the pure-logic core (report-only baseline).
- **Rules-engine end-to-end test suite** against a real temp SQLite DB.
- **Gated provider integration harness** — real Gmail/Outlook round-trips when
  integration creds are present, skipped cleanly in CI otherwise.
- `build:web` is now gated in CI so the web bundle can't silently regress.
- Governance scaffolding: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `SUPPORT.md`, this `CHANGELOG.md`, `.editorconfig`, a PR template, an
  issue-template `config.yml`, and a Dependabot config (npm + github-actions).

### Changed
- **Migrate to React 19 + Ink 7** across the Ink TUI and the web app.
- **Modernize dependencies** — better-sqlite3 12, openai 6, googleapis 173,
  `@anthropic-ai/sdk`, `@inquirer/prompts` 8, `conf` 15, `dotenv` 17,
  `commander` 15, `@types/node` 26, plus the GitHub Actions used in CI.
- The web app is now the decoupled **DailyReview surface on `/api`**; the legacy
  browser-OAuth webmail views were removed.
- Promote the `no-case-declarations` and `@typescript-eslint/no-var-requires`
  lint rules from warning to **error**.

### Fixed
- **Sync daemon** now refreshes *and persists* Gmail OAuth tokens — the Gmail
  poll paths previously never wrote refreshed tokens back, so they drifted — and
  guards against overlapping poll cycles stacking up.
- The OSV dependency-scan CI check no longer reports a phantom failure on every
  PR (made report-only at the step level).

### Removed
- Dead `@anthropic-ai/claude-agent-sdk` integration (unwired code).
- Obsolete GCP deploy machinery — the Cloud Run workflow, Terraform `infra/`, and
  the orphaned `@google-cloud/secret-manager` dependency (the project is
  self-hosted).
- Dead dependencies: `marked`, `md-to-pdf`, and Playwright.

## [0.4.1]

### Added
- Outlook connector parity (Microsoft Graph): flag/move/folders/importance,
  attachment extraction, delta-poll "watch".
- OAuth tokens encrypted at rest (AES-256-GCM).
- AI daily-digest engine + `mail_daily_digest` / `mail_action` tools and a live
  daily-review artifact.
- Local web API + decoupled DailyReview surface; `@project:`/`@client:` context
  injection.
- Claude Code plugin packaging (manifest + three skills).
- Testing gates made real: ESLint, coverage floor, blocking CI, pre-commit hook.

(See the git history for the full per-PR detail.)

[Unreleased]: https://github.com/jeremylongshore/intent-mail/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/jeremylongshore/intent-mail/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/jeremylongshore/intent-mail/releases/tag/v0.4.1
