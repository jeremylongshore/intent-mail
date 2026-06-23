# IntentMail Artifacts

Self-contained visual surfaces that render IntentMail data.

## `daily-review.html` — the live daily-review artifact

An interactive, single-file daily-email review. It renders the structured
payload produced by the **`mail_daily_digest`** MCP tool: a stats header,
priority-ranked category groups, and per-email rows showing the priority chip,
an always-visible **"why"** line, a `thread ×N` badge for collapsed threads, a
summary, any deadline, and an action button bar.

### Using it with Claude

1. Ask Claude for your daily review — the `email-checkin` skill calls
   `mail_daily_digest`.
2. Claude renders this artifact, injecting the digest as `window.__DIGEST__`
   (or via `postMessage({ type: 'intentmail:digest', digest })`).
3. Click an action (archive / flag / move / stage delete / draft reply). Because
   artifacts are sandboxed and cannot call MCP tools directly, each button
   **emits the exact `mail_action` / `mail_draft` call** — it copies the request
   to your clipboard, posts an `intentmail:action` message to the host, and
   optimistically updates the row. Ask Claude to run the copied call, or use the
   web app (`src/web`), which round-trips the same actions through a local
   `/api` against the very same engine.

The file ships with a sample payload so it renders standalone in any browser;
replace `window.__DIGEST__` with real output to use your own inbox.

The payload shape is defined by `DailyDigest` in `src/ai/daily-digest.ts`.
