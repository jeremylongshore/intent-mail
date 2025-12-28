# EPIC: Google Workspace API Integration

## Overview
Add full Google Workspace API support to IntentMail so Claude can create calendar events, send Meet invites, access Sheets, and manage Workspace resources directly.

## Owner
- **Workspace Admin**: jeremy@intentsolutions.io (Intent Solutions)
- **Domain**: intentsolutions.io

## Why Service Account (not OAuth)
Since Jeremy owns the Workspace, we use **Service Account + Domain-Wide Delegation**:
- One-time setup, no repeated consent flows
- Claude can act on behalf of any user in the domain
- Works programmatically without browser interaction

---

## Phase 1: Service Account Setup (Admin Console)

### Step 1.1: Create Service Account
```
Google Cloud Console → IAM & Admin → Service Accounts
1. Create Service Account
   - Name: intentmail-workspace-agent
   - Description: IntentMail MCP server Workspace access
2. Create JSON key → Download → Store securely
```

### Step 1.2: Enable APIs
```
Google Cloud Console → APIs & Services → Enable:
- Google Calendar API
- Google Meet REST API (or Calendar for Meet links)
- Google Sheets API
- Google Drive API (for Sheets access)
- Admin SDK API (optional, for user management)
```

### Step 1.3: Domain-Wide Delegation
```
Google Admin Console → Security → API Controls → Domain-wide Delegation
1. Add new API client
2. Client ID: [from service account]
3. Scopes:
   - https://www.googleapis.com/auth/calendar
   - https://www.googleapis.com/auth/calendar.events
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive.file
   - https://www.googleapis.com/auth/meetings.space.created
```

---

## Phase 2: IntentMail Implementation

### Step 2.1: Add Google APIs Package
```bash
npm install googleapis
```

### Step 2.2: Service Account Auth Module
```
src/connectors/google-workspace/
├── auth.ts          # Service account JWT auth
├── calendar.ts      # Calendar operations
├── meet.ts          # Meet link generation
├── sheets.ts        # Sheets read/write
└── index.ts         # Exports
```

### Step 2.3: New MCP Tools

| Tool | Description |
|------|-------------|
| `calendar_list_events` | List calendar events |
| `calendar_create_event` | Create event with optional Meet link |
| `calendar_send_invite` | Send calendar invite to external contact |
| `sheets_read` | Read data from Google Sheet |
| `sheets_write` | Write/append data to Sheet |
| `sheets_create` | Create new spreadsheet |
| `meet_create_link` | Generate Meet link |

---

## Phase 3: CRM Integration

Once Sheets API works:
- Auto-sync contacts.csv → Google Sheet
- Track outreach status in real-time
- Log activity automatically
- Update contact stages from Claude

---

## File Structure

```
src/connectors/google-workspace/
├── auth.ts
│   - loadServiceAccountKey()
│   - getAuthClient(userEmail) → JWT client impersonating user
│
├── calendar.ts
│   - listEvents(userEmail, timeMin, timeMax)
│   - createEvent(userEmail, event)
│   - createEventWithMeet(userEmail, event)
│   - deleteEvent(userEmail, eventId)
│
├── sheets.ts
│   - readSheet(spreadsheetId, range)
│   - writeSheet(spreadsheetId, range, values)
│   - appendSheet(spreadsheetId, range, values)
│   - createSpreadsheet(title)
│
├── meet.ts
│   - createMeetLink(userEmail) → Meet URL
│
└── index.ts
    - exports all
```

---

## Environment Variables

```env
# Service Account (store JSON key path or inline)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./secrets/service-account.json
# Or base64 encoded for deployment:
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=...

# Default user to impersonate
GOOGLE_WORKSPACE_USER=jeremy@intentsolutions.io

# Workspace domain
GOOGLE_WORKSPACE_DOMAIN=intentsolutions.io
```

---

## Security Considerations

1. **Service account key** - Store in ./secrets/ (gitignored) or env var
2. **Minimal scopes** - Only request what's needed
3. **Audit logging** - Log all Workspace operations
4. **Domain restriction** - Only impersonate users in intentsolutions.io

---

## Deliverables

- [ ] Service account created in GCP
- [ ] Domain-wide delegation configured
- [ ] `src/connectors/google-workspace/` module
- [ ] `calendar_create_event` MCP tool
- [ ] `calendar_send_invite` MCP tool
- [ ] `sheets_read` / `sheets_write` MCP tools
- [ ] `meet_create_link` MCP tool
- [ ] Integration tests
- [ ] Documentation updated

---

## Timeline

1. **Admin Setup** (Phase 1): 15 min manual setup
2. **Auth Module** (Phase 2.1-2.2): 1 hour
3. **Calendar Tools** (Phase 2.3): 2 hours
4. **Sheets Tools**: 1 hour
5. **Testing**: 1 hour

**Total: ~5 hours implementation after admin setup**

---

## Next Steps

1. Jeremy: Complete Phase 1 admin setup in Google Console
2. Claude: Implement Phase 2 once service account key is available
3. Test with real calendar invite
4. Integrate with sponsor outreach workflow
