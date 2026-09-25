---
name: email-triage-actions
description: |
  Review and execute bounded Gmail or Outlook actions through IntentMail,
  including read state, archive, flag, move, draft-text generation, and local
  deletion staging. Use when acting on selected inbox items; trigger with
  "archive these", "flag for follow-up", "draft replies", or "clean my inbox".
allowed-tools: 'mcp__intentmail__mail_daily_digest, mcp__intentmail__mail_action, mcp__intentmail__mail_draft, mcp__intentmail__mail_stage_delete, mcp__intentmail__mail_list_staged, mcp__intentmail__mail_unstage'
version: 0.5.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Requires the IntentMail plugin, Node.js 20+, a configured Gmail or Outlook OAuth account, and an AI provider for draft generation. Provider actions are immediate after confirmation; draft output is text only, and deletion staging affects only the local cache.'
tags: [email, triage, actions, archive, draft, gmail, outlook]
argument-hint: '[accountId] [scope and action]'
model: inherit
effort: high
---

# Email Triage Actions

## Overview

Turn a scoped review into explicit provider actions with per-message receipts.
The plan is a human-readable preview; `mail_action` itself has no dry-run flag,
so do not call it until the user confirms the exact operation and messages.

## Prerequisites

- Run IntentMail on Node.js 20 or newer.
- Connect the target Gmail or Outlook account through IntentMail OAuth.
- Configure an AI provider before requesting draft generation.

## Authentication and privacy

- Require an account connected through `mail_auth_start`; never request OAuth
  credentials or AI keys in chat.
- Provider actions use the user's Gmail or Microsoft Graph token. OAuth tokens
  and the cache remain local.
- Cloud AI providers receive content supplied for draft generation; Ollama can
  keep inference local. No send tool is permitted by this skill.
- See the [action safety contract](references/action-safety.md).

## Workflow

1. Call `mcp__intentmail__mail_daily_digest` only when candidates were not
   already supplied. Bound the account, time window, and item count.
2. Present a plan containing each local email ID, subject, requested operation,
   provider effect, local effect, and known reversal. Do not hide bulk scope
   behind phrases such as "clean everything".
3. Obtain explicit confirmation for that exact plan. Any changed scope or
   operation requires a new confirmation.
4. For mark-read/unread, archive, flag/unflag, or move, call
   `mcp__intentmail__mail_action` one message at a time and record `newState`.
5. For a reply, call `mcp__intentmail__mail_draft`. It generates draft text;
   it does not create a Gmail/Outlook draft and cannot send. Return the text
   for user review without implying it was saved remotely.
6. For deletion requests, call `mcp__intentmail__mail_stage_delete` with
   `backupMime: true`, review via `mcp__intentmail__mail_list_staged`, and stop.
   Staging is local only. Permanent provider deletion is not implemented or
   permitted in this skill. Use `mcp__intentmail__mail_unstage` to cancel.
7. Report individual successes and failures. Never retry a provider mutation
   blindly when the result is ambiguous.

## Approval boundaries

- **Read:** a digest may be built within the user's stated scope.
- **Confirm once per exact plan:** mark state, archive, flag, or move actions.
- **Confirm before local staging:** show every message selected for staging.
- **Not permitted:** sending mail, committing local deletions, provider
  deletion, bulk scope expansion, or claiming an audit/rollback receipt that
  direct actions do not produce.

## Validation

- Match every result's email ID and operation to the approved plan.
- Treat `success` plus the returned `newState` as the receipt for direct
  actions; do not claim all direct actions are in the rule audit log.
- Verify generated draft text contains no invented recipients, commitments, or
  attachments before returning it.
- Verify staged count and IDs with `mail_list_staged`; never equate staging with
  provider deletion.

## Output

Return the approved scope, operation per message, provider/local effect,
`newState` receipts, draft text awaiting review, staged IDs and retention,
failures, ambiguous outcomes, and any manual provider-side step still required.

## Error Handling

- **Not authenticated:** stop and direct the user to the explicit OAuth flow.
- **Ambiguous or partial provider result:** stop that item and report it; do not
  assume the mutation failed or succeeded.
- **Unsupported send/delete/unsubscribe request:** explain the current boundary.
  The consolidated tool's `unsubscribe` operation only archives today, so this
  skill does not represent it as an unsubscribe.
- **Bad draft:** discard the output and ask for corrected facts or tone; never
  send or claim a provider draft exists.
- **Wrong staged item:** unstage it before doing anything else.

## Examples

```text
For account 1, show the five newsletters you propose to archive. Wait for my
confirmation, then archive them one at a time and report each newState.
```

```text
Generate reply text for email 42 in a concise professional tone. Do not save or
send it. Return the draft and any uncertain facts for my review.
```

## Resources

- [Action safety contract](references/action-safety.md)
- Provider action implementation: `src/connectors/email-actions.ts`
- Deletion staging: `src/storage/services/deletion-staging.ts`
