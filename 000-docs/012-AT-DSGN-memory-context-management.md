# Vertex AI Agent Engine: Memory & Context Persistence

## Executive Summary

Vertex AI Agent Engine provides two integrated systems for managing agent context and memory:

1. **Sessions API** - Stores conversation history and interaction events
2. **Memory Bank** - Extracts and retrieves personalized, long-term memories across sessions

Together, these enable agents to maintain context within a conversation and learn from previous interactions across all of a user's conversations.

---

## 1. Sessions API: Conversation Context Management

### 1.1 Core Concepts

#### Session
A chronological sequence of messages and actions (events) for a single ongoing interaction between a user and an agent system.

#### Event
Stores the content of conversation and agent actions (function calls, tool use, responses).

#### State
Temporary data relevant only during the current conversation (not persisted across sessions).

#### User ID
Required for all sessions - enables memory isolation and association.

### 1.2 Session Lifecycle

```
Create New Session
    ↓
[Active Session - Accepting Events]
    ├→ User sends message (Create Event)
    ├→ Agent responds (Create Event)
    ├→ Agent calls tool (Create Event)
    ├→ Tool returns result (Create Event)
    └→ Continue conversation...
    ↓
Pause/Resume Session
    ├→ Retrieve session (get_session)
    ├→ Load conversation history
    ├→ Resume where left off
    └→ Continue appending events
    ↓
Delete Session
    └→ Cleanup conversation history
```

### 1.3 Session Management Operations

| Operation | Purpose | Returns |
|-----------|---------|---------|
| **Create Session** | Start new conversation | Session ID |
| **Append Event** | Add message/action to session | Updated session |
| **Get Session** | Retrieve full conversation | All events + metadata |
| **List Sessions** | Find user's conversations | Session summaries |
| **Delete Session** | Cleanup old conversations | Confirmation |

### 1.4 Event Types

```
Session Events:
├── USER_MESSAGE
│   └─ Content: User text input
├── AGENT_RESPONSE
│   └─ Content: Agent generated response
├── TOOL_CALL
│   ├─ Tool name
│   ├─ Parameters
│   └─ Execution status
├── TOOL_RESULT
│   ├─ Output
│   ├─ Success/failure
│   └─ Metadata
└── FUNCTION_CALL (ADK-specific)
    ├─ Function details
    └─ Return values
```

---

## 2. Memory Bank: Persistent Long-Term Memory

### 2.1 Purpose & Benefits

Memory Bank solves the "context window limitation" problem by:
- **Extracting Knowledge**: Automatically create memories from sessions
- **Personalizing Interactions**: Tailor responses based on learned preferences
- **Cross-Session Continuity**: Maintain context across multiple conversations
- **Reducing Token Usage**: Store facts instead of full conversation history

### 2.2 Memory Architecture

```
Session Conversation
    ↓
Event Stream
    ├→ "User prefers email over Slack"
    ├→ "Deadline: Friday EOD"
    ├→ "Manager: John Smith"
    └→ More facts...
    ↓
Memory Extraction (Automatic)
    └→ Process events to identify knowledge
    ↓
Memory Bank Storage (Per User ID)
    ├→ Memory 1: "Prefers email communication"
    ├→ Memory 2: "Works with John Smith"
    ├→ Memory 3: "Friday EOD deadlines"
    └→ More facts...
    ↓
Next Session (Same User)
    ├→ Retrieve relevant memories
    ├→ Inject into agent context
    └→ Personalized responses
```

### 2.3 Memory Types

| Memory Type | Format | Use Case |
|-------------|--------|----------|
| **Factual** | "User has 3 direct reports" | Factual information |
| **Preference** | "Prefers morning meetings" | User preferences |
| **History** | "Previously worked at Google" | Background information |
| **Relationship** | "Reports to Sarah" | Relationship mapping |
| **Context** | "Working on Q4 planning" | Current context |

### 2.4 Memory Retrieval Mechanisms

#### Full Memory Retrieval
```python
# Get all memories for a user
memories = memory_bank.list_memories(
    user_id="user-123"
)
# Returns: All fact memories across all previous sessions
```

#### Similarity Search (Embedding-based)
```python
# Intelligent retrieval based on current context
memories = memory_bank.search_memories(
    user_id="user-123",
    query="email preferences",
    limit=5
)
# Returns: Top 5 memories most relevant to "email preferences"
```

#### Filtered Retrieval
```python
# Get specific memory categories
memories = memory_bank.get_memories(
    user_id="user-123",
    category="preferences",
    time_range="last_30_days"
)
```

---

## 3. Session Management in ADK

### 3.1 Session Service Options

#### InMemorySessionService (Development)
```python
# For local development and testing
from adk.sessions import InMemorySessionService

session_service = InMemorySessionService()

# All session data stored in application memory
# Lost on application restart
```

**Best For**: Local development, examples, quick testing

**Persistence**: None

**Requirements**: None (no external services)

#### VertexAiSessionService (Production)
```python
# For production deployments with Vertex AI infrastructure
from adk.sessions import VertexAiSessionService

session_service = VertexAiSessionService(
    project_id="your-gcp-project",
    location="us-central1"
)

# Session data managed by Vertex AI Agent Engine
# Persistent across application restarts
# Automatic Memory Bank integration
```

**Best For**: Production deployments

**Persistence**: Yes (Vertex AI managed)

**Requirements**: Deployed to Agent Engine Runtime

### 3.2 ADK Session Integration Pattern

```python
from adk import LlmAgent
from adk.sessions import VertexAiSessionService

class EmailAgent(LlmAgent):
    def __init__(self):
        self.session_service = VertexAiSessionService()

    async def handle_request(self, user_id: str, user_message: str):
        # Get or create session
        session = self.session_service.get_or_create_session(
            user_id=user_id,
            application_id="intent-mail"
        )

        # Add user message as event
        self.session_service.append_event(
            session_id=session.id,
            event_type="USER_MESSAGE",
            content=user_message
        )

        # Process with agent
        response = await self.process(user_message, session)

        # Add agent response as event
        self.session_service.append_event(
            session_id=session.id,
            event_type="AGENT_RESPONSE",
            content=response
        )

        return response
```

---

## 4. Memory Bank Integration

### 4.1 Automatic Memory Generation

```
Session Flow:
1. User: "Schedule meeting with John on Friday EOD"
2. Agent: Extracts from context
   └─ "User wants Friday EOD deadlines"
3. User: "Add my direct reports to Slack"
4. Agent: Extracts
   └─ "User has direct reports"
   └─ "User uses Slack for team communication"
5. User: Next session, days later
6. Agent: Retrieves relevant memories
   └─ "User has Friday EOD deadlines"
   └─ "User uses Slack for teams"
   └─ Apply to new request
```

### 4.2 Memory TTL (Time-to-Live)

```python
# Automatic expiration of stale information
memory_config = {
    "ttl_seconds": 7776000,  # 90 days default
    "auto_delete": True,     # Remove expired memories
    "allow_override": False   # Prevent manual TTL changes
}

memory_bank = MemoryBank(config=memory_config)

# Memories older than 90 days auto-deleted
# Fresh memories extended on access
```

### 4.3 Memory Revisions

Memory Bank automatically maintains history of how memories evolve:

```
Memory: "User works with John"
├─ Revision 1: "John Smith (colleague)" [Created]
├─ Revision 2: "John Smith (manager)" [Updated]
├─ Revision 3: "John Smith (ex-manager)" [Updated]
└─ Current: "John Smith (ex-manager, now at different org)"

Benefits:
- Audit trail of context evolution
- Detect relationship changes
- Revert to previous state if needed
- Understand context drift
```

---

## 5. Memory & Context Management Patterns

### 5.1 Complete Workflow: New User, First Request

```
1. User Message: "Can you help me schedule a meeting?"
   └─ No session exists for user_id: "user-123"

2. Create Session
   └─ session_id: "sess-456"

3. Check Memory Bank
   └─ User is new, no prior memories

4. Agent Processes Request
   └─ No historical context available
   └─ Generic response

5. Save Events to Session
   ├─ USER_MESSAGE: "Schedule meeting request"
   └─ AGENT_RESPONSE: "I can help..."

6. Memory Extraction (Background)
   └─ No memories generated (first interaction)
```

### 5.2 Returning User, Second Request (Days Later)

```
1. User Message: "Schedule Friday meeting, same attendees"
   └─ User: "user-123"

2. Retrieve Existing Session
   └─ Return conversation history from first request

3. Retrieve Memories
   └─ Memory: "User schedules meetings with X, Y, Z"
   └─ Memory: "User prefers Friday afternoons"

4. Agent Processes Request
   ├─ Loads session history
   ├─ Injects relevant memories
   └─ Generates personalized response
   └─ "I'll schedule for Friday 3 PM with X, Y, Z"

5. Save Events
   └─ Append to existing session (maintains history)

6. Memory Extraction
   └─ "User prefers Friday afternoon meetings" (confirmed)
```

### 5.3 Multi-Session Learning Pattern

```
Session 1 (Monday):
├─ User: "Email John about the Q4 plan"
└─ Memory: "User communicates with John about Q4"

Session 2 (Wednesday):
├─ User: "Draft proposal for Q4"
└─ Memory: "User working on Q4 proposal"

Session 3 (Friday):
├─ User: "Include John's feedback in final"
├─ Agent: Retrieves memories
│  ├─ John mentioned in context
│  ├─ Q4 proposal ongoing
│  └─ Predicts: "Send to John for Q4 discussion"
└─ Memory: "John key stakeholder for Q4"
```

---

## 6. Session Data Structure

### 6.1 Session Object Schema

```json
{
  "session_id": "sess-123",
  "user_id": "user-456",
  "application_id": "intent-mail",
  "created_at": "2025-12-27T10:00:00Z",
  "updated_at": "2025-12-27T14:30:00Z",
  "state": "ACTIVE",
  "events": [
    {
      "event_id": "evt-001",
      "timestamp": "2025-12-27T10:05:00Z",
      "type": "USER_MESSAGE",
      "content": "Schedule meeting with John",
      "metadata": {
        "source": "web_ui"
      }
    },
    {
      "event_id": "evt-002",
      "timestamp": "2025-12-27T10:05:15Z",
      "type": "AGENT_RESPONSE",
      "content": "I'll help you schedule...",
      "model": "gemini-2.5-flash",
      "metadata": {
        "latency_ms": 250
      }
    },
    {
      "event_id": "evt-003",
      "timestamp": "2025-12-27T10:05:30Z",
      "type": "TOOL_CALL",
      "tool_name": "get_calendar_slots",
      "parameters": {
        "attendee": "john@example.com",
        "date": "2025-12-27"
      }
    },
    {
      "event_id": "evt-004",
      "timestamp": "2025-12-27T10:05:45Z",
      "type": "TOOL_RESULT",
      "tool_name": "get_calendar_slots",
      "success": true,
      "content": "Available: 2:00 PM, 3:30 PM"
    }
  ],
  "memory_references": [
    "mem-789",  // User prefers afternoon meetings
    "mem-790"   // Works with John frequently
  ]
}
```

### 6.2 Memory Object Schema

```json
{
  "memory_id": "mem-789",
  "user_id": "user-456",
  "content": "User prefers afternoon meetings",
  "category": "preferences",
  "created_at": "2025-12-20T14:00:00Z",
  "updated_at": "2025-12-27T10:30:00Z",
  "last_accessed": "2025-12-27T14:30:00Z",
  "expires_at": "2026-03-27T10:30:00Z",
  "confidence": 0.95,
  "source_session": "sess-100",
  "revisions": [
    {
      "version": 1,
      "content": "User prefers afternoon meetings",
      "timestamp": "2025-12-20T14:00:00Z"
    },
    {
      "version": 2,
      "content": "User prefers 2-3 PM meetings",
      "timestamp": "2025-12-25T09:00:00Z"
    }
  ]
}
```

---

## 7. Best Practices for Memory Management

### 7.1 User Privacy & Data Isolation
```python
# CRITICAL: Isolate memories by user
# Always use correct user_id

def process_request(user_id: str, request: str):
    # Get session for THIS user only
    session = session_service.get_session_by_user(user_id)

    # Retrieve memories for THIS user only
    memories = memory_bank.get_memories(user_id=user_id)

    # Never mix data between users
    if session.user_id != user_id:
        raise Exception("User ID mismatch")

    return agent.process(request, session, memories)
```

### 7.2 Memory Relevance Optimization
```python
# Use similarity search for relevant context
def get_context(user_id: str, current_topic: str):
    # Similarity search returns most relevant memories
    memories = memory_bank.search_memories(
        user_id=user_id,
        query=current_topic,
        limit=5  # Top 5 most relevant
    )

    # Inject into agent prompt
    context = format_memories(memories)
    return context
```

### 7.3 Memory Quality Maintenance
```python
# Periodic cleanup and consolidation
def maintain_memories(user_id: str):
    # Remove duplicate/contradictory memories
    duplicates = memory_bank.find_duplicates(user_id)
    for dup in duplicates:
        memory_bank.merge_memories(dup['ids'])

    # Archive old memories
    old_memories = memory_bank.get_memories(
        user_id=user_id,
        before="2025-12-01"
    )
    for mem in old_memories:
        memory_bank.archive(mem['id'])
```

### 7.4 Session Pruning
```python
# Cleanup old completed sessions
def cleanup_sessions(user_id: str, days=90):
    old_sessions = session_service.list_sessions(
        user_id=user_id,
        before=days_ago(days)
    )

    for session in old_sessions:
        # Archive before deleting
        archive_session(session)
        session_service.delete_session(session['id'])
```

---

## 8. Implementation for Intent Mail

### 8.1 Session Configuration
```python
# Intent Mail session setup
from adk.sessions import VertexAiSessionService
from vertexai.agents import MemoryBank

class IntentMailAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.session_service = VertexAiSessionService()
        self.memory_bank = MemoryBank()
        self.current_session = None

    async def start_conversation(self):
        """Create or retrieve user's session"""
        self.current_session = self.session_service.get_or_create_session(
            user_id=self.user_id,
            application_id="intent-mail",
            metadata={
                "agent_version": "1.0",
                "capabilities": ["email", "calendar", "scheduling"]
            }
        )
```

### 8.2 Memory Usage for Email Context
```python
async def compose_email(self, intent: str):
    """Use memories for email composition"""

    # Get relevant memories
    memories = self.memory_bank.search_memories(
        user_id=self.user_id,
        query=intent,
        limit=5
    )

    # Format for agent
    memory_context = "\n".join([
        f"- {m['content']}" for m in memories
    ])

    # Agent uses context
    prompt = f"""
    User intent: {intent}

    Known context:
    {memory_context}

    Generate email based on intent and context.
    """

    response = await self.agent.generate(prompt)

    # Save to session
    self.session_service.append_event(
        session_id=self.current_session.id,
        event_type="AGENT_RESPONSE",
        content=response
    )

    return response
```

### 8.3 Typical Memory for Email Agent
```
Memory Examples for Intent Mail User:

1. "User sends most emails to team@example.com"
2. "User prefers morning meeting times (9-11 AM)"
3. "Manager is Sarah Chen"
4. "User has direct reports: Alice, Bob, Carol"
5. "User prefers brief bullet-point emails"
6. "CC: manager on project updates"
7. "User works on quarterly planning (Q4)"
8. "User timezone is Pacific Time"
9. "User's email signature includes phone number"
10. "User has weekly Monday team sync"
```

---

## 9. Troubleshooting Memory & Sessions

### 9.1 Session Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Session Not Found** | Wrong user_id or session deleted | Verify user_id matches, create new session |
| **Events Not Persisted** | Service misconfiguration | Check VertexAiSessionService setup |
| **Session Expired** | No retention policy configured | Set session TTL in service config |

### 9.2 Memory Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Memories Not Generated** | No background extraction running | Check Memory Bank configuration |
| **Wrong Memories Retrieved** | Poor similarity matching | Refine query, check memory content |
| **Memory Conflicts** | Contradictory information stored | Use merge/archive operations |
| **Privacy Leak** | Using wrong user_id | Verify user_id isolation |

---

## Document Version
- **Version**: 1.0
- **Last Updated**: December 2025
- **Source**: Official Vertex AI Agent Engine Sessions and Memory Bank documentation
