# IntentMail: Operator-Grade System Analysis & Operations Guide

*For: DevOps Engineer*
*Generated: December 29, 2024*
*System Version: 0.3.0 (commit fb6b03e)*

---

## Table of Contents

1. Executive Summary
2. Operator & Customer Journey
3. System Architecture Overview
4. Directory Deep-Dive
5. Automation & Agent Surfaces
6. Operational Reference
7. Security, Compliance & Access
8. Cost & Performance
9. Development Workflow
10. Dependencies & Supply Chain
11. Integration with Existing Documentation
12. Current State Assessment
13. Quick Reference
14. Recommendations Roadmap

---

## 1. Executive Summary

### Business Purpose

IntentMail is an MCP (Model Context Protocol) server designed for programmatic email access via Gmail and Outlook APIs. The platform provides AI-assisted email operations including search, automation rules, and comprehensive audit logging. It serves as both a standalone CLI tool and an MCP server for integration with Claude Desktop and other AI assistants.

The core value proposition is **email automation with audit trails** - enabling AI systems to perform email operations (search, label, archive, send) with full traceability and rollback capabilities. This positions IntentMail as infrastructure for AI-powered email workflows, with particular emphasis on the "rules-as-code" paradigm.

Currently in **Alpha status**, the platform has implemented core functionality including 24 MCP tools, Gmail connector with OAuth and delta sync, rules engine with dry-run/rollback, and multi-provider AI integration (7 providers). Outlook connector OAuth testing and production deployment validation remain outstanding.

The technology foundation prioritizes simplicity and portability: SQLite for local-first storage (WAL mode for concurrency), TypeScript/Node.js 20+ runtime, and Terraform IaC for GCP deployment. The architecture separates concerns cleanly between connectors (Gmail/Outlook), storage (SQLite services), AI providers (pluggable abstraction), and MCP tools.

### Operational Status Matrix

| Environment | Status | Uptime Target | Current Uptime | Release Cadence | Active Users |
|-------------|--------|---------------|----------------|-----------------|--------------|
| Development | Active | N/A | N/A | Daily commits | 2-3 devs |
| Staging | Not deployed | 95% | N/A | Per PR merge | 0 |
| Production | Not deployed | 99.5% | N/A | Weekly | 0 |

### Technology Stack Summary

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | ^5.3.3 | Primary language |
| Runtime | Node.js | >=20.0.0 | Server runtime |
| Database | SQLite (better-sqlite3) | ^9.2.2 | Local storage, WAL mode |
| MCP SDK | @modelcontextprotocol/sdk | ^0.5.0 | Claude Desktop integration |
| Email APIs | googleapis, imapflow | ^169.0.0, ^1.2.3 | Gmail/IMAP connectivity |
| AI Providers | Vertex AI, OpenAI, Anthropic, Ollama, Groq, Cerebras | Various | Multi-provider AI |
| TUI | ink, react | ^5.1.0, ^18.3.1 | Terminal UI |
| Infrastructure | Terraform, GCP | ~>5.0 | Cloud Run deployment |

---

## 2. Operator & Customer Journey

### Primary Personas

- **Operators/DevOps**: Deploy, monitor, and maintain the MCP server infrastructure. Need to understand sync mechanics, database health, and OAuth token lifecycle.
- **Developers**: Build email automation workflows using MCP tools. Need to understand tool APIs, rule syntax, and AI provider configuration.
- **End Users (via CLI)**: Interact directly with inbox, compose emails, search. Need intuitive commands and reliable responses.
- **AI Assistants (Claude Desktop)**: Consume MCP tools programmatically. Need well-defined schemas and predictable responses.

### End-to-End Journey Map

```
Installation → Configuration → OAuth Setup → First Sync → Operations → Automation
     │              │              │              │            │           │
     └→ npm install └→ intentmail  └→ Google      └→ mail_sync └→ search   └→ rules
                       config         Console                     thread      dry-run
                                      OAuth2                       label       apply
```

**Critical Touchpoints:**

1. **OAuth Setup**: Most complex step. Requires Google Cloud Console, OAuth consent screen, redirect URI configuration.
2. **First Sync**: Initial email fetch can be slow for large mailboxes. History ID establishes delta sync baseline.
3. **Rule Execution**: Audit log entry created for every rule application. State captured before/after for rollback.

### SLA Commitments

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| MCP Tool Response | < 5s | Untested | DevOps |
| Email Sync (delta) | < 30s | Untested | DevOps |
| Rule Execution | < 2s per email | Untested | DevOps |
| AI Provider Fallback | < 10s | Implemented | DevOps |

---

## 3. System Architecture Overview

### Technology Stack (Detailed)

| Layer | Technology | Version | Source of Truth | Purpose | Owner |
|-------|------------|---------|-----------------|---------|-------|
| Frontend/CLI | ink, react, commander | ^5.1.0, ^18.3.1, ^12.1.0 | package.json | TUI and CLI commands | Dev |
| Backend/MCP | @modelcontextprotocol/sdk | ^0.5.0 | package.json | Tool registration, stdio transport | Dev |
| Database | better-sqlite3 | ^9.2.2 | package.json | Local SQLite with WAL | Dev |
| Search | SQLite FTS5 | Built-in | schema.ts | Full-text search on emails | Dev |
| Email Connectors | googleapis, imapflow | ^169.0.0, ^1.2.3 | package.json | Gmail API, IMAP/SMTP | Dev |
| AI Abstraction | Vertex AI, OpenAI, Anthropic, Ollama, Groq, Cerebras | Various | package.json | Multi-provider AI operations | Dev |
| Infrastructure | Terraform, Google Provider | >=1.6.0, ~>5.0 | infra/main.tf | GCP Cloud Run deployment | DevOps |
| CI/CD | GitHub Actions | N/A | .github/workflows/ | Build, test, deploy | DevOps |
| Auth | OAuth 2.0, Workload Identity | N/A | GCP Console | Gmail/Outlook, keyless CI/CD | DevOps |

### Environment Matrix

| Environment | Purpose | Hosting | Data Source | Release Cadence | IaC Source | Notes |
|-------------|---------|---------|-------------|-----------------|------------|-------|
| local | Development | localhost | data/intentmail.db | Continuous | N/A | Default for development |
| staging | Pre-production testing | Cloud Run | Ephemeral | Per PR | infra/ | Not yet provisioned |
| prod | Production | Cloud Run | Persistent volume | Weekly | infra/ | Not yet provisioned |

### Cloud & Platform Services

| Service | Purpose | Environment(s) | Key Config | Cost Estimate | Owner | Vendor Risk |
|---------|---------|----------------|------------|---------------|-------|-------------|
| Cloud Run | MCP Server hosting | staging, prod | 2 vCPU, 2GB RAM | ~$20/mo | DevOps | Low (GCP) |
| Artifact Registry | Docker images | all | intentmail repo | ~$1/mo | DevOps | Low |
| Secret Manager | OAuth tokens (future) | prod | API keys | ~$0.03/secret | DevOps | Low |
| Gmail API | Email operations | all | OAuth 2.0 scopes | Free (quota-based) | DevOps | Medium |
| Vertex AI | AI provider | all | gemini-1.5-flash | ~$0.002/1K tokens | Dev | Medium |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAUDE DESKTOP                                  │
│                          (MCP Client - stdio)                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ MCP Protocol
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTENTMAIL MCP SERVER                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        24 MCP TOOLS                                    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │    AUTH     │ │   EMAIL     │ │   RULES     │ │      AI         │  │  │
│  │  │ mail_auth_* │ │ mail_search │ │ mail_*_rule │ │ mail_summarize  │  │  │
│  │  │ mail_list_* │ │ mail_sync   │ │ mail_apply_ │ │ mail_draft      │  │  │
│  │  │             │ │ mail_send   │ │ mail_audit  │ │ mail_triage     │  │  │
│  │  │             │ │ mail_thread │ │ mail_rollbk │ │ mail_semantic_* │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                           │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                         CORE SERVICES                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │  │
│  │  │   STORAGE    │  │ RULES ENGINE │  │ AI PROVIDERS │                 │  │
│  │  │   (SQLite)   │  │ (Condition/  │  │ (7 providers │                 │  │
│  │  │   - emails   │  │  Action)     │  │  + router)   │                 │  │
│  │  │   - accounts │  │ - dry-run    │  │ - Vertex AI  │                 │  │
│  │  │   - rules    │  │ - rollback   │  │ - OpenAI     │                 │  │
│  │  │   - audit    │  │ - audit log  │  │ - Anthropic  │                 │  │
│  │  │   - FTS5     │  │              │  │ - Ollama     │                 │  │
│  │  └──────────────┘  └──────────────┘  │ - Groq       │                 │  │
│  │         │                │           │ - Cerebras   │                 │  │
│  │         │                │           └──────────────┘                 │  │
│  └─────────┼────────────────┼────────────────────────────────────────────┘  │
│            │                │                                                │
└────────────┼────────────────┼────────────────────────────────────────────────┘
             │                │
             ▼                ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐
│   data/intentmail   │  │     GMAIL API       │  │    AI PROVIDER APIs     │
│       .db           │  │  (OAuth 2.0)        │  │  (API Keys/GCP Auth)    │
│   SQLite WAL mode   │  │  History API        │  │                         │
│   FTS5 indexes      │  │  Delta sync         │  │  Groq (free tier)       │
└─────────────────────┘  └─────────────────────┘  │  Cerebras (free tier)   │
                                                  │  Ollama (local)         │
                                                  └─────────────────────────┘
```

---

## 4. Directory Deep-Dive

### Project Structure Analysis

```
intent-mail/
├── .github/
│   └── workflows/           # CI/CD pipelines (6 workflows)
│       ├── ci.yml           # Lint, typecheck, test, build
│       ├── deploy.yml       # Cloud Run deployment
│       ├── release.yml      # Version tagging
│       ├── drift.yml        # Terraform drift detection
│       ├── ai-review-vertex.yml  # AI-powered PR review
│       └── renovate.yml     # Dependency updates
├── bin/
│   └── intentmail.js        # CLI entry point
├── completed-docs/          # Filed documentation archive
├── data/                    # SQLite database (gitignored)
├── infra/                   # Terraform IaC
│   ├── main.tf              # Core infrastructure
│   ├── backend.tf           # State configuration
│   ├── variables.tf         # Input variables
│   └── outputs.tf           # Output values
├── src/
│   ├── index.ts             # MCP server entry (24 tools registered)
│   ├── config.ts            # Server config, DB path
│   ├── ai/                  # Pluggable AI provider layer (10 files)
│   │   ├── provider.ts      # AIProvider interface + factory
│   │   ├── router.ts        # MultiProviderRouter (auto fallback)
│   │   ├── vertex.ts        # Google Vertex AI (Gemini)
│   │   ├── openai.ts        # OpenAI
│   │   ├── anthropic.ts     # Anthropic Claude
│   │   ├── ollama.ts        # Ollama (local)
│   │   ├── groq.ts          # Groq (free tier)
│   │   ├── cerebras.ts      # Cerebras (free tier)
│   │   └── noop.ts          # Fallback provider
│   ├── cli/                 # CLI with TUI (6 files)
│   │   ├── index.ts         # Commander setup
│   │   └── commands/        # inbox, compose, search, config
│   ├── connectors/          # Email provider connectors
│   │   ├── gmail/           # OAuth, sync, client (6 files)
│   │   └── outlook/         # Graph API connector (4 files)
│   ├── mcp/tools/           # 24 MCP tools
│   │   ├── health.ts        # Health check
│   │   ├── mail-auth-*.ts   # OAuth flow tools (3)
│   │   ├── mail-sync*.ts    # Sync tools (2)
│   │   ├── mail-search.ts   # Email search
│   │   ├── mail-*-rule.ts   # Rules tools (4)
│   │   ├── mail-*-label.ts  # Label tools (2)
│   │   ├── mail-*.ts        # AI tools (5)
│   │   └── ...              # Other tools
│   ├── rules/               # Rules engine (4 files)
│   │   ├── engine.ts        # Condition evaluation, action application
│   │   ├── parser.ts        # YAML rule parsing
│   │   └── validator.ts     # Rule validation
│   ├── storage/             # SQLite layer (10+ files)
│   │   ├── database.ts      # Connection singleton, WAL mode
│   │   ├── schema.ts        # Table definitions, FTS5
│   │   ├── migrations.ts    # Migration runner
│   │   └── services/        # account, email, rule, audit-log
│   └── types/               # TypeScript interfaces (5 files)
├── 000-docs/                # Doc-filing v4.2 (34 documents)
├── 000-docs-personal/       # Private reference (gitignored)
├── CLAUDE.md                # Claude Code instructions
├── README.md                # Project overview
├── package.json             # Dependencies (v0.3.0)
├── tsconfig.json            # TypeScript config
└── vitest.config.ts         # Test configuration
```

### Detailed Directory Analysis

#### src/index.ts (MCP Server Entry)

**Purpose**: Main entry point registering 24 MCP tools and initializing database

**Key Components**:
- Imports all 24 tool definitions from `src/mcp/tools/`
- Initializes database with migrations (`initDatabase()`, `runMigrations()`)
- Creates MCP Server with `StdioServerTransport`
- Graceful shutdown handlers (SIGINT, SIGTERM)

**Tool Registry** (line 56-81):
```typescript
const allTools = [
  healthTool, mailAuthStartTool, mailAuthCompleteTool, mailListAccountsTool,
  mailSyncTool, mailSyncStatsTool, mailSearchTool, mailGetThreadTool,
  mailListLabelsTool, mailApplyLabelTool, mailSendTool, mailListAttachmentsTool,
  mailGetAttachmentTool, mailListRulesTool, mailCreateRuleTool, mailDeleteRuleTool,
  mailApplyRuleTool, mailGetAuditLogTool, mailRollbackTool, mailSummarizeTool,
  mailDraftTool, mailSemanticSearchTool, mailTriageTool, mailComposeSuggestTool,
];
```

#### src/ai/provider.ts (AI Provider Abstraction)

**Purpose**: Pluggable AI provider interface with factory pattern

**Key Interfaces**:
- `AIProvider`: Core interface with `generateDraft()`, `summarize()`, `search()`, `suggestReply()`
- `ProviderType`: 7 types + 'none' + 'auto'
- `createProvider()`: Factory function with fallback to NoOpProvider

**Provider Priority** (auto mode):
1. Groq (14,400 req/day free, fastest)
2. Cerebras (1M tokens/day free)
3. Ollama (unlimited local)

#### src/storage/schema.ts (Database Schema)

**Purpose**: SQLite schema definitions with FTS5 full-text search

**Tables** (6):
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| migrations | Schema versioning | version, name, checksum |
| accounts | OAuth credentials | provider, email, tokens, history_id |
| emails | Email storage | from/to/subject/body, thread_id, labels, flags |
| attachments | Attachment metadata | filename, mime_type, provider_attachment_id |
| rules | Automation rules | conditions (JSON), actions (JSON), trigger |
| audit_log | Rule execution history | state_before, state_after, rolled_back |

**Indexes**: 14 indexes for common query patterns (account_date, thread_id, from_address, etc.)

**FTS5 Configuration**: Porter stemmer + unicode61 tokenizer for international search

#### src/rules/engine.ts (Rules Engine)

**Purpose**: Evaluate rule conditions and apply actions with audit trail

**Condition Fields**: FROM, TO, CC, SUBJECT, BODY, LABEL, HAS_ATTACHMENT, THREAD_SIZE, DATE

**Operators**: EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, MATCHES_REGEX, GREATER_THAN, LESS_THAN, IN, NOT_IN

**Action Types**: ADD_LABEL, REMOVE_LABEL, MARK_READ, MARK_UNREAD, ARCHIVE, MOVE_TO_TRASH, DELETE, FORWARD

**Key Functions**:
- `evaluateCondition()`: Single condition check
- `evaluateConditions()`: AND logic across all conditions
- `applyAction()`: Execute action with dry-run support
- `executeRule()`: Full execution with audit log entry

#### src/connectors/gmail/client.ts (Gmail API Client)

**Purpose**: Wrapper around googleapis for Gmail operations

**Methods**:
- `getUserProfile()`: Get authenticated user info
- `getMessage()`: Fetch single message (FULL/METADATA/MINIMAL format)
- `listMessages()`: Query-based message listing with pagination
- `listHistory()`: Delta sync via History API
- `batchGetMessages()`: Parallel fetch (chunks of 100)
- `modifyMessageLabels()`: Add/remove labels
- `sendMessage()`: Send RFC 2822 encoded message
- `getAttachment()`: Fetch attachment data
- `watch()/stopWatch()`: Push notification setup (Pub/Sub)

#### infra/main.tf (Terraform Infrastructure)

**Purpose**: GCP infrastructure provisioning

**Resources**:
- `google_project_service.apis`: Enable 10 GCP APIs (Run, Artifact Registry, IAM, Secret Manager, Gmail)
- `google_artifact_registry_repository`: Docker image storage
- `google_service_account.deployer`: Deployment service account
- `google_iam_workload_identity_pool`: GitHub Actions OIDC
- `google_iam_workload_identity_pool_provider`: GitHub OIDC provider
- `google_service_account_iam_member.github_wif`: Bind repo to SA

**Security**:
- Least privilege IAM (run.developer instead of run.admin)
- Workload Identity Federation for keyless CI/CD
- Repository owner restriction: `intent-solutions-io`

---

## 5. Automation & Agent Surfaces

### MCP Tools (24 total)

| Category | Tool | Purpose | Auth Required |
|----------|------|---------|---------------|
| **Health** | health_check | System status | No |
| **Auth** | mail_auth_start | Initiate OAuth flow | No |
| **Auth** | mail_auth_complete | Complete OAuth | No |
| **Auth** | mail_list_accounts | List connected accounts | No |
| **Sync** | mail_sync | Delta sync emails | Yes |
| **Sync** | mail_sync_stats | Sync metrics | Yes |
| **Email** | mail_search | Search emails | Yes |
| **Email** | mail_get_thread | Fetch thread | Yes |
| **Email** | mail_send | Send email | Yes |
| **Labels** | mail_list_labels | List labels | Yes |
| **Labels** | mail_apply_label | Apply/remove labels | Yes |
| **Attachments** | mail_list_attachments | List attachments | Yes |
| **Attachments** | mail_get_attachment | Download attachment | Yes |
| **Rules** | mail_list_rules | List automation rules | Yes |
| **Rules** | mail_create_rule | Create new rule | Yes |
| **Rules** | mail_delete_rule | Delete rule | Yes |
| **Rules** | mail_apply_rule | Execute rule (dry-run) | Yes |
| **Audit** | mail_get_audit_log | View rule history | Yes |
| **Audit** | mail_rollback | Rollback rule action | Yes |
| **AI** | mail_summarize | Summarize emails | Yes |
| **AI** | mail_draft | Generate email draft | Yes |
| **AI** | mail_semantic_search | NLP-based search | Yes |
| **AI** | mail_triage | Priority classification | Yes |
| **AI** | mail_compose_suggest | Real-time suggestions | Yes |

### CLI Commands

| Command | Purpose | Options |
|---------|---------|---------|
| `intentmail` (default) | Open inbox TUI | - |
| `intentmail compose` | Compose email | `--ai` for AI draft |
| `intentmail search <query>` | Semantic search | - |
| `intentmail config` | Configure settings | AI provider, accounts |
| `intentmail serve` | Run MCP server | - |

### GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| ci.yml | PR, push to main | Lint, typecheck, test, build |
| deploy.yml | push to main, manual | Build Docker, deploy Cloud Run |
| release.yml | manual | Create version tag |
| drift.yml | scheduled | Terraform drift detection |
| ai-review-vertex.yml | PR | AI-powered code review |
| renovate.yml | scheduled | Dependency updates |

---

## 6. Operational Reference

### Deployment Workflows

#### Local Development

**Prerequisites**:
```bash
node --version  # v20 or higher
npm --version   # v10 or higher
```

**Environment Setup**:
```bash
git clone https://github.com/intent-solutions-io/intent-mail.git
cd intent-mail
npm install
cp .env.example .env
# Edit .env with Gmail OAuth credentials
```

**Service Startup**:
```bash
npm run dev           # Development with hot reload (tsx watch)
# OR
npm run build && npm start  # Production mode
```

**Verification**:
```bash
npm run typecheck     # TypeScript validation
npm run lint          # ESLint
npm test              # Vitest
```

#### Staging/Production Deployment

**Pre-deployment Checklist**:
- [ ] CI pipeline green (lint, typecheck, test, build)
- [ ] Dockerfile exists (currently missing - blocks deploy)
- [ ] OAuth tokens rotated if needed
- [ ] Terraform state synced

**Deployment Steps**:
1. Push to main branch (auto-triggers deploy.yml)
2. GitHub Actions authenticates via Workload Identity
3. Docker image built and pushed to Artifact Registry
4. Cloud Run service updated

**Rollback Protocol**:
```bash
# Via gcloud
gcloud run services update intentmail-mcp-server \
  --image=us-central1-docker.pkg.dev/mail-with-intent/intentmail/intentmail-mcp-server:<previous-sha> \
  --region=us-central1
```

### Monitoring & Alerting

**Current State**: Not implemented

**Recommended Setup**:
- Cloud Monitoring for Cloud Run metrics
- Error Reporting for exception tracking
- Custom metrics for MCP tool latencies
- Alerts: > 5% error rate, > 5s P95 latency

### Incident Response

| Severity | Definition | Response Time | Actions |
|----------|------------|---------------|---------|
| P0 | MCP server unreachable | Immediate | Check Cloud Run, OAuth tokens |
| P1 | Gmail sync failures | 15 min | Check History API, token refresh |
| P2 | AI provider errors | 1 hour | Check provider status, try fallback |
| P3 | Minor bugs | Next business day | Document, create issue |

### Backup & Recovery

**Database**: SQLite at `data/intentmail.db`
- WAL mode provides crash recovery
- Backup: Copy .db and .db-wal files
- No automated backup currently (local-first design)

**OAuth Tokens**: Stored in SQLite `accounts` table
- Access tokens expire (1 hour)
- Refresh tokens persist
- Token rotation: Re-run OAuth flow if refresh fails

---

## 7. Security, Compliance & Access

### Identity & Access Management

| Account/Role | Purpose | Permissions | MFA | Used By |
|--------------|---------|-------------|-----|---------|
| intentmail-deployer (SA) | CI/CD deployment | run.developer, artifactregistry.writer | N/A | GitHub Actions |
| GitHub Actions OIDC | Keyless auth | workloadIdentityUser | N/A | CI/CD |
| Gmail OAuth | User email access | gmail.readonly, gmail.modify, gmail.send | User-dependent | End users |

### Secrets Management

| Secret | Location | Rotation | Purpose |
|--------|----------|----------|---------|
| GMAIL_CLIENT_ID | .env / Secrets Manager | Annual | OAuth app identity |
| GMAIL_CLIENT_SECRET | .env / Secrets Manager | Annual | OAuth app secret |
| OAuth access_token | SQLite accounts table | Hourly (auto) | Gmail API calls |
| OAuth refresh_token | SQLite accounts table | Long-lived | Token refresh |
| AI API keys | keytar / conf | Manual | OpenAI, Anthropic, Groq, Cerebras |

**Security Concerns**:
- OAuth tokens stored in plaintext SQLite (Phase 1 design)
- Recommended: Encrypt at rest or use Secret Manager for production

### Security Posture

**Authentication**:
- Gmail: OAuth 2.0 with PKCE (future)
- Outlook: Microsoft Graph OAuth (not yet tested)
- CI/CD: Workload Identity Federation (keyless)

**Authorization**:
- Gmail scopes: `gmail.readonly`, `gmail.modify`, `gmail.send`
- Cloud Run: Currently `--allow-unauthenticated` (needs review)

**Encryption**:
- In-transit: HTTPS (Gmail API, Cloud Run)
- At-rest: None currently (SQLite plaintext)

**Known Vulnerabilities**:
- OAuth tokens in plaintext database
- Cloud Run allows unauthenticated access
- No rate limiting on MCP tools

---

## 8. Cost & Performance

### Current Costs

**Development Phase**: ~$0/month (local only)

**Projected Production**:
| Service | Est. Monthly Cost | Notes |
|---------|-------------------|-------|
| Cloud Run | $20-50 | 2 vCPU, 2GB RAM, medium traffic |
| Artifact Registry | $1-5 | Docker image storage |
| Secret Manager | $0.06 | 2 secrets |
| Gmail API | $0 | Free quota (1B units/day) |
| Vertex AI | $5-20 | Depends on usage |
| **Total** | **$26-75** | |

### Performance Baseline

**Untested** - Production metrics needed

**Target Metrics**:
| Metric | Target |
|--------|--------|
| MCP tool P50 latency | < 500ms |
| MCP tool P95 latency | < 2s |
| Gmail sync (100 emails) | < 10s |
| AI summarize (10 emails) | < 5s |
| Error rate | < 1% |

### Optimization Opportunities

1. **Connection pooling**: SQLite better-sqlite3 is synchronous; consider connection pool for concurrent requests
2. **Batch operations**: Gmail batch API for bulk operations
3. **Caching**: Cache frequently accessed labels, account info
4. **AI provider selection**: Use Groq/Cerebras (free) for cost optimization

---

## 9. Development Workflow

### Local Development

**Standard Environment**:
- Node.js 20+
- npm 10+
- VSCode/Cursor with TypeScript extension
- Claude Code CLI

**Bootstrap**:
```bash
npm install
npm run dev  # tsx watch mode with hot reload
```

**Common Tasks**:
```bash
# Add new MCP tool
1. Create src/mcp/tools/mail-<name>.ts
2. Define Zod input schema
3. Implement handler
4. Import and add to allTools array in src/index.ts

# Add new AI provider
1. Create src/ai/<provider>.ts implementing AIProvider
2. Export from src/ai/index.ts
3. Add case in createProvider() factory
4. Add to CLI config command
```

### CI/CD Pipeline

**Platform**: GitHub Actions

**Triggers**:
- PR to main: ci.yml (lint, typecheck, test, build)
- Push to main: ci.yml + deploy.yml
- Manual: release.yml

**Stages**:
```
lint → typecheck → test → build → (deploy)
```

**Notes**:
- All steps have `continue-on-error: true` (planning phase)
- Dockerfile required for deploy.yml to execute

### Code Quality

**Linting**: ESLint with TypeScript rules
```bash
npm run lint      # Check
npm run lint:fix  # Auto-fix
```

**Type Checking**: TypeScript strict mode
```bash
npm run typecheck
```

**Testing**: Vitest
```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

**Coverage**: Not configured yet

---

## 10. Dependencies & Supply Chain

### Direct Dependencies (Key)

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| @modelcontextprotocol/sdk | ^0.5.0 | MCP protocol | Low (Anthropic) |
| better-sqlite3 | ^9.2.2 | SQLite binding | Low (mature) |
| googleapis | ^169.0.0 | Gmail API | Low (Google) |
| @google-cloud/vertexai | ^1.9.0 | Vertex AI | Low (Google) |
| @anthropic-ai/sdk | ^0.32.1 | Claude API | Low (Anthropic) |
| openai | ^4.77.0 | OpenAI API | Low (OpenAI) |
| ink | ^5.1.0 | Terminal UI | Medium (React) |
| zod | ^3.22.4 | Schema validation | Low (popular) |
| keytar | ^7.9.0 | Secure credential storage | Medium (native) |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.3 | TypeScript compiler |
| vitest | ^1.1.1 | Test framework |
| eslint | ^8.56.0 | Linting |
| tsx | ^4.7.0 | TypeScript execution |
| @playwright/test | ^1.57.0 | E2E testing |

### Third-Party Services

| Service | Purpose | Data Shared | SLA | Risk |
|---------|---------|-------------|-----|------|
| Gmail API | Email access | User emails | 99.9% | User data exposure |
| Vertex AI | AI operations | Email content | 99.9% | Data processing |
| OpenAI | AI operations | Email content | 99.9% | Data processing |
| Anthropic | AI operations | Email content | 99.9% | Data processing |

---

## 11. Integration with Existing Documentation

### Documentation Inventory

| Document | Status | Last Updated | Notes |
|----------|--------|--------------|-------|
| README.md | Current | Dec 2024 | Quick start, tool list |
| CLAUDE.md | Current | Dec 2024 | Claude Code instructions |
| 000-docs/ | 34 files | Dec 2024 | Doc-filing v4.2 compliant |
| 032-DR-GUID-contributing.md | Current | Dec 27 | Contribution guidelines |
| 033-DR-GUID-setup.md | Current | Dec 27 | Setup instructions |

### Key Documents for DevOps

1. **033-DR-GUID-setup.md** - Detailed setup instructions
2. **003-OD-DEPL-docker-deployment.md** - Docker deployment guide
3. **026-DR-GUID-multi-provider-setup.md** - AI provider configuration
4. **CLAUDE.md** - Beads workflow, build commands

### Discrepancies

| Document | Claim | Reality |
|----------|-------|---------|
| README.md | 19 MCP tools | 24 tools implemented |
| README.md | Alpha status | Correct, needs integration tests |

---

## 12. Current State Assessment

### What's Working Well

- **MCP Tool Architecture**: Clean separation, Zod validation, consistent patterns
- **AI Provider Abstraction**: 7 providers with auto-fallback router
- **Rules Engine**: Full audit trail, dry-run, rollback capability
- **SQLite Storage**: WAL mode, FTS5 search, proper migrations
- **Gmail Connector**: OAuth flow, History API delta sync
- **Infrastructure as Code**: Terraform with WIF for keyless CI/CD
- **Documentation**: 34 docs following filing standard

### Areas Needing Attention

- **Production Readiness**: No Dockerfile, Cloud Run not provisioned
- **Testing**: Only 2 test files found (parser.test.ts, validator.test.ts)
- **Monitoring**: No observability setup
- **Security**: OAuth tokens in plaintext, unauthenticated Cloud Run
- **Outlook Connector**: Not tested with real credentials
- **Error Handling**: Inconsistent across tools

### Immediate Priorities

| Priority | Issue | Impact | Action | Owner |
|----------|-------|--------|--------|-------|
| **P1** | No Dockerfile | Blocks deployment | Create multi-stage Dockerfile | DevOps |
| **P1** | Missing tests | Reliability risk | Add unit/integration tests | Dev |
| **P2** | OAuth token security | Data exposure | Implement encryption or Secret Manager | DevOps |
| **P2** | No monitoring | Blind operations | Set up Cloud Monitoring | DevOps |
| **P3** | README tool count | Documentation drift | Update to 24 tools | Dev |

---

## 13. Quick Reference

### Operational Command Map

| Capability | Command | Source | Notes |
|------------|---------|--------|-------|
| Local dev | `npm run dev` | package.json | tsx watch mode |
| Build | `npm run build` | package.json | TypeScript compile |
| Start server | `npm start` | package.json | Node.js production |
| Type check | `npm run typecheck` | package.json | No emit |
| Lint | `npm run lint` | package.json | ESLint |
| Test | `npm test` | package.json | Vitest |
| CLI inbox | `intentmail` | bin/intentmail.js | TUI |
| CLI config | `intentmail config` | bin/intentmail.js | Setup wizard |
| MCP serve | `intentmail serve` | bin/intentmail.js | For Claude Desktop |
| Terraform plan | `cd infra && terraform plan` | infra/ | Review changes |
| Terraform apply | `cd infra && terraform apply` | infra/ | Apply changes |

### Critical Endpoints & Resources

| Resource | URL/Path | Purpose |
|----------|----------|---------|
| GitHub Repo | github.com/intent-solutions-io/intent-mail | Source code |
| GCP Project | mail-with-intent | Cloud resources |
| Artifact Registry | us-central1-docker.pkg.dev/mail-with-intent/intentmail | Docker images |
| Gmail OAuth | console.cloud.google.com/apis/credentials | OAuth management |
| Cloud Run (future) | intentmail-mcp-server.us-central1.run.app | Production service |

### First-Week Checklist

- [ ] Clone repository and run `npm install`
- [ ] Set up Gmail OAuth credentials in Google Cloud Console
- [ ] Configure `.env` with OAuth credentials
- [ ] Run `npm run dev` and verify server starts
- [ ] Run `npm run typecheck` and `npm run lint`
- [ ] Read CLAUDE.md for beads workflow
- [ ] Run `bd sync` to check task status
- [ ] Review 000-docs/ documentation
- [ ] Understand MCP tool patterns in src/mcp/tools/
- [ ] Test OAuth flow with `intentmail config`

---

## 14. Recommendations Roadmap

### Week 1 - Critical Setup & Stabilization

**Goals**:
1. Create Dockerfile for Cloud Run deployment
2. Add unit tests for critical paths (OAuth, sync, rules engine)
3. Fix README tool count (19 → 24)
4. Document OAuth token storage security decision

**Deliverables**:
- [ ] Dockerfile (multi-stage, Node.js 20 Alpine)
- [ ] 10+ unit tests (>50% coverage on rules engine)
- [ ] Updated README.md
- [ ] Security decision document

### Month 1 - Foundation & Visibility

**Goals**:
1. Deploy to staging environment
2. Set up Cloud Monitoring and Error Reporting
3. Add integration tests with Gmail API mocks
4. Implement OAuth token encryption

**Deliverables**:
- [ ] Staging Cloud Run service
- [ ] Monitoring dashboard
- [ ] 30+ tests (>70% coverage)
- [ ] Encrypted token storage

### Quarter 1 - Strategic Enhancements

**Goals**:
1. Production deployment with load testing
2. Complete Outlook connector testing
3. Add rate limiting and abuse protection
4. Performance optimization (caching, batching)

**Deliverables**:
- [ ] Production Cloud Run with autoscaling
- [ ] Outlook OAuth flow working
- [ ] Rate limiting middleware
- [ ] P95 latency < 2s for all tools

---

## Appendices

### Appendix A. Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol - Anthropic's standard for AI tool integration |
| WIF | Workload Identity Federation - Keyless authentication for CI/CD |
| FTS5 | Full-Text Search 5 - SQLite's full-text search extension |
| WAL | Write-Ahead Logging - SQLite concurrency mode |
| History API | Gmail's incremental sync mechanism |
| Delta sync | Only fetching changes since last sync |

### Appendix B. Reference Links

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

### Appendix C. Troubleshooting Playbooks

**OAuth Token Expired**:
```
Error: invalid_grant
Solution:
1. Run `intentmail config`
2. Re-authenticate with Google
3. Check OAuth consent screen status (may need to re-add test users)
```

**Database Locked**:
```
Error: SQLITE_BUSY
Solution:
1. Close other processes using the database
2. Check for zombie processes: `lsof data/intentmail.db`
3. WAL mode should prevent most locks
```

**Gmail Sync Fails**:
```
Error: historyId not found
Solution:
1. History ID may have expired (> 1 week)
2. Run full sync: delete sync state, re-sync
3. Check Gmail API quota in Cloud Console
```

### Appendix D. Open Questions

1. Should Cloud Run service require authentication?
2. What's the token rotation strategy for production?
3. How should we handle Gmail push notifications (Pub/Sub)?
4. What's the data retention policy for audit_log?
5. Should we support multi-user scenarios?

---

*Generated by IntentMail DevOps Audit System*
*Document: 035-AA-AUDT-appaudit-devops-playbook.md*
*Classification: Internal Use*
