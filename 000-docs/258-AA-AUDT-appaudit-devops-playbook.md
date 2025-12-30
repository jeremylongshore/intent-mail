# Claude Code Plugins Hub: Operator-Grade System Analysis & Operations Guide

*For: DevOps Engineer*
*Generated: 2025-12-29*
*System Version: v4.4.0 (tag: v4.4.0, commit: 5e653ed9)*
*Repository: jeremylongshore/claude-code-plugins*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Operator & Customer Journey](#2-operator--customer-journey)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Directory Deep-Dive](#4-directory-deep-dive)
5. [Automation & Agent Surfaces](#5-automation--agent-surfaces)
6. [Operational Reference](#6-operational-reference)
7. [Security, Compliance & Access](#7-security-compliance--access)
8. [Cost & Performance](#8-cost--performance)
9. [Development Workflow](#9-development-workflow)
10. [Dependencies & Supply Chain](#10-dependencies--supply-chain)
11. [Integration with Existing Documentation](#11-integration-with-existing-documentation)
12. [Current State Assessment](#12-current-state-assessment)
13. [Quick Reference](#13-quick-reference)
14. [Recommendations Roadmap](#14-recommendations-roadmap)

---

## 1. Executive Summary

### Business Purpose

The Claude Code Plugins Hub is a comprehensive marketplace and educational platform for Anthropic's Claude Code plugin ecosystem. It serves as the definitive resource for discovering, installing, and developing Claude Code plugins - intelligent automation extensions that enhance Claude Code's capabilities in software development workflows.

The platform delivers three core value propositions:

1. **Plugin Marketplace**: A curated collection of 258 plugins across 22 categories, providing developers with ready-to-use automation for DevOps, security, AI/ML, database operations, API development, and more. The marketplace website (claudecodeplugins.io) offers search, comparison, and installation guidance for all plugins.

2. **Agent Skills Framework**: 239 production-ready Agent Skills that activate automatically based on conversation context. Unlike traditional plugins requiring explicit commands, Agent Skills detect when they're needed and seamlessly integrate into Claude Code workflows - representing the future of AI-assisted development.

3. **Learning & Education Hub**: Comprehensive documentation including 11 interactive Jupyter notebooks, a complete Learning Lab with 90+ pages of guides, and 11 Production Playbooks (~53,500 words) covering everything from rate limiting to compliance frameworks.

**Current Operational Status**: The platform is in active development with v4.4.0 as the current release. The system maintains a pnpm monorepo architecture with 7 MCP server plugins, an Astro-based website deployed to GitHub Pages, and a CLI tool published to npm as @intentsolutionsio/ccpi. The platform supports approximately 19,580 TypeScript files and generates 543 website routes.

**Technology Foundation**: The architecture emphasizes modern, maintainable tooling - pnpm workspaces for monorepo management, Astro 5.16.6 for static site generation, TypeScript for type safety, and GitHub Actions for CI/CD. The system enforces strict validation through a 6-stage pipeline covering JSON schema validation, frontmatter checking, security scanning, and more.

**Strategic Position**: As Claude Code plugins remain in public beta (launched October 2025), this platform positions Intent Solutions as a first-mover establishing best practices for the ecosystem. The platform's educational focus, quality curation, and comprehensive tooling differentiate it from other plugin repositories.

### Operational Status Matrix

| Environment | Status | Uptime Target | Current Uptime | Release Cadence | Active Routes |
|-------------|--------|---------------|----------------|-----------------|---------------|
| Production (claudecodeplugins.io) | Active | 99.9% | ~99.9% (GitHub Pages SLA) | On merge to main | 543 |
| Staging | None | N/A | N/A | N/A | N/A |
| Development | Local | N/A | N/A | Continuous | 543 |

### Technology Stack Summary

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | TypeScript | 5.5.0 | Primary development language |
| Package Manager | pnpm | 9.15.9 | Monorepo management (enforced) |
| Runtime | Node.js | >=20.0.0 | Server and build runtime |
| Website Framework | Astro | 5.16.6 | Static site generation |
| CSS Framework | Tailwind CSS | 4.1.18 | Styling |
| Search | Fuse.js | 7.1.0 | Fuzzy search on marketplace |
| Testing | Vitest | 2.0.0 / 4.0.8 | Unit and integration testing |
| E2E Testing | Playwright | 1.57.0 | Browser automation testing |
| Linting | ESLint | 9.39.2 | Code quality |
| CI/CD | GitHub Actions | N/A | 12 workflow files |
| Hosting | GitHub Pages | N/A | Static site hosting |
| MCP SDK | @modelcontextprotocol/sdk | ^1.25.1 | MCP server development |

---

## 2. Operator & Customer Journey

### Primary Personas

**Operators (Internal)**:
- DevOps engineers managing releases, CI/CD, and infrastructure
- Platform maintainers reviewing plugin submissions and quality
- Content creators producing educational materials and playbooks
- Release managers coordinating version bumps and changelog updates

**External Customers (Plugin Users)**:
- Individual developers seeking productivity automation
- Development teams standardizing workflows across projects
- Enterprise users requiring compliance-focused tooling
- Community contributors submitting plugins and improvements

**Reseller Partners**:
- Intent Solutions consultants deploying custom plugin configurations
- Technical trainers using the Learning Lab for workshops
- Integration partners embedding plugin capabilities in their tools

**Automation Bots**:
- GitHub Actions for CI/CD pipelines
- Dependabot for dependency updates
- CodeQL for security scanning
- Daily skill generator (Vertex AI Gemini)

### End-to-End Journey Map

```
Discovery → Installation → Activation → Usage → Contribution → Support
    |            |              |          |          |           |
    v            v              v          v          v           v
Website     CLI/Command    Auto-detect  Commands   Fork/PR    GitHub
Search      Install        Skills       Execute    Submit     Issues
```

**Stage 1: Discovery**
- Touchpoint: claudecodeplugins.io, GitHub repo, npm registry
- Dependencies: GitHub Pages hosting, marketplace.json catalog
- Friction: 543 routes may overwhelm; search is key
- Success Metric: Time to find relevant plugin < 30 seconds
- Engineering Impact: Search index quality, category organization

**Stage 2: Installation**
- Touchpoint: CLI (`ccpi install`), Claude built-in (`/plugin install`)
- Dependencies: npm registry for CLI, GitHub raw files for catalog
- Friction: Requires understanding marketplace slug naming
- Success Metric: Installation success rate > 99%
- Engineering Impact: Catalog sync, schema validation

**Stage 3: Activation**
- Touchpoint: Claude Code session start, skill trigger detection
- Dependencies: SKILL.md frontmatter parsing, trigger phrase recognition
- Friction: Skill activation is automatic but can be opaque
- Success Metric: Skill activation accuracy
- Engineering Impact: 2025 schema compliance, frontmatter validation

**Stage 4: Usage**
- Touchpoint: Slash commands, conversational triggers
- Dependencies: Plugin functionality, MCP server availability
- Friction: MCP servers require Node.js runtime
- Success Metric: Command success rate, user satisfaction
- Engineering Impact: MCP plugin reliability, error handling

**Stage 5: Contribution**
- Touchpoint: GitHub fork, PR submission, community discussions
- Dependencies: Validation pipeline, maintainer review
- Friction: 6-stage validation can be strict
- Success Metric: Time to merge contributor PRs < 48 hours
- Engineering Impact: CI/CD gates, contribution documentation

**Stage 6: Support**
- Touchpoint: GitHub Issues, Discussions, Discord
- Dependencies: Community engagement, maintainer response
- Friction: Beta status means evolving best practices
- Success Metric: Issue resolution time < 7 days
- Engineering Impact: Documentation quality, FAQ coverage

### SLA Commitments

| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Website Uptime | 99.9% | ~99.9% (GitHub Pages) | GitHub |
| CLI Install Success | 99% | Not measured | Intent Solutions |
| CI Pipeline Pass Rate | 95% | ~90% (estimate) | Intent Solutions |
| PR Review Time | 48 hours | Variable | Jeremy Longshore |
| Issue Response | 7 days | Variable | Community |

---

## 3. System Architecture Overview

### Technology Stack (Detailed)

| Layer | Technology | Version | Source of Truth | Purpose | Owner |
|-------|------------|---------|-----------------|---------|-------|
| Frontend/UI | Astro | 5.16.6 | marketplace/package.json | Static site generation | Intent Solutions |
| Styling | Tailwind CSS | 4.1.18 | marketplace/package.json | Utility-first CSS | Intent Solutions |
| Search | Fuse.js | 7.1.0 | marketplace/package.json | Fuzzy search client-side | Intent Solutions |
| CLI | Commander | 12.1.0 | packages/cli/package.json | CLI framework | Intent Solutions |
| HTTP | Axios | 1.7.9 | packages/cli/package.json | API requests | Intent Solutions |
| MCP | @modelcontextprotocol/sdk | ^1.25.1 | plugins/mcp/*/package.json | MCP server protocol | Anthropic |
| Validation | Zod | ^4.2.1 | plugins/mcp/*/package.json | Runtime schema validation | Intent Solutions |
| Git | simple-git | ^3.30.0 | plugins/mcp/*/package.json | Git operations | Intent Solutions |
| Testing | Vitest | 2.0.0 - 4.0.8 | various package.json | Unit testing | Intent Solutions |
| E2E Testing | Playwright | 1.57.0 | marketplace/package.json | Browser testing | Intent Solutions |
| Build | TypeScript | ^5.5.0 | root package.json | Compilation | Intent Solutions |
| Linting | ESLint | ^9.39.2 | root package.json | Code quality | Intent Solutions |
| Formatting | Prettier | ^3.7.4 | root package.json | Code formatting | Intent Solutions |

### Environment Matrix

| Environment | Purpose | Hosting | Data Source | Release Cadence | IaC Source | Notes |
|-------------|---------|---------|-------------|-----------------|------------|-------|
| local | Development | localhost:4321 | Local files | Continuous | N/A | pnpm dev |
| production | Live website | GitHub Pages | main branch | On merge | N/A | Auto-deploy |

**Note**: No formal staging environment exists. Local development with `pnpm dev` serves as staging.

### Cloud & Platform Services

| Service | Purpose | Environment(s) | Key Config | Cost/Limits | Owner | Vendor Risk |
|---------|---------|----------------|------------|-------------|-------|-------------|
| GitHub Pages | Static hosting | Production | Auto-deploy on push | Free tier | GitHub | Low |
| GitHub Actions | CI/CD | All | 12 workflows | Free tier (public repo) | GitHub | Low |
| npm Registry | CLI publishing | Production | @intentsolutionsio/ccpi | Free | npm Inc | Low |
| Vertex AI Gemini | Skill generation | Daily batch | 2.0/2.5 models | Pay-per-use | Google Cloud | Medium |
| CodeQL | Security scanning | CI | Weekly + PR | Free | GitHub | Low |
| Codecov | Coverage reports | CI | Python tests | Free tier | Codecov | Low |

### Architecture Diagram

```
                                    CLAUDE CODE PLUGINS ARCHITECTURE
                                    ================================

+-------------------------------------------------------------------------------------------+
|                                    GITHUB REPOSITORY                                       |
|  jeremylongshore/claude-code-plugins                                                      |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  +------------------+  +------------------+  +------------------+  +------------------+   |
|  |    plugins/      |  |   marketplace/   |  |    packages/     |  |    scripts/      |   |
|  +------------------+  +------------------+  +------------------+  +------------------+   |
|  | 258 plugins in   |  | Astro 5.16.6     |  | cli/             |  | 80+ validation   |   |
|  | 22 categories:   |  | website source:  |  |   @intentsol-    |  | and automation   |   |
|  |                  |  |                  |  |   utionsio/ccpi  |  | scripts          |   |
|  | - ai-ml (35)     |  | src/pages/       |  |   v2.0.0         |  |                  |   |
|  | - devops (34)    |  | src/components/  |  |                  |  | validate-all-    |   |
|  | - security (27)  |  | src/data/        |  | analytics-       |  |   plugins.sh     |   |
|  | - database (27)  |  |                  |  |   daemon/        |  | sync-marketplace |   |
|  | - crypto (28)    |  | 543 routes       |  |                  |  |   .cjs           |   |
|  | - mcp (7)        |  | generated        |  | analytics-       |  | validate-skills- |   |
|  | - etc.           |  |                  |  |   dashboard/     |  |   schema.py      |   |
|  +--------+---------+  +--------+---------+  +--------+---------+  +--------+---------+   |
|           |                     |                     |                     |             |
|           v                     v                     v                     v             |
|  +-------------------------------------------------------------------------------------------+
|  |                         .claude-plugin/ (Two-Catalog System)                              |
|  +-------------------------------------------------------------------------------------------+
|  |                                                                                           |
|  |  marketplace.extended.json  ----[sync-marketplace.cjs]---->  marketplace.json            |
|  |  (SOURCE OF TRUTH)                                           (GENERATED - CLI compatible)|
|  |  - 267 plugins                                               - Stripped extra fields     |
|  |  - Extended metadata:                                        - Claude CLI schema valid   |
|  |    featured, mcpTools,                                                                   |
|  |    pricing, components                                                                   |
|  |                                                                                           |
|  +-------------------------------------------------------------------------------------------+
|                                                                                           |
+-------------------------------------------------------------------------------------------+
                                              |
                                              | GitHub Actions (12 workflows)
                                              v
+-------------------------------------------------------------------------------------------+
|                               CI/CD PIPELINE                                               |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  validate-plugins.yml          deploy-marketplace.yml       cli-test.yml                  |
|  +------------------+          +------------------+         +------------------+          |
|  | - JSON validation|          | - Build Astro   |         | - Cross-platform |          |
|  | - Plugin structure|         | - Smoke tests   |         |   Ubuntu/macOS/  |          |
|  | - Security scans |          | - Route valid.  |         |   Windows        |          |
|  | - MCP tests      |          | - Deploy Pages  |         | - Node 18/20/22  |          |
|  | - Python tests   |          +------------------+         | - Deno support   |          |
|  | - Playwright E2E |                                       +------------------+          |
|  +------------------+                                                                     |
|                                                                                           |
|  release.yml                   security-audit.yml           codeql.yml                    |
|  +------------------+          +------------------+         +------------------+          |
|  | - Version bump   |          | - Weekly pnpm   |         | - JS/TS/Python   |          |
|  | - Changelog      |          |   audit         |         | - Security +     |          |
|  | - Git tag        |          | - Security      |         |   quality        |          |
|  | - GitHub release |          |   events        |         +------------------+          |
|  +------------------+          +------------------+                                       |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
                                              |
                                              | Deployment
                                              v
+-------------------------------------------------------------------------------------------+
|                               PRODUCTION (claudecodeplugins.io)                           |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  GitHub Pages                  npm Registry                                               |
|  +------------------+          +------------------+                                       |
|  | - Static HTML    |          | @intentsolutionsio/ccpi                                 |
|  | - 543 routes     |          | - CLI for plugin management                             |
|  | - Tailwind CSS   |          | - Commands: search, list, install, update, info        |
|  | - Fuse.js search |          +------------------+                                       |
|  +------------------+                                                                     |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
                                              |
                                              | User Interaction
                                              v
+-------------------------------------------------------------------------------------------+
|                               CLAUDE CODE (User's Machine)                                |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  /plugin marketplace add jeremylongshore/claude-code-plugins                             |
|  /plugin install devops-automation-pack@claude-code-plugins-plus                         |
|                                                                                           |
|  OR                                                                                       |
|                                                                                           |
|  ccpi install devops-automation-pack                                                      |
|                                                                                           |
|  +------------------+          +------------------+         +------------------+          |
|  | Plugin Files     |          | Agent Skills    |         | MCP Servers      |          |
|  | ~/.claude/       |          | SKILL.md        |         | Node.js process  |          |
|  |   plugins/       |          | Auto-activation |         | StdioTransport   |          |
|  +------------------+          +------------------+         +------------------+          |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
```

### Data Flow Diagram

```
PLUGIN DEVELOPMENT FLOW
=======================

Developer             Repository              CI/CD                 Production
    |                     |                     |                       |
    |--[1. Create plugin]->|                    |                       |
    |                     |--[2. PR triggers]-->|                       |
    |                     |                     |--[3. validate-plugins]|
    |                     |                     |   - JSON validation   |
    |                     |                     |   - Security scan     |
    |                     |                     |   - MCP tests         |
    |                     |                     |   - Playwright E2E    |
    |<--[4. PR feedback]--|<--------------------|                       |
    |                     |                     |                       |
    |--[5. Merge to main]->|                    |                       |
    |                     |--[6. Push triggers]->|                      |
    |                     |                     |--[7. deploy-marketplace]
    |                     |                     |                       |
    |                     |                     |----[8. Build Astro]-->|
    |                     |                     |----[9. Smoke tests]-->|
    |                     |                     |----[10. Deploy]------>|
    |                     |                     |                       |
                                                                        |
USER INSTALLATION FLOW                                                  |
======================                                                  |
                                                                        |
End User              CLI/Claude           Catalog               Website
    |                     |                   |                     |
    |--[ccpi search X]--->|                   |                     |
    |                     |--[fetch catalog]->|<--[generated from]--|
    |<--[search results]--|<------------------|                     |
    |                     |                   |                     |
    |--[ccpi install X]-->|                   |                     |
    |                     |--[download plugin from GitHub]--------->|
    |                     |--[copy to ~/.claude/plugins/]          |
    |<--[success]---------|                   |                     |
```

---

## 4. Directory Deep-Dive

### Project Structure Analysis

```
/home/jeremy/000-projects/claude-code-plugins/
├── .beads/                      # Beads task tracking (git-ignored)
├── .claude/                     # Claude Code local config
├── .claude-plugin/              # Marketplace catalog files
│   ├── marketplace.extended.json  # SOURCE OF TRUTH (267 plugins)
│   └── marketplace.json           # GENERATED (CLI-compatible)
├── .github/
│   └── workflows/               # 12 GitHub Actions workflows
├── 000-docs/                    # 279 documentation files (mostly git-ignored)
├── archive/                     # Historical/archived content
├── backups/                     # Backup files and documentation
├── marketplace/                 # Astro website (npm, not pnpm)
│   ├── dist/                    # Built website (543 routes)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── content/             # Content collections
│   │   ├── data/                # Data files for pages
│   │   ├── layouts/             # Page layouts
│   │   ├── pages/               # Route pages (19 top-level)
│   │   └── styles/              # CSS files
│   ├── scripts/                 # Build and validation scripts
│   └── tests/                   # Playwright tests
├── node_modules/                # Root dependencies
├── notebooks/                   # Jupyter notebooks (reference)
├── packages/                    # Shared workspace packages
│   ├── analytics-daemon/        # Analytics collection service
│   ├── analytics-dashboard/     # Analytics visualization
│   ├── cli/                     # @intentsolutionsio/ccpi CLI
│   └── plugin-validator/        # Shared validation logic
├── planned-skills/              # 500 Standalone Skills Initiative
│   ├── batches/                 # Batch processing groups
│   ├── categories/              # 20 categories x 25 skills
│   ├── generated/               # Vertex AI generated skills
│   ├── scripts/                 # Generation scripts
│   └── templates/               # Skill templates
├── plugins/                     # 266 plugin directories
│   ├── ai-agency/               # 8 plugins
│   ├── ai-ml/                   # 35 plugins
│   ├── api-development/         # 27 plugins
│   ├── automation/              # 3 plugins
│   ├── business-tools/          # 3 plugins
│   ├── community/               # 8 plugins
│   ├── crypto/                  # 28 plugins
│   ├── database/                # 27 plugins
│   ├── devops/                  # 34 plugins
│   ├── examples/                # 7 plugins
│   ├── finance/                 # 3 plugins
│   ├── jeremy-genkit/           # 2 plugins
│   ├── jeremy-google-adk/       # 5 plugins
│   ├── jeremy-vertex-ai/        # 4 plugins
│   ├── life-sciences/           # 2 plugins
│   ├── mcp/                     # 7 MCP server plugins
│   ├── packages/                # 7 plugin packs
│   ├── performance/             # 27 plugins
│   ├── productivity/            # 12 plugins
│   ├── saas-packs/              # 6 SaaS integration packs
│   ├── security/                # 27 plugins
│   ├── skill-enhancers/         # 8 plugins
│   └── testing/                 # 27 plugins
├── prompts/                     # Prompt templates
├── scripts/                     # 80+ automation scripts
├── templates/                   # Plugin scaffolding templates
│   ├── agent-plugin/
│   ├── command-plugin/
│   ├── full-plugin/
│   └── minimal-plugin/
├── test-results/                # Test output (git-ignored)
├── tests/                       # Root-level test files
├── tutorials/                   # 11 Jupyter notebooks
├── workspace/                   # Learning Lab (git-ignored except lab/)
├── AGENTS.md                    # Agent session instructions
├── CLAUDE.md                    # Claude Code project instructions (29KB)
├── Dockerfile.test              # Multi-stage Docker test env
├── docker-compose.test.yml      # Docker Compose for testing
├── package.json                 # Monorepo root config
├── pnpm-lock.yaml               # Dependency lock file
├── pnpm-workspace.yaml          # Workspace definition
├── README.md                    # Main documentation (30KB)
├── setup.sh                     # Initial setup script
└── VERSION                      # Version file (4.3.0)
```

### Detailed Directory Analysis

#### plugins/ (258 plugins across 22 categories)

**Purpose**: Contains all marketplace plugins organized by category.

**Key Structure per Plugin**:
```
plugins/[category]/[plugin-name]/
├── .claude-plugin/
│   └── plugin.json              # Required manifest
├── commands/                    # Slash commands (optional)
│   └── [name].md
├── skills/                      # Agent Skills (optional)
│   └── skill-adapter/
│       └── SKILL.md             # 2025 schema compliant
├── agents/                      # AI agents (optional)
│   └── [name].md
├── hooks/                       # Event hooks (optional)
│   └── hooks.json
├── README.md                    # Required documentation
└── LICENSE                      # Required license file
```

**Plugin Types**:
- **AI Instruction Plugins (98%)**: Markdown files with YAML frontmatter - no code execution
- **MCP Server Plugins (2%)**: TypeScript applications using @modelcontextprotocol/sdk

**MCP Plugins (7 total)**:
1. `project-health-auditor` - Code health analysis, complexity metrics
2. `conversational-api-debugger` - Interactive API debugging
3. `domain-memory-agent` - Domain-specific memory storage
4. `ai-experiment-logger` - ML experiment tracking
5. `design-to-code` - Design file to code conversion
6. `workflow-orchestrator` - Multi-step workflow automation
7. `lumera-agent-memory` - Agent memory persistence

**Code Quality Observations**:
- All MCP plugins use consistent TypeScript + Vitest + ESLint setup
- Entry points are executable with shebang `#!/usr/bin/env node`
- Zod schemas validate all tool inputs at runtime

#### packages/ (4 workspace packages)

**packages/cli/**
- **Package**: `@intentsolutionsio/ccpi` v2.0.0
- **Published**: npm registry (public)
- **Framework**: Commander 12.1.0
- **Commands**: `search`, `list`, `install`, `update`, `info`, `validate`, `doctor`
- **Build**: TypeScript -> dist/index.js (executable)
- **Testing**: Cross-platform matrix (Ubuntu/macOS/Windows x Node 18/20/22)

**packages/analytics-daemon/**
- **Purpose**: Background service collecting plugin usage analytics
- **Status**: Active development
- **Integration**: Website and plugin installations

**packages/analytics-dashboard/**
- **Purpose**: Analytics visualization and reporting
- **Status**: Active development

**packages/plugin-validator/**
- **Purpose**: Shared validation logic for CI and CLI
- **Features**: Schema validation, frontmatter parsing, security scanning

#### marketplace/ (Astro Website)

**Framework**: Astro 5.16.6 with Tailwind CSS 4.1.18
**Package Manager**: npm (exception to pnpm rule)
**Build Output**: 543 HTML routes in dist/

**Key Pages**:
- `index.astro` (50KB) - Homepage with featured plugins
- `explore.astro` (32KB) - Plugin exploration with filters
- `skill-enhancers.astro` (44KB) - Skills category page
- `sponsor.astro` (44KB) - Sponsorship information
- `playbooks/` - 11 production playbook pages
- `plugins/` - Dynamic plugin detail pages
- `skills/` - Skills documentation
- `learn/` - Learning resources

**Build Constraints**:
- `compressHTML: false` - iOS Safari fails with lines > 5000 chars
- Smoke tests verify line length on every deploy

#### scripts/ (80+ automation scripts)

**Validation Scripts**:
- `validate-all-plugins.sh` - 6-stage validation pipeline
- `validate-skills-schema.py` - 2025 schema compliance
- `validate-frontmatter.py` - YAML frontmatter validation
- `validate-plugin.js` - Plugin structure validation

**Catalog Management**:
- `sync-marketplace.cjs` - Syncs extended -> CLI catalog
- `check-routes.mjs` - Website route verification
- `check-official-links.mjs` - External link validation
- `check-performance.mjs` - Performance budget enforcement

**Skill Generation**:
- `skills-generate-gemini.py` - Vertex AI skill generation
- `skills-enhancer-batch.py` - Batch skill enhancement
- `batch-fix-skills.py` - Automated skill repairs

**Audit & Analysis**:
- `audit-plugin-manifests.sh` - plugin.json audit
- `audit-plugin-commands.sh` - Command audit
- `audit-plugin-agents.sh` - Agent audit
- `audit-skills-quality.py` - Skills quality analysis

**Testing**:
- `quick-test.sh` - Fast pre-commit validation (~30s)
- `test-clean-environment.sh` - Full isolated test (2-5 min)
- `test-docker-suite.sh` - Docker-based testing (5-10 min)

#### .github/workflows/ (12 CI/CD workflows)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `validate-plugins.yml` | PR, push to main | Full validation + security + tests |
| `deploy-marketplace.yml` | Push to marketplace/ | Build and deploy website |
| `cli-test.yml` | Push to packages/cli/ | Cross-platform CLI testing |
| `cli-publish.yml` | Manual dispatch | Publish CLI to npm |
| `release.yml` | Manual dispatch | Version bump + GitHub release |
| `daily-skill-generator.yml` | Cron (daily) | Generate skills via Vertex AI |
| `security-audit.yml` | Weekly cron | pnpm audit for vulnerabilities |
| `codeql.yml` | PR, push, weekly | CodeQL security analysis |
| `automerge.yml` | PR labeled | Auto-merge Dependabot PRs |
| `maintainer-ready-automerge.yml` | PR labeled | Fast-track approved PRs |
| `gemini-code-review.yml` | PR | AI-assisted code review |

---

## 5. Automation & Agent Surfaces

### GitHub Actions Workflows (12 total)

| Workflow | Purpose | Trigger | Failure Handling | Owner |
|----------|---------|---------|------------------|-------|
| validate-plugins | Full validation suite | PR/push | Blocks merge | Intent Solutions |
| deploy-marketplace | Website deployment | Push to main | Manual retry | Intent Solutions |
| cli-test | Cross-platform CLI tests | Push to cli/ | Fails PR | Intent Solutions |
| cli-publish | Publish CLI to npm | Manual | Requires secrets | Intent Solutions |
| release | Version + GitHub release | Manual | Step-by-step | Intent Solutions |
| daily-skill-generator | Vertex AI skill gen | Daily cron | Silent failure | Intent Solutions |
| security-audit | Weekly dependency audit | Weekly cron | Non-blocking | Intent Solutions |
| codeql | Code security analysis | PR/push/weekly | Advisory | GitHub |
| automerge | Auto-merge Dependabot | PR labeled | Non-blocking | Dependabot |
| maintainer-ready-automerge | Fast-track maintainer PRs | PR labeled | Non-blocking | Maintainers |
| gemini-code-review | AI code review | PR | Advisory | Intent Solutions |

### Vertex AI / Gemini Integration

**Daily Skill Generator**:
- Schedule: Daily cron job
- Model: Vertex AI Gemini 2.0/2.5
- Purpose: Generate Agent Skills for 500 Standalone Skills Initiative
- Output: SKILL.md files in planned-skills/generated/
- Cost: Pay-per-use (variable)

**Gemini Code Review**:
- Trigger: PR opened/updated
- Purpose: AI-assisted code review suggestions
- Integration: GitHub PR comments

### Beads Task Tracking

**Location**: `.beads/` (git-ignored)
**Purpose**: Issue and task tracking with git sync
**Session Commands**:
```bash
bd ready              # Start of session - see available tasks
bd create "Title"     # Create new task
bd update <id> --status in_progress  # Claim task
bd close <id> --reason "Done"        # Complete task
bd sync               # End of session - sync to git
```

**Git Hooks Installed**:
- `pre-commit`: Flushes pending beads changes
- `post-merge`: Imports beads updates after pulls
- `pre-push`: Exports database before pushing
- `post-checkout`: Ensures consistency on branch switches

### MCP Server Plugins (7 servers, 21+ tools)

| Plugin | MCP Tools | Purpose | Dependencies |
|--------|-----------|---------|--------------|
| project-health-auditor | 5+ | Code health metrics | simple-git, glob |
| conversational-api-debugger | 3+ | API debugging | axios |
| domain-memory-agent | 4+ | Domain memory | SQLite |
| ai-experiment-logger | 3+ | ML tracking | fs-extra |
| design-to-code | 2+ | Design conversion | Custom |
| workflow-orchestrator | 3+ | Workflow automation | Custom |
| lumera-agent-memory | 3+ | Agent memory | Custom |

---

## 6. Operational Reference

### Deployment Workflows

#### Local Development

**Prerequisites**:
- Node.js >= 20.0.0
- pnpm >= 9.0.0 (enforced via packageManager field)
- Python 3.12 (for validation scripts)
- Git

**Environment Setup**:
```bash
# Clone repository
git clone https://github.com/jeremylongshore/claude-code-plugins.git
cd claude-code-plugins

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start marketplace dev server
cd marketplace && npm run dev
# Website available at http://localhost:4321
```

**Verification**:
```bash
# Quick validation (~30s)
bash scripts/quick-test.sh

# Full validation (2-5 min)
bash scripts/test-clean-environment.sh

# Docker-isolated test (5-10 min)
bash scripts/test-docker-suite.sh
```

#### Production Deployment (Marketplace Website)

**Trigger**: Push to `main` branch affecting `marketplace/` or workflow files

**Pre-flight** (validate-plugins.yml):
1. JSON file validation (all .json files)
2. Plugin structure validation (README, permissions)
3. Marketplace catalog sync check
4. Security scans (secrets, dangerous patterns)
5. MCP plugin build + test + typecheck + lint
6. Python tests with coverage
7. Validation scripts (ccpi validate)
8. Package manager enforcement (pnpm only)
9. Marketplace build validation
10. Playbook routes validation
11. Internal links validation
12. Smoke tests (line length < 5000)
13. Playwright E2E tests
14. CLI smoke tests

**Execution** (deploy-marketplace.yml):
```yaml
jobs:
  build:
    - Checkout repository
    - Setup Node.js 20
    - Enable Corepack (pnpm)
    - Install dependencies (pnpm install --frozen-lockfile)
    - Build with Astro (pnpm -C marketplace build)
    - Validate routes and links
    - Smoke test build output
    - Upload artifact to GitHub Pages

  deploy:
    - Deploy to GitHub Pages
    - Output page URL
```

**Rollback Protocol**:
- GitHub Pages maintains deployment history
- Revert commit and re-trigger deployment
- No database state to consider (static site)

### Monitoring & Alerting

**Available Dashboards**:
- GitHub Actions: Build status, run history
- CodeQL: Security advisories
- Codecov: Python test coverage reports
- GitHub Insights: Traffic, contribution activity

**SLIs/SLOs** (Informal):
- Website availability: GitHub Pages SLA (~99.9%)
- CI pipeline success rate: Target 95%
- Build time: Target < 5 minutes

**Logging**:
- GitHub Actions workflow logs (retained 90 days)
- Build outputs in artifacts
- No centralized logging system

**On-Call**:
- No formal on-call rotation
- Community-driven issue response
- Jeremy Longshore primary maintainer

### Incident Response

| Severity | Definition | Response Time | Roles | Playbook | Communication |
|----------|------------|---------------|-------|----------|---------------|
| P0 | Website down | Immediate | Owner | Check GitHub Pages status | GitHub Status |
| P1 | CLI broken | 4 hours | Owner | Rollback npm version | GitHub Issues |
| P2 | Validation false positives | 24 hours | Owner | Update validation rules | PR comments |
| P3 | Documentation issues | 1 week | Community | Fix and merge | GitHub Issues |

### Backup & Recovery

**Code Repository**: GitHub (inherent git redundancy)

**Catalog Data**:
- Source of truth: marketplace.extended.json in git
- No external database to backup

**Deployment State**:
- GitHub Pages maintains deployment history
- Can rollback via GitHub interface

**Recovery Procedures**:
1. **Website Issues**: Revert commit, trigger new deployment
2. **npm Package Issues**: Publish new version or unpublish broken version
3. **Validation Pipeline Issues**: Disable blocking, fix, re-enable

---

## 7. Security, Compliance & Access

### Identity & Access Management

| Account/Role | Purpose | Permissions | Provisioning | MFA | Used By |
|--------------|---------|-------------|--------------|-----|---------|
| jeremylongshore (GitHub) | Repository owner | Admin | Manual | Recommended | Jeremy |
| github-actions[bot] | CI/CD automation | Write (releases) | Automatic | N/A | Workflows |
| dependabot[bot] | Dependency updates | PR creation | Automatic | N/A | GitHub |
| npm (intentsolutionsio) | CLI publishing | Publish | Manual | Recommended | Releases |

### Secrets Management

**GitHub Repository Secrets**:
- `GITHUB_TOKEN`: Auto-provided for Actions
- `NPM_TOKEN`: npm registry publishing (required for cli-publish)
- No cloud provider secrets required (GitHub Pages is built-in)

**Rotation Policy**:
- npm token: Rotate annually or on suspected compromise
- No other secrets require rotation

**Break-glass Procedure**:
1. Revoke compromised token in respective service
2. Generate new token
3. Update GitHub secret
4. Re-run affected workflows

### Security Posture

**Authentication**:
- GitHub authentication for contributions
- npm authentication for CLI publishing
- No user authentication on website (static)

**Authorization**:
- GitHub branch protection on main
- Required reviews for PRs (recommended)
- CODEOWNERS file (if present)

**Encryption**:
- In-transit: HTTPS enforced (GitHub Pages, npm)
- At-rest: N/A (no database)

**Network Security**:
- GitHub infrastructure
- No custom VPC or firewall rules
- CORS not applicable (static site)

**Security Scanning**:
- **CodeQL**: Weekly + PR-triggered JavaScript/TypeScript/Python analysis
- **pnpm audit**: Weekly scheduled security audit
- **CI Security Scans**: Hardcoded secrets detection, dangerous patterns

**Security Scan Details** (validate-plugins.yml):
```bash
# Hardcoded secrets detection
- AWS keys (AKIA*) - BLOCKS CI
- Private keys (BEGIN.*PRIVATE KEY) - BLOCKS CI
- Password/secret/api_key patterns - WARNING

# Dangerous patterns
- rm -rf / (root deletion) - BLOCKS CI
- eval() usage - WARNING
- curl to IP addresses - WARNING
- base64 decoding - WARNING

# URL security
- Non-HTTPS URLs - WARNING
- URL shorteners (bit.ly, tinyurl) - WARNING
```

**Known Security Considerations**:
1. Plugins can contain arbitrary instructions (AI guidance, not code execution)
2. MCP plugins execute as Node.js processes with user permissions
3. No sandboxing of MCP server capabilities
4. Skills declare `allowed-tools` but enforcement is Claude Code responsibility

**Compliance Status**:
- SOC 2: Not applicable (no customer data storage)
- GDPR: No personal data collected on website
- HIPAA: Not applicable
- PCI DSS: Not applicable

---

## 8. Cost & Performance

### Current Costs

**Monthly Cloud Spend**: ~$0 (Free tier services)

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| GitHub Pages | $0 | Free for public repos |
| GitHub Actions | $0 | Free for public repos |
| npm Registry | $0 | Public package |
| Vertex AI Gemini | Variable | Pay-per-use, skill generation |
| Codecov | $0 | Free tier |
| Total | ~$0 + Vertex | |

**Vertex AI Usage** (Daily Skill Generator):
- Model: Gemini 2.0/2.5
- Frequency: Daily cron
- Estimated cost: $5-50/month depending on generation volume

### Performance Baseline

**Website Metrics**:
- Static HTML: Near-instant TTFB (GitHub Pages CDN)
- Total routes: 543 HTML pages
- Largest page: index.astro (50KB source)
- Build time: ~2-3 minutes

**CI Pipeline Performance**:
- validate-plugins: ~5-10 minutes
- deploy-marketplace: ~3-5 minutes
- cli-test (full matrix): ~10-15 minutes

**CLI Performance**:
- Installation time: < 5 seconds
- Search response: < 2 seconds (local catalog)
- Plugin install: ~5-10 seconds (depends on plugin size)

### Optimization Opportunities

1. **Build Caching**: Astro build cache could reduce rebuild time
   - Est. improvement: 30-50% build time reduction

2. **Parallel Testing**: Matrix tests already parallel, well optimized
   - Current state: Good

3. **Dependency Deduplication**: pnpm hoisting already efficient
   - Current state: Good

4. **Image Optimization**: Static images could use next-gen formats
   - Est. improvement: 20-30% asset size reduction

---

## 9. Development Workflow

### Local Development

**Standard Environment**:
- OS: Linux/macOS/Windows (WSL2 recommended on Windows)
- Node.js: 20.x (specified in .nvmrc: 20)
- pnpm: 9.15.9 (enforced via packageManager)
- Python: 3.12 (for validation scripts)
- Git: Latest

**Bootstrap**:
```bash
# Clone and setup
git clone https://github.com/jeremylongshore/claude-code-plugins.git
cd claude-code-plugins
pnpm install

# Verify setup
pnpm build
bash scripts/quick-test.sh

# Start development
cd marketplace && npm run dev
```

**Common Tasks**:

```bash
# Before ANY commit (MANDATORY)
pnpm run sync-marketplace           # Sync catalog files
bash scripts/quick-test.sh          # Fast validation
git add .claude-plugin/marketplace.json  # Commit generated file

# Add new plugin
cp -r templates/command-plugin plugins/[category]/my-plugin
# Edit plugin files...
pnpm run sync-marketplace
./scripts/validate-all-plugins.sh plugins/[category]/my-plugin/

# Test plugin locally
/plugin marketplace add /path/to/claude-code-plugins
/plugin install my-plugin@claude-code-plugins-plus

# Build MCP plugin
cd plugins/mcp/[plugin-name]
pnpm build
chmod +x dist/index.js
pnpm test

# Update marketplace website
cd marketplace
npm run dev  # Development
npm run build  # Production build
npm run preview  # Test production locally
```

### CI/CD Pipeline

**Platform**: GitHub Actions

**Triggers**:
- PR to main: validate-plugins (blocking)
- Push to main: deploy-marketplace (auto)
- Push to packages/cli: cli-test (blocking)
- Manual: release, cli-publish
- Scheduled: security-audit, codeql, daily-skill-generator

**Stages** (validate-plugins):
```
validate (blocking)
    ├── Sync CLI catalog check
    ├── JSON file validation
    ├── Plugin structure check
    ├── Marketplace catalog validation
    ├── Security scan (secrets)
    ├── Security scan (dangerous patterns)
    ├── Security scan (URLs)
    └── MCP dependency audit

test (depends on validate)
    ├── mcp-plugins (build + test + lint + typecheck)
    ├── python-tests (pytest + coverage)
    └── validation-scripts (ccpi validate)

check-package-manager
    └── Enforce pnpm policy

marketplace-validation
    ├── Build marketplace
    ├── Validate routes
    ├── Smoke tests
    ├── Link validation
    └── Performance budget

playwright-tests (depends on marketplace-validation)
    └── E2E browser tests

cli-smoke-tests (depends on marketplace-validation)
    └── CLI command verification
```

**Artifacts**:
- Playwright report (30 days retention)
- Test screenshots (30 days)
- Test videos (7 days)
- CLI build outputs (7 days)

### Code Quality

**Linting**: ESLint 9.39.2
```bash
pnpm lint  # Run across all workspaces
```

**Type Checking**: TypeScript 5.5.0
```bash
pnpm typecheck  # Validate types across workspaces
```

**Formatting**: Prettier 3.7.4
```bash
# Format on save (editor integration recommended)
```

**Testing**: Vitest 2.0.0+
```bash
pnpm test  # Run all workspace tests
```

**Coverage**: Codecov for Python tests
- Uploaded via codecov-action
- Report in PR comments

---

## 10. Dependencies & Supply Chain

### Direct Dependencies (Root)

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| @types/node | ^20.19.27 | TypeScript types | Low |
| typescript | ^5.5.0 | Compilation | Low |
| vitest | ^2.0.0 | Testing | Low |
| eslint | ^9.39.2 | Linting | Low |
| prettier | ^3.7.4 | Formatting | Low |

### CLI Dependencies (packages/cli)

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| commander | ^12.1.0 | CLI framework | Low |
| chalk | ^5.3.0 | Terminal colors | Low |
| ora | ^8.1.1 | Spinners | Low |
| fs-extra | ^11.2.0 | File operations | Low |
| axios | ^1.7.9 | HTTP client | Medium |
| yaml | ^2.7.0 | YAML parsing | Low |

### MCP Plugin Dependencies

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| @modelcontextprotocol/sdk | ^1.25.1 | MCP protocol | Medium |
| glob | ^11.1.0 | File globbing | Low |
| simple-git | ^3.30.0 | Git operations | Low |
| zod | ^4.2.1 | Schema validation | Low |

### Marketplace Dependencies

| Package | Version | Purpose | Risk Level |
|---------|---------|---------|------------|
| astro | ^5.16.6 | SSG framework | Low |
| @tailwindcss/vite | ^4.1.18 | CSS framework | Low |
| fuse.js | ^7.1.0 | Search | Low |
| @playwright/test | ^1.57.0 | E2E testing | Low |

### Third-Party Services

| Service | Purpose | Data Shared | Auth | SLA | Renewal | Owner |
|---------|---------|-------------|------|-----|---------|-------|
| GitHub | Repository, Pages, Actions | Code, builds | OAuth | 99.9% | N/A | GitHub |
| npm | CLI distribution | Package files | Token | 99.9% | N/A | npm Inc |
| Google Cloud | Vertex AI for skills | Prompts | API key | 99.9% | N/A | Google |
| Codecov | Coverage reports | Coverage data | GitHub | N/A | Free | Codecov |

### Dependency Update Strategy

**Dependabot**: Enabled for automated PR creation
**Auto-merge**: Enabled for patch updates (automerge.yml)
**Security Alerts**: GitHub security advisories monitored

---

## 11. Integration with Existing Documentation

### Documentation Inventory

| Document | Status | Last Updated | Location |
|----------|--------|--------------|----------|
| README.md | Current | Dec 2025 | Root |
| CLAUDE.md | Current | Dec 2025 | Root (29KB) |
| AGENTS.md | Current | Dec 2025 | Root |
| 000-docs/ | 279 files | Ongoing | Private docs |
| Production Playbooks | Current | Dec 2025 | 000-docs/196-207 |
| Tutorials | Current | Dec 2025 | tutorials/ (11 notebooks) |
| Learning Lab | Current | Dec 2025 | workspace/lab/ |

### Key Documentation Files

**CLAUDE.md** (29KB):
- Comprehensive project instructions for Claude Code
- Build commands, architecture, conventions
- Task tracking with Beads
- Validation pipeline details
- Plugin structure specifications

**000-docs/ Documentation Categories**:
- BL (Business/Legal): License, code of conduct
- DR (Documentation Reference): Guides, manuals
- MS (Master Systems): Status, versioning
- RA (Research & Audit): Reports, audits
- TQ (Technical Quality): Security
- OD (Operations/DevOps): Changelog, deployment
- LS (Lifecycle Status): Progress tracking

**Production Playbooks** (11 guides, ~53,500 words):
1. Multi-Agent Rate Limits (204-DR-SOPS-01)
2. Cost Caps & Budget Management (196-DR-SOPS-02)
3. MCP Server Reliability (198-DR-SOPS-03)
4. Ollama Migration Guide (199-DR-SOPS-04)
5. Incident Debugging (203-DR-SOPS-05)
6. Self-Hosted Stack Setup (202-DR-SOPS-06)
7. Compliance & Audit (200-DR-SOPS-07)
8. Team Presets & Workflows (197-DR-SOPS-08)
9. Cost Attribution System (201-DR-SOPS-09)
10. Progressive Enhancement (205-DR-SOPS-10)
11. Advanced Tool Use (207-DR-SOPS-11)

### Discrepancies Noted

1. **README.md vs CLAUDE.md**: Minor version differences (4.4.0 vs 4.3.0 in package.json)
2. **Plugin counts**: README says 258, catalog has 267 entries (some may be packs)
3. **Skill counts**: README says 239, actual SKILL.md files: 305 (includes nested)
4. **TypeScript files**: User says 19,563, actual count: 19,580

### Recommended Reading List

1. **CLAUDE.md** - Why: Complete project context and operational commands
2. **README.md** - Why: Public documentation and architecture overview
3. **Production Playbooks Index (206-DR-SOPS)** - Why: Operational runbooks
4. **Learning Lab GUIDE-00-START-HERE.md** - Why: Understanding skill development
5. **scripts/PIPELINE-SUMMARY.md** - Why: CI/CD pipeline documentation

---

## 12. Current State Assessment

### What's Working Well

**Architecture & Design**:
- Monorepo structure with pnpm workspaces is clean and maintainable
- Two-catalog system elegantly handles Claude CLI schema restrictions
- Clear separation between instruction plugins and MCP servers
- TypeScript + ESLint + Vitest provides strong code quality foundation

**CI/CD & Automation**:
- Comprehensive 12-workflow pipeline catches most issues
- Security scanning integrated at multiple levels
- Cross-platform CLI testing ensures broad compatibility
- Automated deployment on merge eliminates manual steps

**Documentation**:
- CLAUDE.md is exceptionally detailed (29KB of project context)
- Production Playbooks provide real operational guidance
- Learning Lab offers educational pathway for contributors
- 11 Jupyter notebooks enable hands-on learning

**Community & Scale**:
- 258 plugins across 22 categories demonstrates ecosystem health
- 239 Agent Skills show advanced capability adoption
- Active contributor recognition in README
- Clear contribution guidelines

### Areas Needing Attention

**Infrastructure Gaps**:
- No staging environment for pre-production testing
- No centralized logging or monitoring beyond GitHub
- No formal alerting on deployment failures
- Reliance on free tier services limits scalability

**Testing Coverage**:
- Python tests have coverage tracking, TypeScript does not
- E2E tests exist but depth is unclear
- No load testing or performance regression tracking
- MCP plugin test coverage varies

**Documentation Drift**:
- Version numbers inconsistent across files
- Plugin/skill counts vary between sources
- No automated documentation freshness checks

**Operational Maturity**:
- No formal on-call rotation
- Incident response is ad-hoc
- No SLA tracking or reporting
- Single maintainer bottleneck risk

**Security Considerations**:
- MCP plugins execute with user permissions (no sandboxing)
- No formal security review process for contributed plugins
- Dependency audit runs but results may not be acted upon

### Immediate Priorities

| Priority | Issue | Impact | Action | Owner |
|----------|-------|--------|--------|-------|
| **High** | Version inconsistencies | Confusion | Align versions in README, CLAUDE.md, package.json | DevOps |
| **High** | No staging environment | Risk | Create staging branch with preview deployment | DevOps |
| **Medium** | TypeScript coverage gaps | Quality | Add Vitest coverage reporting | DevOps |
| **Medium** | Single maintainer risk | Continuity | Document tribal knowledge, expand access | Owner |
| **Low** | Documentation freshness | Trust | Add last-updated checks to CI | DevOps |
| **Low** | Performance monitoring | Visibility | Add Lighthouse CI or similar | DevOps |

---

## 13. Quick Reference

### Operational Command Map

| Capability | Command/Tool | Source | Notes | Owner |
|------------|--------------|--------|-------|-------|
| Install dependencies | `pnpm install` | Root | Frozen lockfile in CI | DevOps |
| Build all packages | `pnpm build` | Root | Includes MCP plugins | DevOps |
| Run all tests | `pnpm test` | Root | Vitest across workspaces | DevOps |
| Lint all code | `pnpm lint` | Root | ESLint | DevOps |
| Type check | `pnpm typecheck` | Root | TypeScript --noEmit | DevOps |
| Sync marketplace | `pnpm run sync-marketplace` | Root | CRITICAL before commit | DevOps |
| Quick validation | `bash scripts/quick-test.sh` | scripts/ | ~30 seconds | DevOps |
| Full validation | `bash scripts/validate-all-plugins.sh` | scripts/ | 6-stage pipeline | DevOps |
| Docker test suite | `bash scripts/test-docker-suite.sh` | scripts/ | 5-10 minutes | DevOps |
| Dev server | `npm run dev` | marketplace/ | localhost:4321 | DevOps |
| Build website | `npm run build` | marketplace/ | Creates dist/ | DevOps |
| Skills validation | `python3 scripts/validate-skills-schema.py` | scripts/ | 2025 schema | DevOps |
| Beads sync | `bd sync` | .beads/ | Task tracking | Developer |

### Critical Endpoints & Resources

**Production URLs**:
- Website: https://claudecodeplugins.io
- GitHub: https://github.com/jeremylongshore/claude-code-plugins
- npm CLI: https://www.npmjs.com/package/@intentsolutionsio/ccpi

**Monitoring**:
- GitHub Actions: https://github.com/jeremylongshore/claude-code-plugins/actions
- CodeQL Alerts: https://github.com/jeremylongshore/claude-code-plugins/security

**Documentation**:
- README: Root of repository
- CLAUDE.md: Root of repository
- Production Playbooks: 000-docs/196-207-DR-SOPS-*.md

**Community**:
- Issues: https://github.com/jeremylongshore/claude-code-plugins/issues
- Discussions: https://github.com/jeremylongshore/claude-code-plugins/discussions
- Discord: https://discord.com/invite/6PPFFzqPDZ (#claude-code channel)

### First-Week Checklist

**Day 1-2: Environment Setup**
- [ ] Clone repository and run `pnpm install`
- [ ] Run `pnpm build` successfully
- [ ] Run `bash scripts/quick-test.sh` successfully
- [ ] Start marketplace dev server with `npm run dev`
- [ ] Review CLAUDE.md thoroughly (29KB)

**Day 3-4: CI/CD Understanding**
- [ ] Review all 12 GitHub Actions workflows
- [ ] Understand validate-plugins.yml (main gate)
- [ ] Understand deploy-marketplace.yml (deployment)
- [ ] Review scripts/PIPELINE-SUMMARY.md

**Day 5: Plugin Architecture**
- [ ] Explore plugins/ directory structure
- [ ] Build an MCP plugin: `cd plugins/mcp/project-health-auditor && pnpm build`
- [ ] Understand two-catalog system (marketplace.extended.json -> marketplace.json)
- [ ] Review a plugin submission workflow

**Week 1 Complete**
- [ ] Create a test plugin using templates/
- [ ] Submit test plugin through full validation
- [ ] Review Production Playbooks (000-docs/196-207)
- [ ] Set up Beads task tracking (`bd onboard`)

---

## 14. Recommendations Roadmap

### Week 1 - Critical Setup & Stabilization

**Goals**:
1. Align version numbers across README.md, CLAUDE.md, package.json, VERSION
2. Document current state in internal knowledge base
3. Verify all CI workflows pass on current main branch
4. Review and triage open GitHub issues

**Stakeholders**: DevOps Engineer, Repository Owner
**Dependencies**: Repository access

**Success Criteria**:
- All version references match (4.4.0)
- CI pipeline passes without manual intervention
- Issue backlog categorized and prioritized

### Month 1 - Foundation & Visibility

**Goals**:
1. Implement staging environment (preview deployments on PR)
2. Add TypeScript test coverage reporting to CI
3. Create operational runbook for common issues
4. Set up basic uptime monitoring (GitHub status, simple ping)
5. Document MCP plugin security model

**Stakeholders**: DevOps Engineer, Repository Owner
**Dependencies**: GitHub settings access

**Success Criteria**:
- Preview deployments working for PRs
- Coverage reports in PRs for TypeScript changes
- Runbook covers 80% of historical issues
- Alert on website unavailability

### Quarter 1 - Strategic Enhancements

**Goals**:
1. Implement automated documentation freshness checks
2. Add Lighthouse CI for performance regression tracking
3. Create contributor onboarding automation
4. Establish formal security review process for new plugins
5. Build analytics dashboard for plugin usage metrics
6. Document disaster recovery procedures
7. Consider paid monitoring tier if scale warrants

**Stakeholders**: DevOps Engineer, Repository Owner, Community
**Dependencies**: Budget approval for paid services if needed

**Success Criteria**:
- Documentation accuracy > 95%
- Performance budget automated in CI
- New contributor setup time < 1 hour
- Security review checklist documented
- Usage metrics visible to maintainers

### Quarter 2 - Scaling & Sustainability

**Goals**:
1. Expand maintainer access to reduce single-point-of-failure
2. Implement automated dependency update validation
3. Create plugin certification/verification program
4. Build community contribution rewards system
5. Evaluate enterprise support model

**Stakeholders**: All
**Dependencies**: Community growth, business decisions

**Success Criteria**:
- Multiple active maintainers with deployment access
- Dependency updates don't break builds
- Verified plugin badge system operational
- Active contributor growth month-over-month

---

## Appendices

### Appendix A. Glossary

| Term | Definition |
|------|------------|
| **Agent Skills** | Auto-activating capabilities in Claude Code triggered by conversation context |
| **Beads (bd)** | Task tracking system with git synchronization |
| **CLAUDE.md** | Project-specific instructions for Claude Code |
| **MCP** | Model Context Protocol - Anthropic's protocol for tool communication |
| **Plugin** | Extension for Claude Code providing commands, agents, skills, or tools |
| **SKILL.md** | Skill definition file with YAML frontmatter following 2025 schema |
| **ccpi** | CLI tool for managing Claude Code plugins |
| **pnpm** | Fast, disk space efficient package manager (required) |
| **Astro** | Static site generator used for marketplace website |

### Appendix B. Reference Links

| Resource | URL |
|----------|-----|
| Repository | https://github.com/jeremylongshore/claude-code-plugins |
| Website | https://claudecodeplugins.io |
| npm CLI | https://www.npmjs.com/package/@intentsolutionsio/ccpi |
| CI Dashboard | https://github.com/jeremylongshore/claude-code-plugins/actions |
| Issues | https://github.com/jeremylongshore/claude-code-plugins/issues |
| Discussions | https://github.com/jeremylongshore/claude-code-plugins/discussions |
| Discord | https://discord.com/invite/6PPFFzqPDZ |
| Claude Code Docs | https://docs.claude.com/en/docs/claude-code/ |
| Plugin Reference | https://docs.claude.com/en/docs/claude-code/plugins-reference |

### Appendix C. Troubleshooting Playbooks

**Issue: "Marketplace CLI catalog was out of date"**
```bash
# Cause: marketplace.extended.json edited without syncing
# Fix:
pnpm run sync-marketplace
git add .claude-plugin/marketplace.json
git commit --amend  # or new commit
```

**Issue: "Invalid JSON" in CI**
```bash
# Cause: Malformed JSON file
# Fix:
jq empty path/to/file.json  # Identify syntax error
# Fix the JSON syntax
```

**Issue: "Missing frontmatter" in validation**
```bash
# Cause: SKILL.md or command.md missing YAML frontmatter
# Fix: Ensure file starts with:
---
name: skill-name
description: |
  Description with trigger phrases
allowed-tools: Read, Write, Edit
version: 1.0.0
---
```

**Issue: "Script not executable"**
```bash
# Cause: Shell script missing execute permission
# Fix:
chmod +x scripts/*.sh
git add -u
git commit -m "fix: make scripts executable"
```

**Issue: "iOS Safari rendering failure"**
```bash
# Cause: HTML line > 5000 characters
# Check: astro.config.mjs should have compressHTML: false
# Verify: wc -L marketplace/dist/index.html  # Should be < 5000
```

**Issue: "pnpm policy check failed"**
```bash
# Cause: npm or yarn used in workspace
# Fix: Use pnpm exclusively
pnpm install  # Not npm install
```

**Issue: MCP plugin won't start**
```bash
# Checklist:
1. pnpm build  # Compile TypeScript
2. chmod +x dist/index.js  # Make executable
3. Check shebang: head -1 dist/index.js  # Should be #!/usr/bin/env node
4. Check package.json "type": "module"
```

### Appendix D. Change Management

**Release Process** (Manual via release.yml):
1. Ensure all PRs merged to main
2. Run validate-plugins workflow passes
3. Trigger release.yml with bump_type (patch/minor/major)
4. Workflow bumps version, updates files, creates tag
5. GitHub Release created automatically
6. Announcement issue created

**CLI Publishing** (Manual via cli-publish.yml):
1. Ensure packages/cli version updated
2. Build passes in cli-test workflow
3. Trigger cli-publish workflow
4. Requires NPM_TOKEN secret
5. Verify on npmjs.com

**Hotfix Process**:
1. Create fix on main branch
2. PR through standard validation
3. Merge triggers deployment
4. No special hotfix branch needed

### Appendix E. Open Questions

1. **Staging Environment**: Should PRs get preview deployments?
2. **Plugin Verification**: Should there be a "verified" badge system?
3. **Analytics**: What metrics matter most for plugin success?
4. **Enterprise Support**: Is there demand for paid support tier?
5. **Vertex AI Costs**: How to manage skill generation costs at scale?
6. **MCP Sandboxing**: Should MCP plugins run in restricted environments?
7. **Multi-maintainer**: Who else should have deployment access?

---

## Document Metadata

| Field | Value |
|-------|-------|
| Document ID | 258-AA-AUDT-appaudit-devops-playbook.md |
| Category | AA-AUDT (Analysis/Assessment - Audit) |
| Created | 2025-12-29 |
| Author | Claude Code (appaudit skill) |
| Target Audience | DevOps Engineer |
| Word Count | ~15,000 |
| Retention | Permanent (update quarterly) |

---

*This document was generated using the /appaudit universal system analysis skill. For updates or corrections, contact the repository owner or submit a PR.*
