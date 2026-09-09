# IntentMail Authentication and Data Boundaries

Use this reference when authenticating, scoping a sync, or explaining where
mail data goes. Do not describe a self-hosted MCP server as fully local when a
configured cloud model performs triage or summarization.

## Local components

- The IntentMail MCP server runs locally over stdio.
- The SQLite mailbox cache and full-text index are local files.
- OAuth access and refresh tokens are stored locally.
- `INTENTMAIL_MASTER_KEY` enables explicit AES-256-GCM token encryption; follow
  the repository setup instructions and never paste this value into chat.
- Sync state such as Gmail history IDs and Outlook delta links is local.

## External services

| Operation | External recipient | Data involved |
| --- | --- | --- |
| Gmail OAuth and sync | Google Gmail API | OAuth grant and requested messages |
| Outlook OAuth and sync | Microsoft Graph | OAuth grant and requested messages |
| Cloud AI triage | Selected model provider | Message/thread content needed for analysis |
| Ollama triage | Local Ollama service | Message/thread content on the local host |

The configured AI provider may be Anthropic, OpenAI, Groq, Cerebras, Vertex, or
Ollama. Apply the user's provider retention and privacy policy; do not promise
that content remains local unless local inference is actually selected.

## Authentication flow

1. Configure provider client credentials outside the conversation using the
   repository's `.env.example` and setup guide.
2. Start the explicit `mail_auth_start` flow for Gmail or Outlook.
3. Complete consent through the provider page and callback.
4. Verify the account appears in `mail_list_accounts` before syncing.
5. If authorization expires, restart the documented OAuth flow; never ask the
   user to provide access or refresh tokens in chat.

## Safe sync defaults

- Use the selected account ID, never a guessed ID.
- Prefer normal delta sync when prior state exists.
- The initial-sync default can fetch up to 1,000 messages; keep it unchanged
  unless the user approves a different cap.
- `forceInitial: true` broadens retrieval and must be explicitly justified.
- Report partial syncs and rate limits rather than calling cached data current.

## Receipt

Return the provider and account, requested scope, sync type, sync timestamp,
message counts, AI provider/local-inference boundary, failures, and whether the
digest is current, partial, cached, or untriaged. Never include tokens, client
secrets, raw authorization URLs containing sensitive query values, or message
content outside the requested review scope.
