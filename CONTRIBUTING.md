# Contributing to intent-mail

Thank you for your interest in contributing to **intent-mail**! This guide will help you get started.

## Getting Started

### Prerequisites

- Git + a GitHub account
- **Node.js 20+** and **npm 10+**
- An AI provider key (Anthropic / OpenAI / Groq, or local Ollama) for the AI features

### Development Setup

```bash
git clone https://github.com/jeremylongshore/intent-mail.git
cd intent-mail
npm ci             # install (husky pre-commit hook installs automatically)
npm run build      # TypeScript -> dist/
npm test           # vitest
cp .env.example .env   # then add your OAuth + AI provider credentials
```

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/jeremylongshore/intent-mail/issues) first
2. Open a [bug report](https://github.com/jeremylongshore/intent-mail/issues/new?template=bug_report.md)
3. Include reproduction steps, expected vs actual behavior, and environment details

### Suggesting Enhancements

1. Check [existing feature requests](https://github.com/jeremylongshore/intent-mail/issues?q=label%3Aenhancement)
2. Open a [feature request](https://github.com/jeremylongshore/intent-mail/issues/new?template=feature_request.md)

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Write or update tests
5. Ensure all tests pass
6. Commit with [conventional commit messages](#commit-messages)
7. Push and open a pull request

## Development Process

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation changes |

### Testing

The full gate chain (also enforced by CI and the husky pre-commit hook) must pass
before a PR is merged:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit (strict)
npm run test:cov    # vitest + coverage floor (stmts 65 / br 55 / fn 60 / ln 65)
npm run build       # tsc
```

Test policy and thresholds live in [`tests/TESTING.md`](tests/TESTING.md).

### Code Review

- All PRs require at least 1 maintainer approval
- CI must pass (lint + tests)
- Keep PRs focused — one feature or fix per PR

## Style Guides

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Examples:**
- `feat(api): add user authentication endpoint`
- `fix(parser): handle empty input gracefully`
- `docs(readme): update installation instructions`

### Code Style

- **TypeScript strict mode** — no `any` where a real type fits; honor `noUnusedLocals`/`noImplicitReturns`.
- **ESLint** (`.eslintrc.cjs`) — run `npm run lint` (the pre-commit hook does this for you).
- Match the surrounding code's conventions; write clear, self-documenting code and comment only where logic isn't obvious.

## Community

- **Questions**: [GitHub Discussions](https://github.com/jeremylongshore/intent-mail/discussions)
- **Bugs**: [Issue Tracker](https://github.com/jeremylongshore/intent-mail/issues)
- **Email**: jeremy@intentsolutions.io

## License

By contributing, you agree that your contributions will be licensed under the
project's [Apache-2.0 License](LICENSE).

---

*Thank you for helping improve intent-mail!*
