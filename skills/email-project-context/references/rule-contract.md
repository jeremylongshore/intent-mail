# IntentMail Rule Contract

Ground every proposed rule in `src/types/rule.ts` and the current rule engine.
The rule subsystem operates on the local IntentMail cache; its actions are not
routed through the Gmail or Outlook provider clients.

## Supported triggers

- `manual`
- `on_new_email`
- `scheduled`

Prefer `manual` unless the user explicitly approves automatic execution.

## Supported conditions

Fields: `from`, `to`, `cc`, `subject`, `body`, `label`, `has_attachment`,
`thread_size`, and `date`.

Operators: `equals`, `not_equals`, `contains`, `not_contains`,
`matches_regex`, `greater_than`, `less_than`, `in`, and `not_in`.

All conditions in one rule use AND logic. Regex failures currently produce a
non-match, so test regex conditions against a bounded representative set.

## Supported actions

Use these implemented local-cache actions:

- `add_label` and `remove_label`;
- `mark_read` and `mark_unread`;
- `archive` (remove the local `INBOX` label);
- `move_to_trash` (add local `TRASH`, remove local `INBOX`).

Do not generate `set_priority`; it is not in the schema. Treat priority prose
as AI context. Do not propose `forward`; the enum exists but execution is not
implemented. Avoid `delete`: the current engine aliases it to local trash and
does not delete a provider message.

## Creation and execution

1. List existing rules and compare full condition/action definitions.
2. Show the proposed rule and obtain confirmation before creation.
3. Create exactly the approved account, trigger, conditions, actions, and
   active state.
4. List the result and record its rule ID.
5. Call `mail_apply_rule` with `dryRun: true`, an explicit account or rule ID,
   a bounded message query, and a bounded limit.
6. Report matches and proposed local actions.
7. Require separate confirmation before `dryRun: false`.

Dry-run rule executions are audit logged by the current engine. Rollback
applies to rule execution state, not unrelated direct provider actions.

## Deletion

`mail_delete_rule` permanently removes the rule definition. Show the complete
rule, its ID, account, trigger, conditions, actions, and active state before
requesting confirmation. Deleting a rule does not undo earlier executions.

## Receipt

Return source context, unsupported intent, exact rule definitions, account IDs,
confirmation, created or deleted IDs, dry-run flag, message scope and limit,
match/action counts, local-only execution boundary, errors, and next decision.
