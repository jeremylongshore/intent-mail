---
name: email-project-context
description: |
  Teach IntentMail your projects, clients, and priorities in plain language,
  then translate that context into concrete filing/priority rules. Reads a
  human-written context file (context/projects.md), and for filing or
  prioritization intent ("anything from Acme is high priority and goes to the
  Clients folder") proposes the equivalent IntentMail rules, previews them as
  a dry-run, and only creates them on confirmation. Use when you want the
  inbox to understand your business context, set up auto-filing/auto-priority
  rules, file mail by project or client, or review/adjust existing rules.
  Trigger with "/email-project-context", "set up my email rules", "file mail
  by project", "make Acme high priority", "teach my inbox about my projects".
allowed-tools: 'Read, mcp__intentmail__mail_create_rule, mcp__intentmail__mail_list_rules, mcp__intentmail__mail_apply_rule, mcp__intentmail__mail_delete_rule'
version: 0.4.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Designed for Claude Code; ships with the intent-mail plugin, which auto-wires the local intentmail MCP server (stdio). Reads context/projects.md from the working directory (a projects.example.md template ships with the plugin). Requires a configured account.'
tags: [email, rules, context, projects, gmail, outlook]
argument-hint: '[project or client]'
---

# Email Project Context — turn plain-language context into rules

## Overview

People do not think in rule engines; they think "mail from my accountant is
important," "newsletters can wait," "anything about the Q3 launch goes in one
place." This skill bridges that: read the user's plain-language project/client
context and translate filing + priority intent into deterministic IntentMail
rules — always previewed before anything is created. The rules are additive to
AI triage; the richer the context, the better the daily check-in understands
what matters.

## Prerequisites

- The intent-mail plugin installed (auto-wires the local `intentmail` MCP
  server over stdio).
- A `context/projects.md` file (copy the shipped `context/projects.example.md`
  and edit it in plain language).
- A configured account via `mail_auth_start`.

## Instructions

1. **Load context.** `Read` `context/projects.md`. If it does not exist, point
   the user at `projects.example.md` and offer to help fill it in.
2. **Find filing / priority intent.** Lines like "everything from `@acme.com` is
   high priority and files under Clients" or "treat newsletters as low priority"
   map cleanly to a rule (a condition + an action).
3. **Propose the rules as a dry-run.** For each piece of intent, state the exact
   rule you would create — condition (from / subject / contains) and action
   (set priority / add label / move / archive) — and ask for confirmation. Do
   NOT create rules silently.
4. **Create on confirmation.** Call `mcp__intentmail__mail_create_rule` per
   approved rule. Use `mcp__intentmail__mail_list_rules` to show what exists and
   avoid duplicates, `mcp__intentmail__mail_apply_rule` to test a rule against
   current mail, and `mcp__intentmail__mail_delete_rule` to remove one.
5. **Verify.** List the rules back so the user sees the result, and optionally
   apply them to preview their effect on the current inbox.

## Output

The set of rules created (each as a plain-language condition → action), the
result of listing existing rules, and — when requested — a preview of how the
rules classify the current inbox.

## Error Handling

- **Always preview before creating** — show the condition/action in plain words;
  never create a rule silently.
- **No context file** → point at `projects.example.md`; do not invent context
  the user did not state.
- **Ambiguous intent** → ask which sender/subject/label is meant rather than
  guessing.
- **Duplicate rule** → check `mail_list_rules` first and skip/replace instead of
  stacking duplicates.

## Examples

`context/projects.md` contains: "Anything from @acme.com is high priority and
files under Clients/Acme." → propose: *Rule: when from contains `@acme.com` →
set priority high + add label `Clients/Acme`.* On confirmation,
`mail_create_rule` with that condition/action, then `mail_apply_rule` to preview.

User: "make newsletters low priority and auto-file them." → propose a rule
matching common newsletter signals → on confirmation create it → list rules back.

## Resources

- Context template: `context/projects.example.md`.
- Rule engine: `src/rules/engine.ts`; rule tools `mail_create_rule` /
  `mail_apply_rule` (dry-run support).
- Companion skills: `email-checkin`, `email-triage-actions`.
