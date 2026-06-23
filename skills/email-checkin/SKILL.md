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

## Overview

A morning briefing over your own mailbox. This skill **reads and reasons; it
never mutates.** No archiving, no sending, no flag changes — that is the
`email-triage-actions` skill's job. The point is a fast, honest "what actually
needs me today" without touching anything. It produces a stats header,
priority-ranked category groups, and a per-email line carrying the priority,
the **"why"**, action-type, urgency signals, any deadline, and a one-line
summary (long threads collapsed to a `summarized ×N` line).

## Prerequisites

- The intent-mail plugin installed (auto-wires the local `intentmail` MCP
  server over stdio).
- A configured account via `mail_auth_start` (Gmail or Outlook).
- An AI provider key (Anthropic / OpenAI / Groq, or local Ollama) — triage and
  summarization are AI-backed.

## Instructions

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

If the digest tool is unavailable, assemble the same picture manually with
`mcp__intentmail__mail_triage` (priority + why + action-type),
`mcp__intentmail__mail_summarize` (long-thread summaries), and
`mcp__intentmail__mail_search` (to scope the window, e.g. unread / last 24h).

## Output

A single digest, rendered for the user:

- **Stats header** — e.g. `45 new · 12 need response · 3 high-priority`.
- **Priority-ranked groups** — category sections (Work, Clients, Finance, …),
  each ordered by priority.
- **Per-email line** — priority chip (P1–P4), the one-line "why", action-type,
  urgency signals, any deadline, and a one-line summary. Long threads collapse
  to a `summarized ×N` line.

## Error Handling

- **No accounts / not authenticated** → tell the user to run `mail_auth_start`
  first; do not guess.
- **AI provider not configured** → report that triage/summary need an AI key;
  fall back to a flat unread list from `mail_search` rather than failing silently.
- **Action requested** → this skill is read-only; if the user asks to
  archive/flag/delete/draft/move, hand off to `email-triage-actions` (those
  tools are not in this skill's allow-list).
- **Uncertain priority** → say so rather than inventing urgency.

## Examples

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

User: "what's high priority in my email this morning?" → sync the active
account, call `mail_daily_digest`, render the high-priority + needs-response
groups first.

## Resources

- `mail_daily_digest` payload shape: `src/ai/daily-digest.ts` (`DailyDigest`).
- Visual rendering: `artifacts/daily-review.html`.
- Companion mutating skill: `email-triage-actions`.
