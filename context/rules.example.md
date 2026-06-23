# Triage rules (plain language)

Copy this file to `context/rules.md`. Write your prioritization preferences in
plain English — IntentMail injects them as **soft guidance** into AI triage.
This is additive to the deterministic rules engine (which encodes exact
conditions/actions); use this file for the fuzzy judgment calls.

- Anything from my accountant (`@myaccountant.com`) or the bank is high priority.
- Treat invoices, wire confirmations, and contracts as needing a same-day response.
- Mail from active clients (Acme, anything `@acme.com`) outranks internal mail.
- Newsletters, digests, and marketing are low priority — fine to archive.
- Automated notifications (CI, monitoring, no-reply senders) are low priority.
- Anything with a deadline in the next 48 hours should be flagged regardless of
  sender.
- If a thread has been going back and forth today, treat the latest message as
  needing a response.
