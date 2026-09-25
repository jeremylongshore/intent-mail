---
name: email-checkin
description: |
  Build a read-only Gmail or Outlook briefing from IntentMail's local cache,
  including P1-P4 priority, response needs, deadlines, and thread summaries.
  Use when checking an inbox or catching up on mail; trigger with "check my
  inbox", "daily email digest", or "what needs a response?".
allowed-tools: 'mcp__intentmail__mail_list_accounts, mcp__intentmail__mail_sync, mcp__intentmail__mail_daily_digest, mcp__intentmail__mail_triage, mcp__intentmail__mail_summarize, mcp__intentmail__mail_search'
version: 0.5.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Requires the IntentMail plugin, Node.js 20+, a configured Gmail or Outlook OAuth account, and an AI provider for triage. OAuth tokens and the cache stay local; a configured cloud AI provider receives the message content needed for requested analysis.'
tags: [email, inbox, triage, digest, gmail, outlook]
argument-hint: '[accountId | email] [unread | hours]'
model: inherit
effort: medium
---

# Email Check-in

## Overview

Sync mail into IntentMail's local store and return one scoped, priority-ranked
briefing. This workflow never changes provider message state; sync does update
the local cache and may refresh locally stored OAuth tokens.

## Prerequisites

- Run IntentMail on Node.js 20 or newer.
- Connect at least one Gmail or Outlook account through IntentMail OAuth.
- Configure an AI provider for generated triage and summaries.

## Authentication and privacy

- Require an account previously connected through `mail_auth_start`; this
  skill does not run OAuth or request secrets in chat.
- OAuth tokens and indexed mail remain in the self-hosted IntentMail process.
- Anthropic, OpenAI, Groq, Cerebras, or Vertex receives the message/thread
  content needed for requested AI triage or summaries. Ollama keeps inference
  local. State that boundary if the user asks about privacy.
- See [authentication and data boundaries](references/auth-and-privacy.md).

## Workflow

1. Resolve the account. If the user supplied no ID, call
   `mcp__intentmail__mail_list_accounts`; ask which account when several are
   active. Never guess an account from message content.
2. Confirm the requested window and cap. Default to the digest tool's 50-item
   limit; use `unreadOnly` or `sinceHours` when the request supplies that scope.
3. Call `mcp__intentmail__mail_sync` for the selected account. Do not set
   `forceInitial: true` or raise `maxMessages` without explaining the broader
   fetch and receiving approval.
4. Call `mcp__intentmail__mail_daily_digest` with the account and scope. Prefer
   its structured payload over rebuilding the digest manually.
5. If the digest tool is unavailable, use `mcp__intentmail__mail_search` for
   the bounded window, `mcp__intentmail__mail_triage` for classification, and
   `mcp__intentmail__mail_summarize` only for threads that need compression.
6. Render high-priority and needs-response items first, then the remaining
   category groups. Preserve uncertainty and citations from tool output.

## Validation

- Confirm the returned account ID matches the selected account.
- Report sync type, added/deleted/label-change counts, and sync timestamp.
- Distinguish provider-deleted items reported by sync from actions taken by
  this skill; the skill itself does not delete or archive mail.
- Do not claim an empty digest means an empty provider inbox when sync failed.

## Output

Return the account and time window, sync receipt, digest counts, P1-P4 groups,
response needs, detected deadlines, concise summaries, uncertainty, and any
failed or omitted stage. Do not expose message bodies beyond what the user
asked to review.

## Error Handling

- **No account or expired OAuth:** stop and direct the user to the explicit
  IntentMail authentication flow; never solicit a token.
- **AI provider unavailable:** return a bounded `mail_search` result and label
  it untriaged rather than inventing priorities.
- **Partial sync or provider rate limit:** report the tool error and the last
  successful sync time; do not present cached results as current.
- **Action requested:** stop and hand off to `email-triage-actions`; no provider
  write tools are allowed here.
- **Uncertain priority or deadline:** show the uncertainty and source text.

## Examples

```text
Check my Outlook inbox for unread mail from the last 24 hours. Sync normally,
then show P1/P2 and needs-response items first. Do not change message state.
```

```text
Summarize the active Gmail account with the default 50-item cap. If AI triage
is unavailable, return an explicitly untriaged unread list.
```

## Resources

- [Authentication and data boundaries](references/auth-and-privacy.md)
- Digest contract: `src/ai/daily-digest.ts`
- Companion provider-write workflow: `email-triage-actions`
