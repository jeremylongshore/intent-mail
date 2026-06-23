# Reply draft — "the lady's" Outlook + Claude question

> **Status:** draft for Jeremy to review/send. Tone: blunt, honest about v0.x,
> no overpromising. Post as a comment/DM reply to her LinkedIn thread.

---

You're not missing anything — your option (e) is the right one, and the security
worry you flagged is exactly the right instinct. Here's the honest lay of the land:

- **Claude's M365 connector is read-only** — great for "summarize my inbox,"
  can't take actions.
- **Claude's Outlook add-in** reads threads and *drafts* replies, but takes no
  actions (no move/flag/delete/send).
- **Copilot** can act now, but it's locked to the Microsoft ecosystem and you
  can't really inject your own project context.
- **Zapier** works for 2-step flows; at 200+ emails/day with multi-step logic it
  gets expensive fast — you read that right.
- **Open-source MCP + Claude Code** is the only path that does everything you
  listed (context injection, daily digest, group/summarize/flag, real actions).
  The catch you correctly spotted is **public-MCP trust** — random npm MCP
  servers are a supply-chain and prompt-injection risk (most are
  single-maintainer; email *content* itself can carry injection).

**The fix for that risk is self-hosting an auditable one-repo MCP where *you*
hold the OAuth token and no third party ever sees your mailbox.** That's exactly
what I built — `intent-mail`. It already does Outlook OAuth, daily-check-in
triage (P1–P4 + "why" + needs-response), long-chain summaries, group-by-category,
and the basic actions (read/archive/delete/draft/flag/move) through Microsoft
Graph. The visual "live-artifact" daily-review surface you described is what I'm
finishing now, plus a Claude Code plugin so install is one step.

To run it you'll need: an Azure app registration (delegated `Mail.ReadWrite` +
`Mail.Send` + `offline_access`), Node 20+, and an AI key (Anthropic/OpenAI/Groq —
or local Ollama for free). It's still v0.x and I'm hardening the Outlook side this
week — happy to walk you through setup and point you at the exact build that
lands the visual digest.

---

## Sourced verdicts on her 5 options (for Jeremy's reference, not for the reply)

| Option | Verdict | Why |
| --- | --- | --- |
| Claude + M365 connector | Read-only (true) | Analyzes mail, cannot send/move/flag (Anthropic support docs). |
| Outlook + Copilot | Agentic but MS-locked | Triages/acts in 2026, but thin custom-context + ecosystem lock-in. |
| Outlook + Claude add-in | Read + draft only | Reads threads/attachments, drafts replies; no programmatic actions. |
| M365 connector + Zapier | Scales badly | 2-action Zaps cheap; multi-step at 200+/day hits overage pricing. |
| Claude Code + OSS MCP + visual UI | Right instinct; security is the only blocker | Best technical fit; self-hosting an auditable single repo removes the public-MCP risk. = intent-mail. |

Public-MCP risk to convey: prompt-injection from email *content*, npm
supply-chain (most MCP packages single-maintainer), OAuth-token handling.
Mitigation: self-host an auditable single-repo MCP; user owns the token; no third
party sees the mailbox.
