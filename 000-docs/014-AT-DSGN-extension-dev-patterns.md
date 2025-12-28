# Vertex AI Extensions & Custom Tools: Development Patterns

## Executive Summary

Vertex AI Extensions provide a framework for building custom tools that extend agent capabilities. Extensions enable agents to connect to external APIs, enterprise data sources, and business systems while maintaining security and governance controls.

---

## 1. Extensions Architecture

### 1.1 Core Components

```
Extension System:
├── Extension Definition
│   ├─ Metadata (name, description, version)
│   ├─ Authentication config
│   └─ API specification
├── Tool Integration
│   ├─ Function definitions
│   ├─ Parameter schemas
│   └─ Response formats
├── Security Layer
│   ├─ IAM permissions
│   ├─ Data isolation
│   └─ Encryption
└── Governance
    ├─ Audit logging
    ├─ Tool registry
    └─ Version control
```

### 1.2 Extension Types

| Type | Purpose | Example |
|------|---------|---------|
| **Enterprise Data** | Connect to internal systems | Knowledge base search |
| **External APIs** | Third-party service integration | Slack, Salesforce |
| **Code Interpreter** | Execute code (pre-built) | Python/JS execution |
| **Search Tools** | Vertex AI Search integration | Enterprise search |
| **Custom Logic** | User-defined operations | Business logic |

---

## 2. Building Custom Extensions

### 2.1 Extension Development Lifecycle

```
Design Phase:
├─ Define use cases
├─ Identify data sources
├─ Plan security model
└─ Design API contracts

Development Phase:
├─ Create extension scaffold
├─ Implement tool functions
├─ Add error handling
└─ Configure authentication

Testing Phase:
├─ Unit tests for tools
├─ Integration tests
├─ Security validation
└─ Permission testing

Deployment Phase:
├─ Register in Vertex AI
├─ Configure IAM
├─ Monitor usage
└─ Update documentation

Governance Phase:
├─ Version management
├─ Audit logging
├─ Compliance checks
└─ Deprecation handling
```

### 2.2 Extension Structure

```
custom-extension/
├── extension.yaml          # Metadata
├── handlers/
│   ├── __init__.py
│   ├── data_access.py      # Data retrieval tools
│   ├── business_logic.py   # Custom operations
│   └── validation.py       # Input validation
├── schemas/
│   ├── input_schema.json   # Request format
│   └── output_schema.json  # Response format
├── tests/
│   ├── test_handlers.py
│   └── test_integration.py
├── auth/
│   └── credentials.yaml    # Auth configuration
└── docs/
    ├── README.md
    └── examples.md
```

### 2.3 Extension Manifest (extension.yaml)

```yaml
name: "intent-mail-extension"
version: "1.0.0"
description: "Email and calendar operations for Intent Mail"
author: "Your Team"

tools:
  - name: "get_user_emails"
    description: "Retrieve recent emails for user"
    function:
      module: "handlers.data_access"
      name: "get_user_emails"
    input_schema:
      type: "object"
      properties:
        limit:
          type: "integer"
          description: "Number of emails to retrieve"
        filter:
          type: "string"
          description: "Filter criteria (unread, to:user@...)"
      required: ["limit"]
    output_schema:
      type: "object"
      properties:
        emails:
          type: "array"
          items:
            $ref: "#/components/schemas/Email"

  - name: "send_email"
    description: "Send email message"
    function:
      module: "handlers.business_logic"
      name: "send_email"
    input_schema:
      type: "object"
      properties:
        to:
          type: "string"
        subject:
          type: "string"
        body:
          type: "string"
        cc:
          type: "array"
        attachments:
          type: "array"
      required: ["to", "subject", "body"]

authentication:
  type: "oauth2"
  client_id_env: "GMAIL_CLIENT_ID"
  client_secret_env: "GMAIL_CLIENT_SECRET"
  scopes:
    - "https://www.googleapis.com/auth/gmail.readonly"
    - "https://www.googleapis.com/auth/gmail.send"

permissions:
  - role: "roles/aiplatform.user"
    action: "use_tool"
```

---

## 3. Tool Implementation Patterns

### 3.1 Basic Tool Function Pattern

```python
# handlers/data_access.py
from typing import List, Dict, Any
from functools import wraps
from logging import getLogger

logger = getLogger(__name__)

def validate_input(schema):
    """Decorator for input validation"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Validate kwargs against schema
            # Raise ValueError if invalid
            return func(*args, **kwargs)
        return wrapper
    return decorator

@validate_input(schema={"limit": int})
def get_user_emails(user_id: str, limit: int = 10, filter: str = None) -> Dict[str, Any]:
    """
    Retrieve recent emails for user.

    Args:
        user_id: Gmail user ID
        limit: Number of emails to retrieve (default 10)
        filter: Gmail filter string (optional)

    Returns:
        Dictionary with:
        - emails: List of email objects
        - total_count: Total matching emails
        - has_more: Whether more results available
    """
    try:
        logger.info(f"Fetching {limit} emails for user {user_id}")

        # Build Gmail API query
        query = build_gmail_query(filter)

        # Call Gmail API
        results = gmail_service.users().messages().list(
            userId=user_id,
            q=query,
            maxResults=limit
        ).execute()

        # Process results
        emails = []
        for message_id in results.get('messages', []):
            email = fetch_email_details(user_id, message_id['id'])
            emails.append(email)

        return {
            "emails": emails,
            "total_count": results.get('resultSizeEstimate', 0),
            "has_more": 'nextPageToken' in results,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        return {
            "error": str(e),
            "emails": [],
            "error_code": "FETCH_FAILED"
        }
```

### 3.2 Tool with Side Effects Pattern

```python
# handlers/business_logic.py
def send_email(
    user_id: str,
    to: str,
    subject: str,
    body: str,
    cc: List[str] = None,
    bcc: List[str] = None,
    attachments: List[Dict] = None
) -> Dict[str, Any]:
    """
    Send email message via Gmail.

    IMPORTANT: This performs an action.
    Consider requiring confirmation before execution.

    Args:
        user_id: Gmail user ID
        to: Recipient email address
        subject: Email subject
        body: Email body
        cc: CC recipients
        bcc: BCC recipients
        attachments: File attachments

    Returns:
        Result with message_id or error details
    """
    try:
        logger.info(f"Sending email from {user_id} to {to}")

        # Validate email addresses
        validate_email(to)
        if cc:
            [validate_email(c) for c in cc]

        # Build MIME message
        message = build_mime_message(
            to=to,
            subject=subject,
            body=body,
            cc=cc,
            bcc=bcc
        )

        # Add attachments if provided
        if attachments:
            for attachment in attachments:
                add_attachment(message, attachment)

        # Send via Gmail API
        result = gmail_service.users().messages().send(
            userId=user_id,
            body={'raw': message}
        ).execute()

        logger.info(f"Email sent: {result['id']}")

        return {
            "success": True,
            "message_id": result['id'],
            "timestamp": datetime.now().isoformat()
        }

    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "VALIDATION_ERROR"
        }

    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_code": "SEND_FAILED"
        }
```

### 3.3 Tool with Complex Logic Pattern

```python
# handlers/business_logic.py
def find_meeting_slot(
    user_id: str,
    attendees: List[str],
    duration_minutes: int = 30,
    preferred_times: List[str] = None
) -> Dict[str, Any]:
    """
    Find available meeting slot for all attendees.

    Multi-step process:
    1. Fetch each attendee's calendar
    2. Find overlapping free time
    3. Filter by preferences
    4. Return top N options

    Args:
        user_id: Organizer's Gmail user ID
        attendees: List of attendee emails
        duration_minutes: Meeting duration
        preferred_times: Preference rules (e.g., "9-5pm", "no-friday")

    Returns:
        Available time slots with attendee info
    """
    try:
        logger.info(f"Finding slots for {len(attendees)} attendees")

        # Step 1: Fetch calendars for all attendees
        calendars = {}
        for attendee in attendees:
            calendar = calendar_service.get_calendar_for_user(attendee)
            calendars[attendee] = calendar

        # Step 2: Find overlapping free time (next 7 days)
        available_slots = find_overlapping_slots(
            calendars=calendars,
            duration_minutes=duration_minutes,
            days=7
        )

        # Step 3: Filter by preferences
        if preferred_times:
            available_slots = filter_by_preferences(
                available_slots,
                preferred_times
            )

        # Step 4: Rank slots (soonest first, highest availability)
        ranked_slots = rank_slots(available_slots)

        return {
            "available_slots": ranked_slots[:5],  # Top 5
            "total_found": len(ranked_slots),
            "attendee_count": len(attendees),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error finding slots: {e}")
        return {
            "error": str(e),
            "available_slots": [],
            "error_code": "SLOT_SEARCH_FAILED"
        }
```

---

## 4. Authentication & Security

### 4.1 OAuth 2.0 Pattern (For Gmail, Google Workspace)

```python
# auth/oauth_handler.py
from google.oauth2.service_account import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
import os

class OAuthManager:
    def __init__(self):
        self.client_id = os.getenv("GMAIL_CLIENT_ID")
        self.client_secret = os.getenv("GMAIL_CLIENT_SECRET")
        self.scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
        ]

    def get_credentials(self, user_id: str):
        """Get OAuth credentials for user"""
        # Check cache
        cached = self.get_cached_credentials(user_id)
        if cached:
            return cached

        # Flow for first-time setup
        flow = InstalledAppFlow.from_client_secrets_file(
            'credentials.json',
            self.scopes
        )
        creds = flow.run_local_server(port=0)

        # Cache for future use
        self.cache_credentials(user_id, creds)
        return creds
```

### 4.2 API Key Pattern (For Simple Services)

```yaml
# auth/credentials.yaml
authentication:
  type: "api_key"
  header: "Authorization"
  format: "Bearer {key}"
  key_env: "CUSTOM_SERVICE_API_KEY"
```

### 4.3 Service Account Pattern (For Backend Services)

```python
# auth/service_account.py
from google.oauth2 import service_account

def get_service_account_credentials():
    """Load service account credentials from JSON file"""
    credentials = service_account.Credentials.from_service_account_file(
        'service-account-key.json',
        scopes=[
            "https://www.googleapis.com/auth/gmail.admin",
            "https://www.googleapis.com/auth/calendar"
        ]
    )
    return credentials
```

---

## 5. Error Handling & Validation

### 5.1 Input Validation Pattern

```python
# handlers/validation.py
from pydantic import BaseModel, validator, ValidationError

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    cc: List[str] = []
    bcc: List[str] = []

    @validator('to')
    def validate_to(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v

    @validator('subject')
    def validate_subject(cls, v):
        if len(v) > 255:
            raise ValueError('Subject too long')
        return v

def send_email_validated(**kwargs):
    """Wrapper that validates input"""
    try:
        request = SendEmailRequest(**kwargs)
        return send_email(**request.dict())
    except ValidationError as e:
        return {
            "error": "Validation failed",
            "details": e.errors()
        }
```

### 5.2 Graceful Error Handling

```python
# handlers/error_handling.py
class ExtensionError(Exception):
    """Base extension error"""
    pass

class AuthenticationError(ExtensionError):
    """Authentication failed"""
    pass

class RateLimitError(ExtensionError):
    """Rate limit exceeded"""
    pass

class ValidationError(ExtensionError):
    """Input validation failed"""
    pass

def handle_errors(func):
    """Decorator for consistent error handling"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)

        except AuthenticationError as e:
            logger.error(f"Auth error: {e}")
            return {
                "error": "Authentication failed",
                "details": str(e),
                "error_code": "AUTH_FAILED"
            }

        except RateLimitError as e:
            logger.warning(f"Rate limit: {e}")
            return {
                "error": "Rate limit exceeded",
                "details": str(e),
                "error_code": "RATE_LIMIT",
                "retry_after": get_retry_after()
            }

        except ValidationError as e:
            logger.warning(f"Validation error: {e}")
            return {
                "error": "Invalid input",
                "details": str(e),
                "error_code": "VALIDATION_ERROR"
            }

        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return {
                "error": "Internal error",
                "error_code": "INTERNAL_ERROR"
            }

    return wrapper
```

---

## 6. Extension Governance

### 6.1 Tool Registry Integration (2025 Update)

```python
# Extension registration with Cloud API Registry
from google.cloud.api_registry_v1 import RegistryServiceClient

class ExtensionRegistry:
    def __init__(self, project_id: str):
        self.client = RegistryServiceClient()
        self.project_id = project_id

    def register_extension(self, manifest: Dict) -> str:
        """Register extension in API Registry"""
        parent = f"projects/{self.project_id}"

        api = {
            "display_name": manifest["name"],
            "description": manifest["description"],
            "service_config": {
                "methods": [
                    {
                        "name": tool["name"],
                        "description": tool["description"],
                        "input_type": tool["input_schema"],
                        "output_type": tool["output_schema"]
                    }
                    for tool in manifest["tools"]
                ]
            }
        }

        response = self.client.create_api(
            parent=parent,
            api=api
        )

        return response.name
```

### 6.2 Version Management

```python
# Extension versioning
class ExtensionVersion:
    def __init__(self, version: str, manifest: Dict):
        self.version = version
        self.manifest = manifest
        self.created_at = datetime.now()

    def is_deprecated(self) -> bool:
        return self.manifest.get("deprecated", False)

    def get_deprecation_message(self) -> str:
        return self.manifest.get("deprecation_notice", "")

# Register multiple versions
registry.register_version("1.0.0", manifest_v1)  # Stable
registry.register_version("1.1.0", manifest_v1_1)  # Current
registry.register_version("2.0.0-beta", manifest_v2)  # Preview
```

### 6.3 Audit Logging

```python
# handlers/audit.py
from google.cloud import logging as cloud_logging

class AuditLogger:
    def __init__(self, project_id: str):
        self.client = cloud_logging.Client(project=project_id)

    def log_tool_call(self, tool_name: str, user_id: str, params: Dict):
        """Log tool invocation for audit trail"""
        logger = self.client.logger(f"extension-audit")

        logger.log_struct({
            "event_type": "TOOL_CALL",
            "tool_name": tool_name,
            "user_id": user_id,
            "parameters": params,
            "timestamp": datetime.now().isoformat()
        })

    def log_error(self, tool_name: str, error: Exception):
        """Log tool errors"""
        logger = self.client.logger("extension-errors")

        logger.log_struct({
            "event_type": "TOOL_ERROR",
            "tool_name": tool_name,
            "error": str(error),
            "timestamp": datetime.now().isoformat()
        })
```

---

## 7. Testing Extensions

### 7.1 Unit Testing Pattern

```python
# tests/test_handlers.py
import pytest
from unittest.mock import Mock, patch
from handlers.data_access import get_user_emails
from handlers.business_logic import send_email

class TestDataAccess:
    @patch('handlers.data_access.gmail_service')
    def test_get_user_emails(self, mock_gmail):
        # Setup mock
        mock_gmail.users().messages().list.return_value.execute.return_value = {
            'messages': [
                {'id': '123'},
                {'id': '456'}
            ]
        }

        # Execute
        result = get_user_emails(user_id="user@example.com", limit=2)

        # Assert
        assert result['success'] == True
        assert len(result['emails']) == 2

class TestBusinessLogic:
    @patch('handlers.business_logic.gmail_service')
    def test_send_email_validation(self, mock_gmail):
        # Missing required field
        result = send_email(
            user_id="user@example.com",
            to="invalid-email",  # Invalid format
            subject="Test",
            body="Body"
        )

        assert result['success'] == False
        assert 'email' in result['error']
```

### 7.2 Integration Testing

```python
# tests/test_integration.py
class TestExtensionIntegration:
    def test_end_to_end_email_workflow(self):
        # Create extension manager
        extension = EmailExtension()

        # Test credential loading
        creds = extension.get_credentials("test-user")
        assert creds is not None

        # Test tool execution
        emails = extension.get_user_emails("test-user", limit=5)
        assert "emails" in emails

        # Test side-effect tool
        send_result = extension.send_email(
            user_id="test-user",
            to="recipient@example.com",
            subject="Test",
            body="Test body"
        )
        assert send_result["success"] == True
```

---

## 8. Extension Deployment

### 8.1 Deployment Steps

```bash
# 1. Build extension package
docker build -t my-extension:1.0.0 .

# 2. Push to Container Registry
docker push gcr.io/my-project/my-extension:1.0.0

# 3. Register with Vertex AI
gcloud ai extensions create intent-mail-extension \
  --display-name="Intent Mail Extension" \
  --manifest=extension.yaml \
  --image=gcr.io/my-project/my-extension:1.0.0

# 4. Configure IAM
gcloud projects add-iam-policy-binding my-project \
  --member=serviceAccount:extension-sa@my-project.iam.gserviceaccount.com \
  --role=roles/gmail.admin

# 5. Link to Agent
gcloud ai agents link-extension intent-mail-agent \
  --extension-id=intent-mail-extension
```

### 8.2 Continuous Deployment Pipeline

```yaml
# .github/workflows/deploy-extension.yml
name: Deploy Extension

on:
  push:
    branches: [main]
    paths:
      - 'extension/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Build extension image
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/intent-mail:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/intent-mail:${{ github.sha }}

      - name: Update extension version
        run: |
          gcloud ai extensions update intent-mail-extension \
            --image=gcr.io/${{ secrets.GCP_PROJECT }}/intent-mail:${{ github.sha }} \
            --project=${{ secrets.GCP_PROJECT }}
```

---

## 9. Extension Patterns for Intent Mail

### 9.1 Email Operations Extension

```python
# intent-mail-extension/handlers/email_ops.py
class EmailOperationsExtension:
    """Extension for email-specific operations"""

    tools = [
        "get_user_emails",
        "send_email",
        "search_emails",
        "organize_emails",
        "draft_reply"
    ]

    def get_user_emails(self, user_id: str, limit: int = 10):
        """List recent emails"""
        # Implementation

    def send_email(self, user_id: str, to: str, subject: str, body: str):
        """Send email message"""
        # Implementation

    def search_emails(self, user_id: str, query: str):
        """Search emails with Gmail syntax"""
        # Implementation

    def organize_emails(self, user_id: str, message_ids: List[str], label: str):
        """Add label to emails"""
        # Implementation

    def draft_reply(self, user_id: str, message_id: str, reply_body: str):
        """Create draft reply"""
        # Implementation
```

### 9.2 Calendar Operations Extension

```python
# intent-mail-extension/handlers/calendar_ops.py
class CalendarOperationsExtension:
    """Extension for calendar-specific operations"""

    tools = [
        "get_calendar_events",
        "schedule_meeting",
        "find_available_slots",
        "update_event"
    ]

    def get_calendar_events(self, user_id: str, days_ahead: int = 7):
        """List upcoming calendar events"""

    def schedule_meeting(self, user_id: str, attendees: List[str], slot: Dict):
        """Schedule meeting with attendees"""

    def find_available_slots(self, attendees: List[str], duration: int):
        """Find overlapping free time"""

    def update_event(self, user_id: str, event_id: str, updates: Dict):
        """Update existing event"""
```

---

## Document Version
- **Version**: 1.0
- **Last Updated**: December 2025
- **Source**: Official Vertex AI Extensions documentation, Google Cloud Blog on Tool Governance
