---
name: email-project-context
description: |
  Translate plain-language project and client context into supported, reviewable
  IntentMail rules without inventing conditions or actions. Use when designing,
  previewing, creating, or removing local inbox rules; trigger with "set up my
  email rules", "file mail by project", or "review my rules".
allowed-tools: 'Read, mcp__intentmail__mail_list_accounts, mcp__intentmail__mail_create_rule, mcp__intentmail__mail_list_rules, mcp__intentmail__mail_apply_rule, mcp__intentmail__mail_delete_rule'
version: 0.5.1
author: Jeremy Longshore <jeremy@intentsolutions.io>
license: Apache-2.0
compatibility: 'Requires the IntentMail plugin, Node.js 20+, a configured account, and a working-directory context/projects.md file. Current rule execution changes IntentMail local cache state; it does not write rule actions through to Gmail or Microsoft Graph.'
tags: [email, rules, context, projects, gmail, outlook]
argument-hint: '[accountId] [project | client | rule]'
model: inherit
effort: high
---

# Email Project Context

## Overview

Read user-authored context and translate only the portions supported by the
current IntentMail rule schema. Preview the exact local rule before creation;
never turn descriptive business context into automation silently.

## Prerequisites

- Run IntentMail on Node.js 20 or newer with a connected account.
- Provide `context/projects.md` in the working directory, or start from the
  bundled `context/projects.example.md` template.

## Authentication and execution boundary

- Require an account previously connected through `mail_auth_start`; never
  request OAuth tokens in chat.
- `mail_create_rule`, `mail_apply_rule`, and `mail_delete_rule` change the local
  IntentMail database. The current rule engine does not propagate those rule
  actions to Gmail or Microsoft Graph.
- Treat priority guidance as AI context, not a rule action: `set_priority` is
  not in the current rule schema.
- See the [supported rule contract](references/rule-contract.md).

## Workflow

1. Resolve the account with `mcp__intentmail__mail_list_accounts`. Ask when
   more than one active account could match.
2. `Read` `context/projects.md`. If absent, point to
   `context/projects.example.md`; do not create or infer user context.
3. Separate descriptive context from executable intent. Preserve client,
   project, and priority prose for triage. Translate only supported conditions
   and actions listed in the rule contract.
4. Call `mcp__intentmail__mail_list_rules` and identify duplicates or conflicts.
5. Present each proposed rule in plain language and exact fields: account ID,
   name, trigger, AND-combined conditions, ordered actions, and active state.
   Explain that this is a textual proposal, not a tool-level dry-run.
6. After explicit confirmation, call `mcp__intentmail__mail_create_rule` for
   the approved rules. Prefer a `manual` trigger unless the user explicitly
   approved `on_new_email` or `scheduled` behavior.
7. List the created rules, then test with `mcp__intentmail__mail_apply_rule`
   and `dryRun: true`. Report match and action counts without applying changes.
8. Use `dryRun: false` only after a separate confirmation that names the rule,
   message scope, limit, and local-cache effects.
9. Before `mcp__intentmail__mail_delete_rule`, show the rule ID and complete
   rule definition and obtain explicit confirmation; deletion is permanent.

## Validation

- Use only schema-supported condition fields, operators, triggers, and actions.
- Confirm every created rule belongs to the intended account and matches the
  approved proposal.
- Keep regexes narrow and test them in dry-run mode against a bounded scope.
- Never report provider-side filing, forwarding, trashing, or priority changes;
  the current rule engine operates on local cached state.

## Output

Return the source context lines, unsupported intent, conflicts, exact proposed
rules, confirmation received, created/deleted rule IDs, dry-run scope, match
counts, local actions that would occur, errors, and the next user decision.

## Error Handling

- **Missing context:** stop and point to the example file.
- **Unsupported priority or forwarding request:** retain it as context or mark
  it unsupported; do not synthesize an invalid rule.
- **Ambiguous sender, folder, or account:** ask for the exact value.
- **Duplicate/conflicting rule:** show both definitions and require a choice.
- **Dry-run failure:** do not retry with `dryRun: false`.
- **Provider-side automation requested:** explain the local-only limitation and
  do not claim the provider mailbox changed.

## Examples

```text
For account 2, read context/projects.md and propose a manual rule that labels
mail from @acme.com as Clients/Acme. Create it only after I confirm, then run a
dry-run over at most 25 cached messages.
```

```text
Review existing rules for account 1. Show duplicates and unsupported actions;
do not apply or delete anything.
```

## Resources

- [Supported rule contract](references/rule-contract.md)
- Context template: `context/projects.example.md`
- Rule schema: `src/types/rule.ts`
