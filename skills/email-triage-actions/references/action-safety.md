# IntentMail Action Safety Contract

Use this matrix before presenting or executing an inbox action. Provider writes
are immediate; the current consolidated `mail_action` tool does not implement a
dry-run or a universal transaction.

## Action matrix

| Operation | Provider effect | Local effect | Known reversal |
| --- | --- | --- | --- |
| `mark_read` | Gmail/Outlook state changes | Flags updated | Call with `isRead: false` |
| `flag` | Outlook flag or Gmail STARRED changes | Flags updated | Call with `flagged: false` |
| `archive` | Outlook archive or Gmail INBOX removal | Labels updated | No guaranteed exact inverse receipt |
| `move` | Outlook move or Gmail label application | Labels updated best effort | Requires known prior destination |
| draft generation | None | Returns generated text | Discard the text |
| deletion staging | None | Local deletion queue entry | `mail_unstage` before commit |

The tool's `unsubscribe` operation currently archives only. Do not describe or
execute it as an actual unsubscribe request.

## Confirmation protocol

1. Identify the account and bound the candidate set.
2. Show local email ID, subject, operation, and destination or state.
3. Explain provider and local effects plus reversal limits.
4. Ask for explicit confirmation of the exact list.
5. Execute one item at a time.
6. Record the returned `success`, operation, and `newState`.
7. Stop on ambiguous failures instead of repeating a write blindly.

If the user changes the list, action, or destination, present a new plan and
obtain a new confirmation.

## Draft boundary

`mail_draft` generates text for `generate`, `quick_reply`, `suggest`, or
`improve` modes. It does not create a provider-side draft and does not send.
Review recipients, claims, dates, commitments, links, and attachments before
returning the text. Never report the draft as saved or queued remotely.

## Deletion boundary

`mail_stage_delete` marks local cached messages and can create MIME backups.
Always set `backupMime: true`, list the staged items, and stop. Provider deletion
is not implemented by `mail_commit_deletions`; that tool permanently removes
only local database rows and is intentionally outside this skill's allow-list.

Staging and unstage operations do not change the Gmail or Outlook mailbox. Tell
the user when a manual provider-side deletion is still required.

## Audit and rollback boundary

The rule audit log and `mail_rollback` cover rule-engine executions. Do not claim
that every direct `mail_action` write is recorded there or universally
rollbackable. The per-operation `newState` response is the direct-action
receipt; reversibility depends on the matrix above.

## Receipt

Return the approved scope, each attempted action, provider/local effect,
`newState`, success or failure, draft text awaiting review, staged IDs,
reversal limitations, ambiguous outcomes, and any remaining manual step.
