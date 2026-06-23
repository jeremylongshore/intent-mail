---
name: email-checkin
description: |
  Read-only daily email check-in over Gmail or Outlook. Syncs the latest
  messages into the local store, then triages them (P1–P4 priority with a
  one-line "why", action-type, urgency signals, and detected deadlines),
  summarizes long threads, groups by category, and surfaces the
  high-priority and needs-response items as a single digest. Takes NO
  actions — purely a morning "what needs me today" briefing. Use when you
  want to check your inbox, get a daily digest, see what is high priority or
  needs a response, or catch up on long email threads. Trigger with
  "/email-checkin", "check my inbox", "daily email digest", "what needs a
  response", "what's high priority in my email".
allowed-tools: 'mcp__intentmail__mail_list_accounts, mcp__intentmail__mail_sync, mcp__intentmail__mail_daily_digest, mcp__intentmail__mail_triage, mcp__intentmail__mail_summarize, mcp__intentmail__mail_search'
version: 0.4.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Designed for Claude Code; ships with the intent-mail plugin, which auto-wires the local intentmail MCP server (stdio). Requires a configured Gmail or Outlook account (mail_auth_start) and an AI provider key. Self-hosted — the mailbox never leaves your machine.'
tags: [email, inbox, triage, digest, gmail, outlook]
argument-hint: '[accountId | email]'
---

# Email Check-in — your read-only daily inbox briefing

A morning briefing over your own mailbox. This skill **reads and reasons; it never
mutates.** No archiving, no sending, no flag changes — that is the
`email-triage-actions` skill's job. The point is a fast, honest "what actually
needs me today" without touching anything.

## What it produces

A single digest with:

1. **Stats header** — e.g. `45 new · 12 need response · 3 high-priority`.
2. **Priority-ranked groups** — category sections (Work, Clients, Finance, …),
   each ordered by priority.
3. **Per-email line** — priority chip (P1–P4), the **"why"** (one line on *why it
   was ranked this way*), action-type, urgency signals, any detected deadline,
   and a one-line summary. Long threads are collapsed to a `summarized ×N` line.

## How to run it

1. **Pick the account.** If the user named one, resolve it; otherwise call
   `mcp__intentmail__mail_list_accounts` and use the active account (ask if
   there are several).
2. **Sync first.** Call `mcp__intentmail__mail_sync` for that account so the
   digest reflects the latest mail (initial sync if it has never synced, delta
   otherwise — the tool decides).
3. **Build the digest.** Call `mcp__intentmail__mail_daily_digest` with the
   account id. This one call returns the full structured payload (stats, groups,
   per-email priority/why/summary/deadline). Prefer it over manual assembly.
4. **Render it** as a clean, scannable briefing. Lead with the stats header,
   then the high-priority and needs-response items, then the rest grouped by
   category. Keep each item to its priority + why + one-line summary.

### Fallback (if the digest tool is unavailable)

Assemble the same picture manually:
- `mcp__intentmail__mail_triage` for priority + why + action-type.
- `mcp__intentmail__mail_summarize` for long-thread summaries.
- `mcp__intentmail__mail_search` to scope the window (e.g. unread, last 24h).

## Boundaries

- **Read-only.** If the user asks to archive/flag/delete/draft/move, hand off to
  the `email-triage-actions` skill — do not attempt those tools here (they are
  not in this skill's allow-list).
- **No overpromising.** Report what triage actually found. If priority is
  uncertain, say so rather than inventing urgency.
- **Self-hosted.** Everything runs locally against the user's own OAuth token;
  never suggest uploading the mailbox anywhere.

## Example

> **Inbox check-in — 45 new · 12 need response · 3 high-priority**
>
> **🔴 High priority**
> - **P1 · Acme contract redline** — *why: client + hard deadline tomorrow 5pm.*
>   They want section 4 changed before signing. (needs response)
> - **P1 · Wire confirmation** — *why: finance + money movement.* Bank flagged
>   the transfer for verification.
>
> **🟡 Needs response (10 more)** …
>
> **Work (18)** · **Newsletters (9, summarized)** …
