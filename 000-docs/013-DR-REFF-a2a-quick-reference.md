# A2A Protocol Quick Reference

## 1. AgentCard Template

```json
{
  "name": "Intent Mail Agent",
  "description": "Processes and classifies incoming emails with intelligent responses",
  "version": "1.0.0",
  "url": "https://intent-mail.example.com/",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "parse_email",
      "name": "Parse Email",
      "description": "Extracts sender, recipient, subject, and body from email",
      "tags": ["email", "parsing"],
      "examples": ["Parse this email message", "Extract email components"],
      "inputModes": ["text/plain"],
      "outputModes": ["application/json"]
    },
    {
      "id": "classify_intent",
      "name": "Classify Intent",
      "description": "Determines intent category (support, sales, billing, etc.)",
      "tags": ["classification", "intent"],
      "examples": ["What is the intent of this email?", "Classify this message"],
      "inputModes": ["text/plain"],
      "outputModes": ["application/json"]
    },
    {
      "id": "generate_response",
      "name": "Generate Response",
      "description": "Creates appropriate response based on email intent",
      "tags": ["response", "generation"],
      "examples": ["Generate a response to this email"],
      "inputModes": ["application/json"],
      "outputModes": ["text/plain"]
    }
  ],
  "supportsAuthenticatedExtendedCard": true
}
```

## 2. Message Format Examples

### Send Message Request
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "input": {
      "parts": [
        {
          "type": "text/plain",
          "text": "From: user@example.com\nTo: support@company.com\nSubject: Issue with order\n\nI have a problem with my recent order #12345"
        }
      ],
      "skillId": "parse_email"
    }
  },
  "id": "msg-001"
}
```

### Task Status Response
```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-001",
      "contextId": "conversation-123",
      "status": {
        "state": "completed",
        "timestamp": "2025-12-27T10:30:15Z"
      },
      "artifacts": [
        {
          "artifactId": "result-001",
          "name": "Parsed Email",
          "parts": [
            {
              "type": "application/json",
              "data": {
                "from": "user@example.com",
                "to": "support@company.com",
                "subject": "Issue with order",
                "body": "I have a problem with my recent order #12345"
              }
            }
          ]
        }
      ]
    }
  },
  "id": "msg-001"
}
```

## 3. Task State Transitions

```
Task Lifecycle:
SUBMITTED → WORKING → COMPLETED ✓
   ↓          ↓
 REJECTED  FAILED ✓
   ↓
 INPUT_REQUIRED → WORKING → COMPLETED ✓
   ↓
 AUTH_REQUIRED → WORKING → COMPLETED ✓

Terminal States: COMPLETED, FAILED, REJECTED, CANCELLED
```

## 4. Python Code Patterns

### Create Agent
```python
from adk import Agent

class IntentMailAgent(Agent):
    def __init__(self):
        super().__init__(
            name="Intent Mail Agent",
            instructions="Process and respond to emails intelligently"
        )

    async def run(self, session, user_input):
        # Parse email
        parsed = self.parse_email(user_input)

        # Classify intent
        intent = self.classify_intent(parsed["body"])

        # Store in session
        session.state["last_intent"] = intent

        # Generate response
        response = self.generate_response(parsed, intent)

        return response
```

### Expose as A2A
```python
from adk import AdkApp
from a2a import A2aServer

agent = IntentMailAgent()
app = AdkApp(
    agent=agent,
    session_service="agent_engine"
)

a2a_server = A2aServer.expose(app=app, port=8080)
# Auto-generates: /.well-known/agent-card.json
# Auto-exposes: /run endpoint for A2A messages
```

### Call Remote Agent
```python
from a2a.client import A2aClient

# Create client for remote agent
classifier_agent = A2aClient("https://classifier-agent.example.com")

# Send message
task = classifier_agent.send_message(
    parts=[TextPart(text="What is the intent?")],
    skill_id="classify_intent"
)

# Poll for result
while True:
    status = classifier_agent.get_task(task.id)
    if status.state == "completed":
        return status.artifacts[0]
    elif status.state == "failed":
        raise Exception(status.message)
    await asyncio.sleep(1)
```

## 5. Session Management

```python
from adk import SessionService

# Session automatically created
session = SessionService.create(
    user_id="user-123",
    conversation_history=[],
    state={}
)

# Store conversation context
session.state["email_id"] = "email-456"
session.state["sender"] = "user@example.com"

# Session persists across multiple turns
existing = SessionService.get(id=session.id)
print(existing.state["email_id"])  # Still available
```

## 6. Error Handling Patterns

### Retry with Backoff
```python
async def call_agent_with_retry(agent, message, max_retries=3):
    for attempt in range(max_retries):
        try:
            task = agent.send_message(message)
            return task
        except TransientError:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1, 2, 4 seconds
                await asyncio.sleep(wait)
            else:
                raise
```

### Handle Task Failures
```python
status = agent.get_task(task.id)

if status.state == "completed":
    return status.artifacts
elif status.state == "failed":
    logger.error(f"Task failed: {status.message}")
    # Retry or use fallback
elif status.state == "input_required":
    # Collect user input and continue
    clarification = await get_user_input()
    agent.send_message(
        parts=[TextPart(text=clarification)],
        context_id=task.context_id
    )
```

## 7. Multimodal Content Examples

### Text + Structured Data
```python
from a2a.types import Message, TextPart, DataPart

message = Message(
    parts=[
        TextPart(text="Process the following email with preferences:"),
        DataPart(data={
            "priority": "high",
            "response_style": "professional",
            "include_attachments": True
        })
    ],
    skill_id="generate_response"
)
```

### Text + File Attachment
```python
message = Message(
    parts=[
        TextPart(text="Analyze this email thread:"),
        FilePart(
            type="text/plain",
            name="email-thread.txt",
            data="base64_encoded_content"
        )
    ]
)
```

## 8. Deployment Checklist

- [ ] Define skills in AgentCard
- [ ] Implement agent logic in ADK
- [ ] Expose as A2A server
- [ ] Generate and verify agent card at `/.well-known/agent-card.json`
- [ ] Test locally with A2A SDK
- [ ] Deploy to Cloud Run or Agent Engine
- [ ] Configure session service
- [ ] Set up monitoring and logging
- [ ] Implement error handling
- [ ] Test inter-agent communication
- [ ] Document API in agent card

## 9. Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/agent-card.json` | GET | Fetch agent capabilities (discovery) |
| `/run` | POST | Send message to agent (A2A message/send) |
| `/tasks/{taskId}` | GET | Get task status and results |
| `/tasks/{taskId}/cancel` | POST | Cancel a running task |
| `/agent-card` | GET | Legacy endpoint (use .well-known path) |

## 10. Supported MIME Types

**Input/Output**:
- Text: `text/plain`, `text/html`, `text/markdown`
- Images: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- Audio: `audio/wav`, `audio/mp3`, `audio/ogg`
- Video: `video/mp4`, `video/webm`
- Data: `application/json`, `application/xml`
- Documents: `application/pdf`, `text/csv`

## 11. Security & Authentication

```python
# Define authentication in agent card
security_schemes = [
    {
        "type": "oauth2",
        "flows": {
            "clientCredentials": {
                "tokenUrl": "https://example.com/oauth/token"
            }
        }
    }
]

# Add to AgentCard
agent_card.security_schemes = security_schemes

# Client authentication
headers = {
    "Authorization": "Bearer <access_token>"
}
```

## 12. Monitoring & Observability

```python
# ADK + Agent Engine auto-logs to Cloud Logging
# Enable tracing
from google.cloud import trace_v2

tracer = trace_v2.TraceServiceClient()

# ADK automatically:
# - Logs all message sends to Cloud Logging
# - Traces execution paths via Cloud Trace
# - Reports metrics to Cloud Monitoring
# - Tracks session state changes
```

---

## Common Patterns for Intent Mail

### Pattern 1: Sequential Processing
```
Email → Parser Agent → Classifier Agent → Response Generator → Result
```

### Pattern 2: Parallel Processing
```
Email → [ Parser Agent
          Classifier Agent  ] → Response Generator → Result
          Metadata Agent
```

### Pattern 3: Conditional Routing
```
Email → Classifier → Support Queue  (if support inquiry)
                   → Sales Queue     (if sales inquiry)
                   → Billing Queue   (if billing inquiry)
```

### Pattern 4: Context Preservation
```
Email 1 → Session-123 → Parser → Stored in session.state
Email 2 → Session-123 → Classifier (has context from Email 1)
Email 3 → Session-123 → Generator (full conversation history)
```

---

## Useful Commands

```bash
# Deploy A2A agent to Cloud Run
gcloud run deploy intent-mail-agent \
  --source . \
  --runtime python311 \
  --set-env-vars AGENTS_ENABLED=true

# View agent card
curl https://intent-mail-agent.example.com/.well-known/agent-card.json

# Send message to agent
curl -X POST https://intent-mail-agent.example.com/run \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {...},
    "id": "msg-001"
  }'

# Check task status
curl https://intent-mail-agent.example.com/tasks/task-001

# View logs
gcloud logs read "resource.type=cloud_run_revision" \
  --limit 50
```

---

## References

- Full Research: `A2A_PROTOCOL_RESEARCH.md`
- Official Spec: https://a2a-protocol.org/latest/specification/
- ADK Docs: https://google.github.io/adk-docs/
- Codelabs: https://codelabs.developers.google.com/intro-a2a-purchasing-concierge
