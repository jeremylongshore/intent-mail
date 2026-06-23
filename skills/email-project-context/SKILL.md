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

People do not think in rule engines; they think "mail from my accountant is
important," "newsletters can wait," "anything about the Q3 launch goes in one
place." This skill bridges that: read the user's plain-language project/client
context and translate filing + priority intent into deterministic IntentMail
rules — always previewed before anything is created.

## The context file

Project context lives in **`context/projects.md`** (a `projects.example.md`
template ships with the plugin). It is plain Markdown: a section per
project/client with who/what/priority/where-it-files. Read it with the `Read`
tool at the start of a session so you understand the user's world before
proposing rules.

## How to translate context into rules

1. **Load context.** `Read` `context/projects.md`. If it does not exist, point the
   user at `projects.example.md` and offer to help them fill it in.
2. **Find filing / priority intent.** Lines like "everything from `@acme.com` is
   high priority and files under Clients" or "treat newsletters as low priority"
   map cleanly to rules (a condition + an action).
3. **Propose the rules as a dry-run.** For each piece of intent, state the exact
   rule you would create — condition (from/subject/contains) and action
   (set priority / add label / move / archive) — and ask for confirmation.
   Do NOT create rules silently.
4. **Create on confirmation.** Call `mcp__intentmail__mail_create_rule` for each
   approved rule. Use `mcp__intentmail__mail_list_rules` to show what exists and
   avoid duplicates, `mcp__intentmail__mail_apply_rule` to test a rule against
   current mail, and `mcp__intentmail__mail_delete_rule` to remove one.
5. **Verify.** After creating, list the rules back so the user sees the result,
   and optionally apply them to preview their effect on the current inbox.

## Boundaries

- **Rules are deterministic and additive** to the AI triage — they encode the
  user's explicit, stable preferences (this client matters, that sender is noise).
  Use them for clear filing/priority intent; leave nuanced judgment to triage.
- **Always preview before creating.** Show the condition/action in plain words.
- **Context also feeds triage and drafts.** The same project context can be
  injected into drafting and prioritization; mention that the richer the
  `projects.md`, the better the daily check-in understands what matters.
- Never invent context the user did not state; if a rule is ambiguous, ask.
