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

This skill takes **real actions** on the user's mailbox. Because mistakes here are
costly (a wrongly-deleted contract, an auto-sent half-baked reply), every
operation runs through guardrails. Follow them exactly.

## The four non-negotiable guardrails

1. **Dry-run before mutating.** For any batch of changes, first show the user the
   exact plan — which emails, which op (read/archive/flag/move/label) — and get a
   confirmation before executing. `mcp__intentmail__mail_action` returns the new
   state per row; surface it so the user sees what changed.
2. **Drafts are never auto-sent.** `mcp__intentmail__mail_draft` creates a draft
   only. Never call any send tool from this skill (it is not in the allow-list).
   Present the draft for the user to review and send themselves.
3. **Deletes are two-phase.** Never hard-delete. Use
   `mcp__intentmail__mail_stage_delete` to stage, show the staged set with
   `mcp__intentmail__mail_list_staged`, and only after explicit confirmation call
   `mcp__intentmail__mail_commit_deletions`. `mcp__intentmail__mail_unstage`
   reverses a staging mistake before commit.
4. **Everything is auditable + reversible.** Actions land in the audit log
   (`mcp__intentmail__mail_get_audit_log`); `mcp__intentmail__mail_rollback`
   reverses a recorded action. If the user says "undo that", reach for rollback.

## Typical flow

1. **Decide what to act on.** Use `mcp__intentmail__mail_daily_digest` or
   `mcp__intentmail__mail_triage` to identify candidates (e.g. all P4 newsletters
   to archive, all P1 needs-response to draft).
2. **Propose a plan (dry-run).** "I'll archive these 9 newsletters, flag these 3
   for follow-up, and draft replies to these 2. OK?" — list the subjects.
3. **Execute on confirmation.** Route each change through the right tool:
   - mark read / archive / flag / move → `mcp__intentmail__mail_action` (or the
     specific `mail_flag` / `mail_move` / `mail_apply_label`).
   - reply needed → `mcp__intentmail__mail_draft` (draft only).
   - delete → stage (`mail_stage_delete`) → confirm → `mail_commit_deletions`.
4. **Report results.** Show what changed (the `newState` from `mail_action`), what
   drafts are waiting for review, and what was staged for deletion.

## Hard rules

- Never send email. Never hard-delete without the stage→confirm→commit cycle.
- Never act on more than the user asked for. Destructive ops always confirm first.
- If unsure whether an email is important, leave it and say so — under-acting is
  safe, over-acting is not.
- Self-hosted: writes go straight to the user's provider via their token; no third
  party is involved.
