# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This changelog was introduced at v0.4.1. Detailed history before that lives in
> the git log and the [GitHub releases](https://github.com/jeremylongshore/intent-mail/releases).

## [Unreleased]

### Added
- Governance scaffolding: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `SUPPORT.md`, this `CHANGELOG.md`, `.editorconfig`, a PR template, an issue-template
  `config.yml`, and a Dependabot config (npm + github-actions).

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

[Unreleased]: https://github.com/jeremylongshore/intent-mail/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/jeremylongshore/intent-mail/releases/tag/v0.4.1
