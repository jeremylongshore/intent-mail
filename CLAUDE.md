# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install              # Install dependencies
npm run build            # TypeScript build → dist/
npm run dev              # Watch mode (tsx watch)
npm run typecheck        # TypeScript strict mode check
npm run lint             # ESLint
npm run lint:fix         # Auto-fix lint issues
npm test                 # Vitest tests (run once)
npm run test:watch       # Vitest watch mode
npm start                # Run MCP server (requires build)
```

**Run single test file:**
```bash
npx vitest run src/rules/validator.test.ts
```

**CLI commands:**
```bash
./bin/intentmail.js inbox      # TUI inbox (default)
./bin/intentmail.js compose    # Compose email (--ai for AI assist)
./bin/intentmail.js search     # Semantic search
./bin/intentmail.js config     # Configure AI provider + accounts
./bin/intentmail.js serve      # Run as MCP server
```

## Architecture Overview

IntentMail is a multi-surface email platform with three entry points:

1. **MCP Server** (`src/index.ts`) - 24 MCP tools for Claude Desktop integration
2. **CLI/TUI** (`src/cli/`) - Terminal interface using Ink (React for CLI)
3. **Discord Bot** (`src/discord/`) - Slash commands for inbox management

### Core Layers

```
┌─────────────────────────────────────────────────────────┐
│  Entry Points: MCP Server | CLI/TUI | Discord Bot       │
├─────────────────────────────────────────────────────────┤
│  MCP Tools (src/mcp/tools/)                             │
│  - 24 tools: auth, sync, search, send, rules, etc.     │
├─────────────────────────────────────────────────────────┤
│  AI Layer (src/ai/)                                     │
│  - Multi-provider: Vertex, OpenAI, Anthropic, Ollama   │
│  - Free tier: Groq, Cerebras                           │
│  - Auto router with fallback chain                     │
├─────────────────────────────────────────────────────────┤
│  Connectors (src/connectors/)                           │
│  - Gmail: OAuth + History API delta sync               │
│  - Outlook: Graph API /delta endpoint                  │
├─────────────────────────────────────────────────────────┤
│  Storage (src/storage/)                                 │
│  - SQLite + FTS5 full-text search                      │
│  - better-sqlite3 with WAL mode                        │
├─────────────────────────────────────────────────────────┤
│  Rules Engine (src/rules/)                              │
│  - Condition evaluation + action execution             │
│  - Dry-run, audit log, rollback support                │
└─────────────────────────────────────────────────────────┘
```

### Key Design Patterns

**MCP Tool Pattern** (`src/mcp/tools/*.ts`):
```typescript
export const myTool = {
  definition: {
    name: 'tool_name',
    description: 'What it does',
    inputSchema: { /* Zod-compatible JSON Schema */ }
  },
  handler: async (args: unknown) => {
    // Validate with Zod, execute, return MCP response
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
};
```

**Provider Abstraction** (`src/ai/provider.ts`):
- All AI providers implement `AIProvider` interface
- `createProvider()` factory based on user config
- Auto router (`src/ai/router.ts`) chains: Groq → Cerebras → Ollama

**Delta Sync Strategy**:
- Gmail: `historyId` tracking via History API
- Outlook: `deltaToken` via Graph API `/delta`
- Only fetches changes since last sync

**Rules Engine** (`src/rules/engine.ts`):
- Conditions evaluated with AND logic
- Actions: add/remove label, archive, trash, mark read/unread
- All executions logged to audit trail for rollback

### Directory Structure

```
src/
├── index.ts                 # MCP server entry point
├── config.ts                # Server constants, DB path
├── cli/                     # CLI entry + commands
│   ├── index.ts             # Commander CLI definition
│   ├── commands/            # inbox, compose, search, config
│   └── tui/                 # Ink-based TUI components
├── mcp/tools/               # All 24 MCP tool implementations
├── ai/                      # AI provider implementations
│   ├── provider.ts          # Interface + factory
│   ├── router.ts            # Multi-provider fallback router
│   ├── vertex.ts            # Google Vertex AI
│   ├── openai.ts            # OpenAI
│   ├── anthropic.ts         # Claude
│   ├── ollama.ts            # Local Ollama
│   ├── groq.ts              # Groq (free tier)
│   └── cerebras.ts          # Cerebras (free tier)
├── connectors/
│   ├── gmail/               # Gmail OAuth + History API
│   └── outlook/             # Outlook Graph API
├── storage/
│   ├── database.ts          # SQLite singleton
│   ├── migrations.ts        # Schema migrations
│   ├── schema.ts            # Table definitions
│   └── services/            # email, account, rule, audit storage
├── rules/
│   ├── engine.ts            # Rule evaluation + execution
│   ├── parser.ts            # YAML rule parsing
│   └── validator.ts         # Rule validation
├── types/                   # Shared TypeScript types
├── stores/                  # Zustand state management
├── discord/                 # Discord bot + commands
└── team/                    # Shared inbox, assignments, analytics
```

## Testing MCP Tools

**With Claude Desktop** - add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "intentmail": {
      "command": "node",
      "args": ["/absolute/path/to/intent-mail/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop, then: `Use the health_check tool`

**OAuth Setup** (one-time):
1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable Gmail API
3. Copy `.env.example` to `.env`, add credentials
4. In Claude: `Use mail_auth_start with provider: gmail`

## Infrastructure

**GCP Project**: `mail-with-intent`

**Terraform** (`infra/`):
```bash
cd infra && terraform init
terraform plan           # Review
terraform apply          # Deploy
```

**CI/CD** (`.github/workflows/`):
- `ci.yml` - Lint, typecheck, test on PRs
- `deploy.yml` - Cloud Run deployment (WIF, keyless)
- `drift.yml` - Daily Terraform drift detection

## Task Tracking (Beads)

```bash
bd ready                 # Available tasks
bd list                  # All tasks
bd show <id>             # Task details
bd update <id> --status in_progress
bd close <id> --reason "Done"
bd sync                  # Sync with git (end of session)
```

## TypeScript Configuration

Strict mode enabled with all checks:
- `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`

Target: ES2022, Module: NodeNext, JSX: react-jsx (for Ink CLI)

## Testing baseline (2026-05-01 — Intent Solutions Testing SOP)

This repo participates in the **Intent Solutions Testing SOP** per `~/.claude/CLAUDE.md` § "Intent Solutions Testing SOP" and the VPS-as-the-home program (`OPS-5nm`, Priority 6).

**Installed**: `@intentsolutions/audit-harness v0.1.0` vendored at `.audit-harness/` with wrapper at `scripts/audit-harness`.

**Commands**: `scripts/audit-harness {verify, init, list, escape-scan --staged}`.

**Next step**: run `/audit-tests` to produce `TEST_AUDIT.md`. See `000-docs/259-OD-SOPS-audit-harness-baseline-2026-05-01.md`.

**Upgrade**: `AUDIT_HARNESS_VERSION=vX.Y.Z curl -sSL https://raw.githubusercontent.com/jeremylongshore/audit-harness/main/install.sh | bash`. Or run `/sync-testing-harness` from any session.
