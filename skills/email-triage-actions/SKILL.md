---
name: email-triage-actions
description: |
  Take real inbox actions over Gmail or Outlook — mark read, archive, flag,
  move/relabel, draft replies, and (two-phase) delete — driven by triage.
  Safety-first: mutating operations preview a dry-run before executing,
  drafts are created but NEVER auto-sent, deletes are staged then committed
  separately, and every action is written to an audit log that supports
  rollback. Use when you want to act on your inbox: clear it, archive
  newsletters, flag what needs follow-up, draft replies to the items that
  need a response, or file mail into folders/labels. Trigger with
  "/email-triage-actions", "act on my inbox", "archive these", "flag for
  follow-up", "draft replies", "clean up my inbox", "move to folder".
allowed-tools: 'mcp__intentmail__mail_daily_digest, mcp__intentmail__mail_triage, mcp__intentmail__mail_action, mcp__intentmail__mail_flag, mcp__intentmail__mail_move, mcp__intentmail__mail_apply_label, mcp__intentmail__mail_draft, mcp__intentmail__mail_stage_delete, mcp__intentmail__mail_list_staged, mcp__intentmail__mail_unstage, mcp__intentmail__mail_commit_deletions, mcp__intentmail__mail_get_audit_log, mcp__intentmail__mail_rollback'
version: 0.4.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Designed for Claude Code; ships with the intent-mail plugin, which auto-wires the local intentmail MCP server (stdio). Mutating actions write through to Gmail / Microsoft Graph using your own OAuth token. Requires a configured account and an AI provider key.'
tags: [email, triage, actions, archive, draft, gmail, outlook]
argument-hint: '[what to do]'
---

# Email Triage Actions — act on your inbox, safely

## Overview

This skill takes **real actions** on the user's mailbox. Because mistakes here
are costly (a wrongly-deleted contract, an auto-sent half-baked reply), every
operation runs through guardrails: dry-run before mutating, drafts are never
auto-sent, deletes are two-phase (stage then commit), and every action is
audited and reversible.

## Prerequisites

- The intent-mail plugin installed (auto-wires the local `intentmail` MCP
  server over stdio).
- A configured account via `mail_auth_start` (Gmail or Outlook).
- An AI provider key for triage-driven selection.

## Instructions

1. **Decide what to act on.** Use `mcp__intentmail__mail_daily_digest` or
   `mcp__intentmail__mail_triage` to identify candidates (e.g. all P4
   newsletters to archive, all P1 needs-response to draft).
2. **Propose a plan (dry-run).** "I'll archive these 9 newsletters, flag these 3
   for follow-up, and draft replies to these 2. OK?" — list the subjects and
   wait for confirmation.
3. **Execute on confirmation.** Route each change through the right tool:
   - mark read / archive / flag / move → `mcp__intentmail__mail_action` (or the
     specific `mail_flag` / `mail_move` / `mail_apply_label`).
   - reply needed → `mcp__intentmail__mail_draft` (draft only — never send).
   - delete → `mcp__intentmail__mail_stage_delete`, review with
     `mcp__intentmail__mail_list_staged`, then `mcp__intentmail__mail_commit_deletions`
     after explicit confirmation; `mcp__intentmail__mail_unstage` reverses a
     staging mistake.
4. **Report results** — show the `newState` from `mail_action`, which drafts are
   waiting for review, and what was staged for deletion.

## Output

A summary of what changed: per-email new state (read/flagged/labels/staged),
drafts created and awaiting the user's review/send, and any emails staged for
deletion pending commit. If the user says "undo that", use
`mcp__intentmail__mail_get_audit_log` + `mcp__intentmail__mail_rollback`.

## Error Handling

- **Never send email.** `mail_draft` creates a draft only; no send tool is in
  this skill's allow-list. Present drafts for the user to send themselves.
- **Never hard-delete.** Always stage → confirm → commit. Reverse a bad staging
  with `mail_unstage` before commit; reverse a committed action via the audit
  log + `mail_rollback`.
- **Never exceed scope.** Act only on what the user approved; destructive ops
  always confirm first. Under-acting is safe; over-acting is not.
- **Uncertain importance** → leave the email and say so.
- **Not authenticated** → tell the user to run `mail_auth_start`.

## Examples

User: "clean up my inbox." →
1. `mail_daily_digest` to find P4 newsletters + read-and-done items.
2. Propose: "Archive these 9, flag these 3 for follow-up, draft replies to these
   2 — OK?" (list subjects).
3. On yes: `mail_action {op:'archive'}` for each newsletter, `mail_action
   {op:'flag'}` for the follow-ups, `mail_draft {mode:'reply'}` for the two.
4. Report the new states + the two drafts waiting for review.

User: "delete all the spam." → `mail_stage_delete` the candidates →
`mail_list_staged` to show them → on confirmation `mail_commit_deletions`.

## Resources

- Read surface / digest: `email-checkin` skill, `mail_daily_digest`.
- Action engine: `src/connectors/email-actions.ts` (shared by `mail_action`).
- Two-phase delete: `src/storage/services/deletion-staging.ts`.
