# Google Agent-to-Agent (A2A) Protocol Research

## Executive Summary

The **Agent2Agent (A2A) Protocol** is an open standard designed by Google to enable seamless communication and collaboration between AI agents regardless of their underlying framework, vendor, or deployment location. It standardizes agent-to-agent interactions using JSON-RPC over HTTP(S), allowing agents from different ecosystems (ADK, LangGraph, CrewAI, Crew.ai, etc.) to communicate as first-class agentic entities rather than as tools.

**Current Version**: 0.3.0 (production-ready as of Q4 2025)

**Industry Support**: 150+ organizations including Box, Salesforce, ServiceNow, UiPath, Deloitte, Accenture, Adobe, Elastic, and others.

---

## 1. Protocol Overview

### 1.1 What is A2A?

A2A is an open standard enabling direct, standardized communication and collaboration between different AI agents. It facilitates:

- **Agent Discovery**: Agents advertise capabilities via Agent Cards (JSON metadata)
- **Task Delegation**: Agents can delegate work to specialized remote agents
- **Multi-Turn Conversations**: Maintaining context across agent-to-agent interactions
- **Interoperability**: Communication across different frameworks without vendor lock-in
- **Enterprise Security**: Built-in authentication, authorization, and enterprise controls

### 1.2 Design Philosophy

A2A follows five core design principles:

1. **Agentic Capabilities** - Agents collaborate in natural, unstructured ways without requiring shared memory or tools
2. **Existing Standards** - Built on HTTP, SSE (Server-Sent Events), and JSON-RPC for easier adoption
3. **Enterprise Security** - Includes authentication and authorization matching OpenAPI standards
4. **Long-Running Tasks** - Supports complex work spanning hours or days with real-time feedback
5. **Multiple Modalities** - Handles text, audio, video, and structured data communication

### 1.3 Key Problem Solved

Traditional single-agent systems struggle when tasks require specialized expertise across multiple domains. A2A solves this by:

- Enabling agents to remain autonomous and specialized
- Allowing seamless handoffs without system consolidation
- Maintaining context across heterogeneous agent systems
- Supporting dynamic agent selection and discovery

---

## 2. Protocol Specification

### 2.1 Architecture Layers

A2A uses a three-layer design:

```
┌─────────────────────────────────────────────────┐
│  Concrete Bindings (JSON-RPC, gRPC, HTTP/REST) │
├─────────────────────────────────────────────────┤
│  Abstract Operations (Protocol-independent)     │
├─────────────────────────────────────────────────┤
│  Canonical Model (Protocol Buffers)             │
└─────────────────────────────────────────────────┘
```

This separation ensures semantic consistency while allowing multiple transport mechanisms.

### 2.2 Core Operations

An A2A-compliant agent exposes these fundamental operations:

| Operation | Description | Use Case |
|-----------|-------------|----------|
| **Send Message** | Initiates agent communication by sending a new message | Starting a task or continuing conversation |
| **Stream Message** | Real-time updates during message processing | Long-running tasks, progress updates |
| **Get Task** | Retrieves status and artifacts of existing task | Polling for task completion |
| **List Tasks** | Retrieves all tasks for a client | Task discovery and management |
| **Cancel Task** | Terminates a running task | Error recovery, timeouts |
| **Push Notifications** | Webhook-based asynchronous updates | Event-driven architectures |
| **Get Extended Card** | Authenticated capability discovery | User-specific permissions and features |

### 2.3 Transport Protocols

A2A supports multiple bindings:

- **JSON-RPC 2.0 over HTTP(S)** - Primary binding, text-based
- **gRPC** - High-performance, binary serialization
- **HTTP/REST** - RESTful endpoints for broader compatibility
- **Server-Sent Events (SSE)** - Streaming responses for long-running tasks

---

## 3. Data Structures

### 3.1 AgentCard (Discovery Mechanism)

The AgentCard is a JSON metadata document (served at `/.well-known/agent-card.json`) describing the agent's capabilities.

#### AgentCard Structure

```python
class AgentCard:
    # Basic Identity
    name: str                          # Agent name
    description: str                   # Human-readable description
    version: str                       # Agent version (e.g., "1.0.0")

    # Service Configuration
    url: str                           # Service endpoint URL

    # Capabilities Declaration
    capabilities: AgentCapabilities    # Supported features
    default_input_modes: List[str]     # Default MIME types for input
    default_output_modes: List[str]    # Default MIME types for output

    # Functional Description
    skills: List[AgentSkill]           # Discrete capabilities

    # Security Configuration
    security_schemes: List[SecurityScheme]  # Auth requirements (OAuth2, API keys, mTLS)

    # Advanced Features
    supports_authenticated_extended_card: bool  # Extended card availability
    signature: Optional[AgentCardSignature]    # JWS cryptographic signature (RFC 7515)
```

#### AgentCapabilities

```python
class AgentCapabilities:
    streaming: bool                    # Supports Server-Sent Events
    push_notifications: bool           # Supports webhook push notifications
    state_transition_history: bool     # Exposes task state change history
```

#### AgentSkill Structure

```python
class AgentSkill:
    id: str                            # Unique skill identifier
    name: str                          # Human-readable skill name
    description: str                   # Detailed description of capability
    tags: List[str]                    # Categorization tags
    examples: List[str]                # Example queries/invocations
    input_modes: List[str]             # Supported input MIME types
    output_modes: List[str]            # Supported output MIME types
```

#### Example AgentCard (Python)

```python
from a2a.types import AgentCard, AgentCapabilities, AgentSkill

skill = AgentSkill(
    id='currency_conversion',
    name='Convert Currency',
    description='Converts between different currencies using live rates',
    tags=['finance', 'conversion'],
    examples=[
        'Convert 100 USD to EUR',
        'What is 50 GBP in JPY?'
    ],
    input_modes=['text/plain'],
    output_modes=['text/plain', 'application/json']
)

agent_card = AgentCard(
    name='Currency Exchange Agent',
    description='Real-time currency conversion and exchange rates',
    version='1.0.0',
    url='https://currency-agent.example.com/',
    default_input_modes=['text/plain'],
    default_output_modes=['text/plain'],
    capabilities=AgentCapabilities(
        streaming=True,
        push_notifications=False,
        state_transition_history=True
    ),
    skills=[skill],
    supports_authenticated_extended_card=True
)
```

### 3.2 Message Format (JSON-RPC 2.0)

Messages follow JSON-RPC 2.0 specification for standardized request/response handling.

#### Request Message

```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "input": {
      "parts": [
        {
          "type": "text/plain",
          "text": "Convert 100 USD to EUR"
        }
      ],
      "skillId": "currency_conversion"
    }
  },
  "id": "request-123"
}
```

#### Response Message (Task-Based)

```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-456",
      "contextId": "context-789",
      "status": {
        "state": "working",
        "message": "Processing currency conversion...",
        "timestamp": "2025-12-27T10:30:00Z"
      }
    }
  },
  "id": "request-123"
}
```

#### Task Status Response

```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-456",
      "contextId": "context-789",
      "status": {
        "state": "completed",
        "timestamp": "2025-12-27T10:30:15Z"
      },
      "artifacts": [
        {
          "artifactId": "artifact-001",
          "name": "Conversion Result",
          "parts": [
            {
              "type": "text/plain",
              "text": "100 USD = 92.50 EUR (as of 2025-12-27)"
            }
          ]
        }
      ]
    }
  },
  "id": "request-123"
}
```

### 3.3 Task States and Lifecycle

#### TaskState Enumeration

```python
class TaskState(Enum):
    SUBMITTED = "submitted"            # Task accepted, queued
    WORKING = "working"                # Task execution in progress
    COMPLETED = "completed"            # Task finished successfully (Terminal)
    FAILED = "failed"                  # Task execution failed (Terminal)
    CANCELLED = "cancelled"            # Task cancelled by client (Terminal)
    REJECTED = "rejected"              # Task rejected before processing (Terminal)
    INPUT_REQUIRED = "input_required"  # Awaiting additional client input
    AUTH_REQUIRED = "auth_required"    # Awaiting secondary authentication
    UNKNOWN = "unknown"                # State cannot be determined
```

#### TaskStatus Structure

```python
class TaskStatus:
    state: TaskState                   # Current lifecycle state
    message: Optional[str]             # Optional status update message
    timestamp: Optional[str]           # ISO 8601 timestamp of status
```

#### Task Lifecycle Flow

```
[SUBMITTED] -> [WORKING] -> [COMPLETED]
    |                       |
    +-> [REJECTED]         +-> [FAILED]
    |
    +-> [INPUT_REQUIRED] -> [WORKING] -> [COMPLETED/FAILED]
    |
    +-> [AUTH_REQUIRED] -> [WORKING] -> [COMPLETED/FAILED]
    |
    +-> [CANCELLED] (can occur at any non-terminal state)
```

#### Key Rules

- **Terminal States**: COMPLETED, FAILED, CANCELLED, REJECTED cannot transition to other states
- **Restarting**: Tasks in terminal states cannot be restarted
- **Context Preservation**: Tasks maintain a `contextId` for conversation continuity
- **History**: Messages can include full history for multi-turn interactions

### 3.4 Message Parts and Artifacts (Multimodal Support)

#### Part Types

A2A supports three primary part types for flexible content representation:

```python
class TextPart:
    type: str = "text/plain"          # MIME type
    text: str                          # Plain text content

class FilePart:
    type: str                          # MIME type (e.g., "image/png")
    name: str                          # Filename
    data: Optional[str]                # Base64-encoded file content
    uri: Optional[str]                 # Alternative: external URI reference

class DataPart:
    type: str = "application/json"    # MIME type
    data: Dict[str, Any]              # Structured JSON data
```

#### Supported MIME Types

- **Text**: `text/plain`, `text/html`, `text/markdown`
- **Images**: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- **Audio**: `audio/wav`, `audio/mp3`, `audio/ogg`
- **Video**: `video/mp4`, `video/webm`, `video/quicktime`
- **Structured**: `application/json`, `application/xml`
- **Documents**: `application/pdf`, `text/csv`

#### Message Structure with Multiple Parts

```python
class Message:
    parts: List[Union[TextPart, FilePart, DataPart]]  # At least 1 required
    skill_id: Optional[str]                            # Target skill
    context_id: Optional[str]                          # Conversation context

# Example: Message with text and JSON data
message = Message(
    parts=[
        TextPart(text="Process the following user preferences:"),
        DataPart(data={
            "currency": "EUR",
            "precision": 2,
            "historical": True
        })
    ],
    skill_id="currency_conversion"
)
```

#### Artifact Structure

```python
class Artifact:
    artifact_id: str                   # Unique identifier
    name: str                          # Human-readable name
    parts: List[Union[TextPart, FilePart, DataPart]]  # Composed of parts
    created_at: Optional[str]          # ISO 8601 timestamp
```

---

## 4. Integration with Google Cloud Services

### 4.1 Vertex AI Agent Engine Integration

Vertex AI Agent Engine provides production infrastructure for A2A agents:

#### Services Provided

| Service | Purpose |
|---------|---------|
| **Agent Runtime** | Managed execution environment for A2A agents |
| **Session Service** | Automatic session state and conversation history management |
| **Memory Bank** | Long-term memory storage across multiple sessions |
| **Tracing & Logging** | Complete observability for agent interactions |
| **Monitoring** | Production metrics, alerts, and SLA tracking |

#### Deployment Flow

```
Local Development
    ↓
[AdkApp + A2A Server]
    ↓
Deploy to Agent Engine
    ↓
[Managed Runtime + Sessions + Memory + Monitoring]
    ↓
A2A-compliant endpoint on Agent Engine
```

### 4.2 Session Management

ADK and Agent Engine provide comprehensive session handling:

#### Session Lifecycle

```python
from adk import SessionService

# Session is created when agent starts
session = SessionService.create(
    id="session-123",
    user_id="user-456",
    conversation_history=[],  # Events
    state={}                  # Working memory
)

# State: agent's short-term working memory
session.state['collected_preferences'] = {'currency': 'EUR'}

# History: all interaction events
session.events.append(Event(
    role="user",
    content="Convert 100 USD",
    timestamp="2025-12-27T10:30:00Z"
))

# Session persists across multiple turns
# Retrieve existing session by ID
existing_session = SessionService.get(id="session-123")
```

#### State vs. Memory

| Aspect | State (Session-Level) | Memory (Cross-Session) |
|--------|----------------------|----------------------|
| **Scope** | Single conversation | Across multiple sessions |
| **Lifetime** | Duration of session | Long-term (days/weeks) |
| **Storage** | Session Service | Memory Bank |
| **Use Case** | Immediate context | User preferences, history |
| **Example** | Current order items | User shopping history |

### 4.3 Agent Development Kit (ADK) Integration

ADK is the Python framework for building A2A agents:

#### ADK + A2A Architecture

```python
from adk import Agent, SessionService
from a2a import A2aServer, AgentCard

class CurrencyAgent(Agent):
    """ADK-based agent exposing A2A interface"""

    async def run(self, session, user_input):
        # Handle agent logic
        result = self.convert_currency(user_input)
        return result

# Expose as A2A-compliant service
agent = CurrencyAgent(
    name="Currency Agent",
    instructions="You are a currency conversion expert"
)

# ADK automatically generates A2A interface
a2a_server = A2aServer.expose(agent)

# Agent automatically:
# - Generates AgentCard at /.well-known/agent-card.json
# - Exposes /run HTTP endpoint for A2A messages
# - Manages sessions via SessionService
# - Handles A2A message/send and tasks/get operations
```

#### ADK Session Integration

```python
# ADK handles session management automatically
app = AdkApp(
    agent=agent,
    session_service=SessionService.for_agent_engine()
)

@app.before_agent_run
def initialize_session(session):
    """Callback before each agent turn"""
    if "conversation_count" not in session.state:
        session.state["conversation_count"] = 0
    session.state["conversation_count"] += 1

@app.after_tool_run
def update_session_state(session, tool_result):
    """Callback after tool execution"""
    session.state["last_tool"] = tool_result.tool_name
```

---

## 5. Task Delegation and Handoff Patterns

### 5.1 Agent-to-Agent Communication Flow

```
┌──────────────────┐
│  Client Agent    │
│  (Orchestrator)  │
└────────┬─────────┘
         │
         │ 1. Discover capabilities
         ↓
    /.well-known/agent-card.json
         │
         │ 2. Select appropriate agent
         │
    Remote Agent A ──── 3. Send message
    Remote Agent B      (JSON-RPC)
    Remote Agent C      ↓
         │          Get task status
         │          (polling/streaming)
         │          ↓
    Result ────── 4. Receive artifacts
```

### 5.2 Task Delegation Pattern

```python
from a2a.client import A2aClient

class PurchasingConcierge:
    """Root agent that delegates to specialized agents"""

    def __init__(self):
        # Discover and cache remote agents
        self.burger_agent = A2aClient("https://burger-agent.example.com")
        self.pizza_agent = A2aClient("https://pizza-agent.example.com")

    async def process_order(self, user_request):
        # Determine which agent to use
        if "burger" in user_request.lower():
            agent = self.burger_agent
        elif "pizza" in user_request.lower():
            agent = self.pizza_agent
        else:
            return "Unsure what you want"

        # Delegate task to specialized agent
        task = agent.send_message(
            parts=[{
                "type": "text/plain",
                "text": user_request
            }]
        )

        # Poll for completion
        while True:
            status = agent.get_task(task_id=task.id)
            if status.state == "completed":
                return status.artifacts[0]
            elif status.state == "failed":
                raise Exception(f"Task failed: {status.message}")

            await asyncio.sleep(1)  # Poll interval
```

### 5.3 Context Preservation Across Handoffs

The `contextId` field maintains conversation context:

```python
# Client Agent perspective
task_1 = burger_agent.send_message(
    parts=[TextPart(text="I want a cheeseburger")],
    context_id="order-session-123"  # Preserve context
)

# Remote agent's response
response_1 = burger_agent.get_task(task_1.id)
print(response_1.context_id)  # "order-session-123" - same context

# Subsequent messages in same conversation
task_2 = burger_agent.send_message(
    parts=[TextPart(text="Make it extra spicy")],
    context_id="order-session-123"  # Continue same conversation
)
```

---

## 6. Error Handling and Recovery Mechanisms

### 6.1 Error Handling Strategy

A2A uses a multi-layered error handling approach:

#### Layer 1: Agent-Level Recovery

```python
class CurrencyAgent(Agent):
    async def run(self, session, user_input):
        try:
            result = self.convert_currency(user_input)
            return result
        except ApiError as e:
            # Log error
            logger.error(f"Conversion failed: {e}")
            # Return safe fallback
            return "Unable to convert. Please try again."
        except ValidationError as e:
            # Request clarification
            return "Invalid currency. Please specify valid ISO code (e.g., EUR, USD)"
```

#### Layer 2: Task State Transitions

```python
# Client Agent handling failures
task = remote_agent.send_message(...)

while True:
    status = remote_agent.get_task(task.id)

    if status.state == "completed":
        return status.artifacts

    elif status.state == "failed":
        # Strategy 1: Retry with backoff
        retry_task = remote_agent.send_message(...)

    elif status.state == "input_required":
        # Strategy 2: Provide additional input
        clarification = collect_user_input(status.message)
        remote_agent.send_message(
            parts=[TextPart(text=clarification)],
            context_id=task.context_id
        )

    elif status.state == "auth_required":
        # Strategy 3: Obtain authentication
        credentials = get_credentials(status.message)
        remote_agent.send_message(
            parts=[DataPart(data=credentials)],
            context_id=task.context_id
        )

    elif status.state == "cancelled":
        raise TaskCancelledError("Task was cancelled")
```

### 6.2 Resilience Patterns

#### Circuit Breaker Pattern

```python
from circuitbreaker import circuit

class AgentClient:
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def send_message(self, agent_url, message):
        """Prevents cascading failures to unresponsive agents"""
        return await self._send_message_internal(agent_url, message)
```

#### Intelligent Retry Strategy

```python
async def send_with_retry(agent, message, max_retries=3):
    """Exponential backoff retry with fallback"""
    for attempt in range(max_retries):
        try:
            task = agent.send_message(message)
            return task
        except TransientError as e:
            if attempt == max_retries - 1:
                # Last attempt failed, use fallback agent
                fallback_agent = get_fallback_agent(agent)
                return fallback_agent.send_message(message)

            # Exponential backoff: 1s, 2s, 4s
            wait_time = 2 ** attempt
            await asyncio.sleep(wait_time)
```

#### Timeout Management

```python
async def send_with_timeout(agent, message, timeout_seconds=300):
    """Prevent indefinite waiting for long-running tasks"""
    try:
        task = agent.send_message(message)

        # Wait with timeout
        status = await asyncio.wait_for(
            poll_task_until_complete(agent, task.id),
            timeout=timeout_seconds
        )
        return status.artifacts

    except asyncio.TimeoutError:
        # Task exceeded timeout
        agent.cancel_task(task.id)
        return "Request took too long. Task was cancelled."
```

### 6.3 Error Response Formats

#### JSON-RPC Error Response

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Service unavailable",
    "data": {
      "error_type": "TransientError",
      "retry_after": 30,
      "suggestion": "Retry after 30 seconds"
    }
  },
  "id": "request-123"
}
```

#### Common Error Codes

| Code | Error Type | Meaning | Handling |
|------|-----------|---------|----------|
| -32700 | ParseError | Invalid JSON sent | Validate request format |
| -32600 | InvalidRequest | Request missing method/params | Correct request structure |
| -32601 | MethodNotFound | Method not supported | Check agent capabilities |
| -32602 | InvalidParams | Invalid parameters provided | Validate against skill schema |
| -32603 | InternalError | Server error during processing | Retry with backoff |
| 4xx Custom | ClientError | Client-side error (bad input) | Fix input, don't retry |
| 5xx Custom | ServerError | Server-side error | Retry with backoff |

---

## 7. Implementation Patterns

### 7.1 Multi-Agent Orchestration Pattern (Recommended)

#### Root Agent Architecture

```python
from adk import Agent
from a2a.client import A2aClient

class HiringManagerAgent(Agent):
    """Root agent orchestrating multiple specialized agents"""

    def __init__(self):
        self.candidate_finder = A2aClient(
            "https://candidate-finder.example.com"
        )
        self.interview_scheduler = A2aClient(
            "https://interview-scheduler.example.com"
        )
        self.background_checker = A2aClient(
            "https://background-checker.example.com"
        )

    async def run(self, session, user_input):
        """Orchestrate agent handoffs"""

        # Step 1: Find candidates
        candidates_task = self.candidate_finder.send_message(
            parts=[TextPart(text=user_input)],
            context_id=session.id
        )

        candidates_status = await self._wait_for_completion(
            self.candidate_finder, candidates_task
        )
        candidates = self._extract_candidates(candidates_status)

        # Step 2: Schedule interviews
        interviews_task = self.interview_scheduler.send_message(
            parts=[DataPart(data={"candidates": candidates})],
            context_id=session.id
        )

        interviews_status = await self._wait_for_completion(
            self.interview_scheduler, interviews_task
        )

        # Step 3: Run background checks
        checks_task = self.background_checker.send_message(
            parts=[DataPart(data={"candidates": candidates})],
            context_id=session.id
        )

        checks_status = await self._wait_for_completion(
            self.background_checker, checks_task
        )

        return self._compile_results(
            candidates_status,
            interviews_status,
            checks_status
        )

    async def _wait_for_completion(self, agent, task):
        """Poll with exponential backoff"""
        max_wait = 300  # 5 minutes
        wait_interval = 1

        start_time = time.time()
        while time.time() - start_time < max_wait:
            status = agent.get_task(task.id)

            if status.state in ["completed", "failed"]:
                return status

            await asyncio.sleep(wait_interval)
            wait_interval = min(wait_interval * 1.5, 10)  # Cap at 10s

        raise TimeoutError(f"Task {task.id} exceeded {max_wait}s timeout")
```

### 7.2 ADK + A2A Deployment

```python
from adk import AdkApp
from a2a import A2aServer

# Create agent
agent = HiringManagerAgent(
    name="Hiring Manager Agent",
    instructions="You coordinate hiring across multiple specialized agents"
)

# Create ADK app
app = AdkApp(
    agent=agent,
    # Use Vertex AI Agent Engine for sessions
    session_service="agent_engine"
)

# Expose as A2A service
a2a_server = A2aServer.expose(
    app=app,
    port=8080,
    # Auto-generates /.well-known/agent-card.json
    # Auto-exposes /run endpoint for A2A messages
)

# Deploy to Agent Engine
# gcloud run deploy hiring-agent --source . --runtime python311
```

### 7.3 Interoperability with Other Frameworks

```python
# A2A agents can be built with any framework
# and expose standard A2A interface

# CrewAI agent exposed via A2A
# Crew.ai agent exposed via A2A
# LangGraph agent exposed via A2A
# Custom agent exposed via A2A

# All communicate using same A2A protocol
```

---

## 8. Comparison with Other Protocols

### 8.1 A2A vs. MCP (Model Context Protocol)

| Aspect | A2A | MCP |
|--------|-----|-----|
| **Purpose** | Agent-to-Agent communication | LLM/Agent-to-Tools connection |
| **Direction** | Horizontal (agent ↔ agent) | Vertical (agent → tools) |
| **Layer** | Agent collaboration | Tool integration |
| **Use Case** | Delegate to specialized agents | Call APIs, databases, services |
| **Statefulness** | Stateful (maintains context) | Mostly stateless |
| **Discovery** | Agent Card (capabilities) | MCP server manifest |

**Recommendation**: Use MCP for tool integration, use A2A for agent collaboration. They complement each other.

### 8.2 A2A vs. Other Orchestration Frameworks

| Framework | Architecture | Strengths | Limitations |
|-----------|-------------|-----------|------------|
| **A2A (Google)** | HTTP-based, protocol-agnostic | Vendor-neutral, enterprise security, widely adopted | Requires explicit A2A implementation |
| **LangGraph** | Graph-based state machine | Fast, low token usage, time travel debugging | Framework-specific |
| **Microsoft AutoGen** | Conversation-based | Enterprise-grade, flexible patterns | Higher complexity |
| **CrewAI** | Role-based teams | Feature-rich, user-friendly | Less flexibility for complex orchestration |
| **OpenAI Swarm** | Lightweight handoff-based | Simple, experimental | Limited production features |
| **AWS Agent Squad** | Router-based distribution | Good integration with AWS | AWS-specific |

**A2A Advantages**:
- Vendor-neutral standard (can work with any framework)
- Industry support (150+ organizations)
- Enterprise security built-in
- Works across different deployment platforms

---

## 9. Key Data Structures Reference

### Python A2A SDK Types

```python
from a2a.types import (
    # Cards and Discovery
    AgentCard,
    AgentCapabilities,
    AgentSkill,
    AgentCardSignature,

    # Messages and Tasks
    Message,
    MessageRequest,
    MessageResponse,
    Task,
    TaskStatus,
    TaskState,

    # Content Parts
    Part,
    TextPart,
    FilePart,
    DataPart,

    # Artifacts
    Artifact,

    # Errors
    UnsupportedOperationError,
    ContentTypeNotSupportedError,
    AuthenticationError,
    AuthorizationError,
)

from a2a.utils import (
    new_agent_text_message,  # Helper to create text messages
)
```

### Core Classes

```python
# Agent Card
AgentCard(
    name="str",
    description="str",
    version="str",
    url="str",
    capabilities=AgentCapabilities(...),
    skills=[AgentSkill(...)],
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
    supports_authenticated_extended_card=bool,
    signature=AgentCardSignature(...)
)

# Task Management
Task(
    id="str",
    context_id="str",
    status=TaskStatus(
        state=TaskState.COMPLETED,
        message="str",
        timestamp="ISO8601"
    ),
    history=[Message(...)],
    artifacts=[Artifact(...)]
)

# Message Parts (Multimodal)
TextPart(text="str")
FilePart(type="image/png", name="str", data="base64")
DataPart(data={"key": "value"})
```

---

## 10. Deployment Architecture

### 10.1 Recommended Architecture for Intent Mail

```
┌────────────────────────────────────────────────────────────┐
│                    Vertex AI Agent Engine                  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           Root Intent Mail Agent (ADK)              │  │
│  │                                                     │  │
│  │  - Parses user intent                             │  │
│  │  - Routes to specialized agents                   │  │
│  │  - Manages session & memory                        │  │
│  └─────────────────────────────────────────────────────┘  │
│           │                    │                   │       │
│           ↓                    ↓                   ↓       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ Email Parser │   │ Classifier   │   │ Response Gen │  │
│  │ Agent (A2A)  │   │ Agent (A2A)  │   │ Agent (A2A)  │  │
│  └──────────────┘   └──────────────┘   └──────────────┘  │
│        │                    │                   │          │
│        └────────────────────┴───────────────────┘          │
│                       │                                    │
│                       ↓                                    │
│              ┌──────────────────┐                          │
│              │  Sessions Service │                         │
│              │  Memory Bank     │                         │
│              └──────────────────┘                          │
│                                                             │
└────────────────────────────────────────────────────────────┘
         │
         │ A2A HTTP Endpoints
         ↓
┌─────────────────────────────────────────────────────────────┐
│              External Clients / Integrations               │
│                                                             │
│  - Email clients                                           │
│  - Chat interfaces                                         │
│  - API consumers                                           │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Deployment Steps

1. **Develop** local ADK agent with A2A support
2. **Expose** as A2A server on Cloud Run or Agent Engine
3. **Configure** session management with Vertex AI
4. **Register** agent card for discovery
5. **Monitor** via Cloud Logging and Cloud Trace

---

## 11. Official Resources and Documentation

### Official Documentation

- **[Develop an Agent2Agent agent](https://docs.cloud.google.com/agent-builder/agent-engine/develop/a2a)** - Official Google Cloud guide
- **[Use an Agent2Agent agent](https://docs.cloud.google.com/agent-builder/agent-engine/use/a2a)** - Interaction patterns
- **[A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)** - Official spec
- **[Agent Development Kit Docs](https://google.github.io/adk-docs/)** - ADK framework guide

### Code Examples

- **[A2A Purchasing Concierge Codelab](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge)** - Multi-agent example
- **[Multi-Agent ADK+A2A Tutorial](https://codelabs.developers.google.com/codelabs/create-multi-agents-adk-a2a)** - End-to-end guide
- **[A2A Python SDK](https://github.com/a2aproject/a2a-python)** - Official Python SDK

### Community Resources

- **[Google Developers Blog - A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)** - Protocol introduction
- **[Architecture Guide - Google Cloud Medium](https://medium.com/google-cloud/architecting-a-multi-agent-system-with-google-a2a-and-adk-4ced4502c86a)** - Design patterns

---

## 12. Next Steps for Intent Mail

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement ADK agent with A2A support
- [ ] Define agent skills in AgentCard
- [ ] Create local A2A server with test harness

### Phase 2: Core Agents (Weeks 3-4)
- [ ] Build Intent Parser agent
- [ ] Build Email Classifier agent
- [ ] Build Response Generator agent
- [ ] Implement inter-agent message routing

### Phase 3: Production Deployment (Weeks 5-6)
- [ ] Deploy to Vertex AI Agent Engine
- [ ] Configure session management
- [ ] Implement monitoring and logging
- [ ] Set up error handling and recovery

### Phase 4: Integration & Optimization (Week 7+)
- [ ] Integrate with email systems (Gmail, Outlook)
- [ ] Implement long-running task handling
- [ ] Add multimodal support (attachments, rich content)
- [ ] Performance tuning and observability

---

## Appendix: Glossary

- **A2A Protocol**: Agent-to-Agent protocol for standardized agent communication
- **AgentCard**: JSON metadata describing agent capabilities and skills
- **ADK**: Agent Development Kit, Google's Python framework for building agents
- **Agent Engine**: Vertex AI managed service for deploying agents at scale
- **Context ID**: Identifier maintaining conversation continuity across interactions
- **Message**: Unit of communication between agents containing Parts
- **Part**: Smallest unit of content (TextPart, FilePart, DataPart)
- **Task**: Unit of work with lifecycle states (submitted, working, completed, etc.)
- **Artifact**: Output generated by agent, composed of Parts
- **Skill**: Discrete capability or function an agent can perform
- **Session Service**: Manages conversation state and history within a session
- **Memory Bank**: Long-term storage for memories across multiple sessions

---

## Document Metadata

- **Created**: 2025-12-27
- **Research Scope**: Google A2A Protocol v0.3.0
- **Sources**: 25+ official Google Cloud documents, academic papers, and implementation guides
- **Status**: Research Complete

For implementation guidance, refer to the official Google Cloud documentation and codelabs provided in Section 11.
