# Epic: IMAP/SMTP Fallback Connector

**Project:** intent-mail
**Epic ID:** intent-mail-imap (to be created)
**Priority:** P1
**Status:** Planning → Implementation
**Created:** 2025-12-24

---

## Problem Statement

IntentMail requires OAuth 2.0 setup (Google Cloud Console) creating a 10-15 minute barrier that blocks 90% of users. Most users expect simple email + app password authentication.

## Solution

Implement IMAP/SMTP connector enabling users to connect with app password in 30 seconds.

---

## Epic Structure

```
intent-mail-imap: IMAP/SMTP Connector Epic
│
├── intent-mail-imap-infra: Infrastructure
│   ├── intent-mail-imap-deps: Install dependencies
│   │   ├── Add imapflow to package.json
│   │   ├── Add nodemailer to package.json
│   │   ├── Add mailparser to package.json
│   │   ├── Add @types/* for TypeScript
│   │   └── Verify npm install succeeds
│   │
│   ├── intent-mail-imap-conn: Connection manager
│   │   ├── Create src/connectors/imap/index.ts exports
│   │   ├── Create ImapConfig interface
│   │   ├── Create ImapConnection class
│   │   ├── Implement connect() method
│   │   ├── Implement disconnect() method
│   │   ├── Implement isConnected() check
│   │   ├── Add connection state enum
│   │   ├── Add connection event emitter
│   │   ├── Implement auto-reconnect logic
│   │   └── Add connection timeout handling
│   │
│   └── intent-mail-imap-health: Health checks
│       ├── Implement NOOP ping method
│       ├── Add periodic health check timer
│       ├── Create getHealthStatus() method
│       └── Integrate with health_check MCP tool
│
├── intent-mail-imap-auth: Authentication
│   ├── intent-mail-imap-providers: Provider configs
│   │   ├── Create IMAP_PROVIDERS constant
│   │   ├── Add Gmail IMAP settings (imap.gmail.com:993)
│   │   ├── Add Gmail SMTP settings (smtp.gmail.com:587)
│   │   ├── Add Outlook IMAP settings (outlook.office365.com:993)
│   │   ├── Add Outlook SMTP settings (smtp.office365.com:587)
│   │   ├── Add Yahoo IMAP/SMTP settings
│   │   └── Add custom server option
│   │
│   ├── intent-mail-imap-creds: Credential handling
│   │   ├── Create ImapCredentials interface
│   │   ├── Create validateCredentials() function
│   │   ├── Test IMAP login before saving
│   │   ├── Test SMTP auth before saving
│   │   ├── Return specific error for wrong password
│   │   ├── Return specific error for server unreachable
│   │   └── Return specific error for blocked connection
│   │
│   └── intent-mail-imap-storage: Credential storage
│       ├── Add auth_type column to accounts table
│       ├── Add imap_host column to accounts table
│       ├── Add imap_port column to accounts table
│       ├── Add smtp_host column to accounts table
│       ├── Add smtp_port column to accounts table
│       ├── Create storeImapCredentials() function
│       ├── Create getImapCredentials() function
│       ├── Encrypt password before storage
│       └── Create migration v2 for schema changes
│
├── intent-mail-imap-fetch: Email Retrieval
│   ├── intent-mail-imap-folders: Folder operations
│   │   ├── Create listFolders() function
│   │   ├── Parse folder hierarchy
│   │   ├── Get message count per folder
│   │   ├── Get unseen count per folder
│   │   ├── Identify special folders (INBOX, Sent, etc.)
│   │   ├── Create FOLDER_TO_LABEL mapping
│   │   ├── Handle Gmail [Gmail]/* folders
│   │   ├── Handle Outlook folder structure
│   │   └── Normalize folder names to labels
│   │
│   ├── intent-mail-imap-messages: Message fetching
│   │   ├── Create fetchMessage(uid) function
│   │   ├── Parse From header to Address
│   │   ├── Parse To header to Address[]
│   │   ├── Parse Cc header to Address[]
│   │   ├── Parse Subject header
│   │   ├── Parse Date header
│   │   ├── Extract plain text body
│   │   ├── Extract HTML body
│   │   ├── Handle multipart messages
│   │   ├── Handle quoted-printable encoding
│   │   ├── Handle base64 encoding
│   │   ├── Handle UTF-8 and other charsets
│   │   ├── Extract Message-ID
│   │   ├── Extract In-Reply-To
│   │   ├── Extract References
│   │   ├── Get message flags (SEEN, FLAGGED, etc.)
│   │   ├── Get message size
│   │   └── Detect if has attachments
│   │
│   ├── intent-mail-imap-search: Search operations
│   │   ├── Create translateQuery() function
│   │   ├── Translate from: filter → FROM
│   │   ├── Translate to: filter → TO
│   │   ├── Translate subject: filter → SUBJECT
│   │   ├── Translate query text → TEXT
│   │   ├── Translate dateFrom → SINCE
│   │   ├── Translate dateTo → BEFORE
│   │   ├── Translate hasAttachments → Content-Type check
│   │   ├── Translate flags → SEEN/UNSEEN/FLAGGED
│   │   ├── Execute IMAP SEARCH command
│   │   ├── Return UID list
│   │   ├── Paginate results (offset/limit)
│   │   └── Handle empty results
│   │
│   └── intent-mail-imap-attach: Attachments
│       ├── Create listAttachments(uid) function
│       ├── Parse Content-Disposition headers
│       ├── Extract filename from attachment
│       ├── Extract MIME type
│       ├── Extract size
│       ├── Generate attachment ID
│       ├── Create downloadAttachment(uid, attachmentId)
│       ├── Handle base64 decoding
│       ├── Stream large attachments
│       └── Cache attachments locally
│
├── intent-mail-imap-sync: Sync Strategy
│   ├── intent-mail-imap-uid: UID tracking
│   │   ├── Create imap_sync_state table
│   │   ├── Store highest_uid per folder
│   │   ├── Store uid_validity per folder
│   │   ├── Detect UIDVALIDITY change
│   │   ├── Trigger full resync on UIDVALIDITY change
│   │   └── Create migration for sync state table
│   │
│   ├── intent-mail-imap-incremental: Incremental sync
│   │   ├── Query UIDs > highest_uid
│   │   ├── Batch fetch new messages (50 at a time)
│   │   ├── Update highest_uid after batch
│   │   ├── Detect deleted messages (EXPUNGE)
│   │   ├── Remove deleted from local DB
│   │   └── Track sync progress for UI
│   │
│   └── intent-mail-imap-flags: Flag sync
│       ├── Detect flag changes on messages
│       ├── Update local SEEN flag
│       ├── Update local FLAGGED flag
│       ├── Sync local flag changes to server
│       └── Handle concurrent modifications
│
├── intent-mail-smtp: SMTP Send
│   ├── intent-mail-smtp-client: Client setup
│   │   ├── Create SmtpClient class
│   │   ├── Configure nodemailer transport
│   │   ├── Handle STARTTLS
│   │   ├── Handle plain TLS (port 465)
│   │   ├── Add connection verification
│   │   ├── Add send timeout handling
│   │   └── Implement connection reuse
│   │
│   ├── intent-mail-smtp-compose: Email composition
│   │   ├── Create composeEmail() function
│   │   ├── Build From header
│   │   ├── Build To header (multiple recipients)
│   │   ├── Build Cc header
│   │   ├── Build Bcc header
│   │   ├── Build Subject header
│   │   ├── Set Message-ID header
│   │   ├── Set Date header
│   │   ├── Build plain text body
│   │   ├── Build HTML body
│   │   ├── Build multipart/alternative
│   │   └── Handle Unicode encoding
│   │
│   ├── intent-mail-smtp-attach: Attachments
│   │   ├── Add attachment to email
│   │   ├── Set Content-Type header
│   │   ├── Set Content-Disposition header
│   │   ├── Encode attachment as base64
│   │   ├── Handle inline images (cid:)
│   │   └── Validate attachment size limits
│   │
│   ├── intent-mail-smtp-thread: Threading
│   │   ├── Set In-Reply-To header for replies
│   │   ├── Set References header for threading
│   │   ├── Quote original message
│   │   ├── Format quoted text
│   │   └── Preserve thread structure
│   │
│   └── intent-mail-smtp-sent: Sent folder
│       ├── Append sent message to Sent via IMAP
│       ├── Store sent message in local DB
│       ├── Set proper flags on sent message
│       └── Handle Bcc in stored copy (remove)
│
├── intent-mail-imap-mcp: MCP Integration
│   ├── intent-mail-mcp-auth: Update auth tools
│   │   ├── Add authType param to mail_auth_start
│   │   ├── Add email param for IMAP auth
│   │   ├── Add password param for IMAP auth
│   │   ├── Route to IMAP auth flow when authType=imap
│   │   ├── Validate IMAP credentials
│   │   ├── Create account with auth_type=imap
│   │   ├── Return success with account ID
│   │   └── Return clear error on failure
│   │
│   ├── intent-mail-mcp-router: Provider routing
│   │   ├── Create getConnector(accountId) function
│   │   ├── Read auth_type from account
│   │   ├── Return IMAP connector for auth_type=imap
│   │   ├── Return Gmail API for auth_type=oauth
│   │   ├── Lazy-load connectors
│   │   └── Cache connector instances
│   │
│   ├── intent-mail-mcp-sync: Update sync tool
│   │   ├── Get connector via router
│   │   ├── Call connector.sync()
│   │   └── Return unified response format
│   │
│   ├── intent-mail-mcp-search: Update search tool
│   │   ├── Get connector via router
│   │   ├── Call connector.search()
│   │   └── Return unified response format
│   │
│   └── intent-mail-mcp-send: Update send tool
│       ├── Get connector via router
│       ├── Call connector.send()
│       └── Return unified response format
│
├── intent-mail-imap-test: Testing
│   ├── intent-mail-imap-unit: Unit tests
│   │   ├── Test ImapConnection connect/disconnect
│   │   ├── Test credential validation
│   │   ├── Test message parsing
│   │   ├── Test search query translation
│   │   ├── Test SMTP composition
│   │   └── Test attachment handling
│   │
│   └── intent-mail-imap-e2e: Integration tests
│       ├── Test Gmail app password flow
│       ├── Test inbox sync
│       ├── Test email search
│       ├── Test send email
│       ├── Test sent folder sync
│       └── Test full MCP tool flow
│
└── intent-mail-imap-docs: Documentation
    ├── intent-mail-docs-quickstart: QUICKSTART.md
    │   ├── Add "Option A: App Password (30 seconds)"
    │   ├── Step-by-step Gmail app password
    │   ├── Step-by-step Outlook app password
    │   └── Keep "Option B: OAuth (advanced)"
    │
    ├── intent-mail-docs-faq: FAQ.md updates
    │   ├── Add "How do I use app passwords?"
    │   ├── Add "What's the difference?"
    │   └── Add IMAP troubleshooting
    │
    └── intent-mail-docs-readme: README.md
        ├── Add "Two ways to connect" section
        ├── Feature comparison table
        └── Clear recommendation
```

---

## Task Breakdown (Granular)

### Phase 1: MVP Foundation (~3 hours)

| ID | Task | File(s) | Est |
|----|------|---------|-----|
| 1.1 | Add imapflow, nodemailer, mailparser to package.json | package.json | 5m |
| 1.2 | npm install and verify | - | 2m |
| 1.3 | Create src/connectors/imap/ directory | - | 1m |
| 1.4 | Create ImapConfig interface | src/connectors/imap/types.ts | 10m |
| 1.5 | Create ImapConnection class skeleton | src/connectors/imap/connection.ts | 15m |
| 1.6 | Implement connect() with imapflow | src/connectors/imap/connection.ts | 20m |
| 1.7 | Implement disconnect() | src/connectors/imap/connection.ts | 5m |
| 1.8 | Create IMAP_PROVIDERS constant | src/connectors/imap/providers.ts | 15m |
| 1.9 | Create validateCredentials() | src/connectors/imap/auth.ts | 20m |
| 1.10 | Add auth_type column migration | src/storage/migrations.ts | 15m |
| 1.11 | Create storeImapCredentials() | src/storage/services/account-storage.ts | 15m |
| 1.12 | Update mail_auth_start for IMAP | src/mcp/tools/mail-auth-start.ts | 30m |
| 1.13 | Test: Connect Gmail with app password | - | 15m |

**Checkpoint 1:** Can authenticate Gmail with app password ✓

### Phase 2: Email Retrieval (~2 hours)

| ID | Task | File(s) | Est |
|----|------|---------|-----|
| 2.1 | Create listFolders() | src/connectors/imap/folders.ts | 20m |
| 2.2 | Create FOLDER_TO_LABEL mapping | src/connectors/imap/label-mapper.ts | 15m |
| 2.3 | Create fetchMessage(uid) skeleton | src/connectors/imap/messages.ts | 10m |
| 2.4 | Parse headers (From, To, Subject, Date) | src/connectors/imap/messages.ts | 20m |
| 2.5 | Extract plain text body | src/connectors/imap/messages.ts | 15m |
| 2.6 | Extract HTML body | src/connectors/imap/messages.ts | 10m |
| 2.7 | Handle multipart messages | src/connectors/imap/messages.ts | 15m |
| 2.8 | Map to Email interface | src/connectors/imap/messages.ts | 10m |
| 2.9 | Update mail_sync for IMAP | src/mcp/tools/mail-sync.ts | 25m |
| 2.10 | Test: Sync inbox via MCP | - | 15m |

**Checkpoint 2:** Can sync emails from Gmail inbox ✓

### Phase 3: SMTP Send (~1.5 hours)

| ID | Task | File(s) | Est |
|----|------|---------|-----|
| 3.1 | Create SmtpClient class | src/connectors/smtp/client.ts | 20m |
| 3.2 | Configure nodemailer transport | src/connectors/smtp/client.ts | 10m |
| 3.3 | Create composeEmail() | src/connectors/smtp/compose.ts | 20m |
| 3.4 | Build multipart message | src/connectors/smtp/compose.ts | 15m |
| 3.5 | Implement send() | src/connectors/smtp/client.ts | 10m |
| 3.6 | Update mail_send for SMTP | src/mcp/tools/mail-send.ts | 20m |
| 3.7 | Test: Send email via MCP | - | 15m |

**Checkpoint 3:** Can send emails via SMTP ✓

### Phase 4: Search & Polish (~1.5 hours)

| ID | Task | File(s) | Est |
|----|------|---------|-----|
| 4.1 | Create translateQuery() | src/connectors/imap/search.ts | 20m |
| 4.2 | Implement IMAP SEARCH | src/connectors/imap/search.ts | 15m |
| 4.3 | Update mail_search for IMAP | src/mcp/tools/mail-search.ts | 15m |
| 4.4 | Create provider router | src/connectors/router.ts | 20m |
| 4.5 | Update QUICKSTART.md | QUICKSTART.md | 15m |
| 4.6 | Update README.md | README.md | 10m |
| 4.7 | End-to-end test | - | 15m |

**Checkpoint 4:** Full IMAP flow working ✓

---

## Beads to Create

```bash
# Epic
bd create "IMAP/SMTP Connector" -p 1 --type epic \
  --description "Enable app password auth for Gmail/Outlook"

# Stories (children of epic)
bd create "IMAP Infrastructure" -p 1 --type story \
  --description "Connection manager, health checks"

bd create "IMAP Authentication" -p 1 --type story \
  --description "App password validation, credential storage"

bd create "Email Retrieval" -p 1 --type story \
  --description "Folder listing, message fetching"

bd create "SMTP Send" -p 1 --type story \
  --description "Send emails via SMTP"

bd create "MCP Integration" -p 1 --type story \
  --description "Update MCP tools for IMAP/SMTP"

bd create "Documentation" -p 1 --type story \
  --description "QUICKSTART, README updates"
```

---

## Success Criteria

### MVP (Must Have)
- [ ] Gmail app password authentication works
- [ ] Can sync inbox emails
- [ ] Can send emails via SMTP
- [ ] mail_auth_start supports authType: 'imap'
- [ ] QUICKSTART.md has 30-second setup

### Complete (Should Have)
- [ ] All folders sync (not just INBOX)
- [ ] Search works via IMAP
- [ ] All MCP tools work with IMAP accounts
- [ ] Outlook app password works

### Polish (Nice to Have)
- [ ] Incremental sync (UID tracking)
- [ ] Attachment support
- [ ] Threading in replies

---

## Approval

**Status:** Ready for review

Please confirm:
1. Task granularity acceptable?
2. Priorities correct?
3. Proceed with creating beads?

---

**Next Step:** After approval, create beads and begin Phase 1 implementation.
