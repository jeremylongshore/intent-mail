# MCP Session Architecture Research for Claude Code Integration

## Executive Summary

This research document defines the session architecture for integrating IntentMail with Claude Code through the Model Context Protocol (MCP). It covers session lifecycle management, tool exposure patterns, bidirectional communication, permission boundaries, and context persistence strategies for the Agentic OS.

---

## 1. MCP Session Lifecycle Architecture

### 1.1 Three-Phase Lifecycle Model

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP SESSION LIFECYCLE                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ INITIALIZE   │─────→│  OPERATION   │─────→│  SHUTDOWN    │
│  Phase       │      │  Phase       │      │  Phase       │
└──────────────┘      └──────────────┘      └──────────────┘
      ~2s                  ongoing              ~1s
```

#### Phase 1: Initialization (Required)

**Purpose:** Establish protocol compatibility and negotiate capabilities

**Client Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "claude-code",
      "version": "1.0.0"
    }
  }
}
```

**Server Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "intentmail-mcp-server",
      "version": "0.1.0"
    }
  }
}
```

**Key Capability Negotiations:**

| Capability | IntentMail Support | Purpose |
|------------|-------------------|---------|
| `tools.listChanged` | ✅ YES | Notify when available tools change |
| `resources.listChanged` | ✅ YES | Notify when email resources change |
| `resources.subscribe` | ✅ YES | Subscribe to resource changes |
| `prompts.listChanged` | ✅ YES | Notify when automation prompts available |
| `sampling` | ✅ YES | Server can request LLM completions |
| `logging` | ✅ YES | Server can send structured logs |

---

## 2. Tool Exposure Matrix

### Authorization Requirement Levels

| Level | Permission Type | Approval | Risk | Use Case |
|-------|-----------------|----------|------|----------|
| **Open** | None required | Auto | Low | Read-only queries |
| **Protected** | User prompt | Per-use | Medium | Write operations |
| **Restricted** | User auth | Session start | High | OAuth, config |
| **Blocked** | Never | N/A | Critical | Secrets |

### Tool Categories

**Open (No approval):** `health_check`, `mail_list_accounts`, `mail_get_thread`

**Protected (Per-call):** `mail_search`, `mail_send`, `mail_apply_label`, `mail_apply_rule`

**Restricted (Session):** `mail_auth_start`, `mail_auth_complete`

---

## 3. Bidirectional Communication Patterns

### Client → Server (Request-Response)
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "mail_search",
    "arguments": { "query": "from:urgent", "accountId": "acc_001" }
  }
}
```

### Server → Client (Sampling)
```typescript
// Server requests Claude's intelligence for analysis
const analysis = await client.request({
  method: "sampling/createMessage",
  params: {
    messages: [{ role: "user", content: "Analyze this thread..." }]
  }
});
```

### Notifications (Server → Client)
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed",
  "params": { "changedResources": ["intentmail://sync-state"] }
}
```

---

## 4. Context Persistence Strategies

### Session State Structure
```typescript
interface MCPSessionState {
  sessionId: string;
  phase: 'initialize' | 'operation' | 'shutdown';
  connectedAccounts: Account[];
  syncState: {
    gmail: { historyId: string, lastSync: Date },
    outlook: { deltaToken: string, lastSync: Date }
  };
  activeRules: Rule[];
  auditLog: AuditLogEntry[];
}
```

### Persistence Types
- **Database (Persistent):** Accounts, rules, sync state, audit log
- **Memory (Ephemeral):** Current thread, drafts, caches

---

## 5. Resource Management

### MCP Resources for Context References
```typescript
const resources = [
  { uri: "intentmail://accounts/list", name: "Connected Accounts" },
  { uri: "intentmail://rules/active", name: "Active Rules" },
  { uri: "intentmail://thread/{id}", name: "Email Thread" },
  { uri: "intentmail://sync-state", name: "Sync Status" }
];
```

### Usage in Claude Code
```
@intentmail://thread/msg_123    # Reference specific thread
@intentmail://rules/active      # Reference active rules
```

---

## 6. Error Handling

### Error Codes
```typescript
enum IntentMailErrorCode {
  INVALID_QUERY = 1001,
  ACCOUNT_NOT_FOUND = 1002,
  GMAIL_RATE_LIMIT = 1003,
  OUTLOOK_RATE_LIMIT = 1004,
  OAUTH_EXPIRED = 1005,
  SYNC_FAILED = 1007
}
```

### Recovery Strategy
- Rate limit → Exponential backoff
- OAuth expired → Trigger re-auth
- Sync failed → Persist checkpoint, resume later

---

## 7. Implementation for Agentic OS

### ClaudeSessionManager Design
```typescript
class ClaudeSessionManager {
  async createSession(): Promise<ClaudeSession>;
  async resumeSession(id: string): Promise<ClaudeSession>;
  async endSession(id: string): Promise<void>;
  async getActiveSession(): Promise<ClaudeSession | null>;
}
```

### Tool Exposure Layer
```typescript
interface ToolExposureConfig {
  include: string[];      // Tools to expose
  exclude: string[];      // Tools to hide
  rate_limits: Record<string, RateLimit>;
  require_confirmation: string[];  // High-impact tools
}
```

### Delegation Queue
```typescript
class DelegationQueue {
  async enqueue(task: AgentTask): Promise<string>;
  async dequeue(): Promise<AgentTask>;
  async getStatus(taskId: string): Promise<TaskStatus>;
  async cancel(taskId: string): Promise<void>;
}
```

---

## References

- [MCP Lifecycle Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp.md)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-27
**Status:** Research Complete
