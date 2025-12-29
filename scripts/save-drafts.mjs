import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '../secrets/workspace-service-account.json');
const key = JSON.parse(readFileSync(keyPath, 'utf8'));

const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/gmail.compose'],
  subject: 'jeremy@intentsolutions.io'
});

const gmail = google.gmail({ version: 'v1', auth });

const drafts = [
  { to: 'spai@cloudflare.com', subject: 'Workers AI plugin pack for Claude Code developers', body: `Hi Sunil —

Saw your work on the @cloudflare/ai SDK and the AI Gateway integration — the streaming + tool calling support is solid.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We auto-activate skills based on what devs are building.

Quick pitch: A Workers AI plugin pack that helps developers:

- Scaffold Workers AI projects with best-practice patterns (binding configs, streaming, error handling)
- Integrate AI Gateway for caching and rate limiting
- Debug common issues (model selection, token limits, CORS)

What I'm asking for:

1. Workers AI credits to build and maintain the pack
2. Permission to display "Sponsored by Cloudflare" (logo + link) on the README and marketplace

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'lkilpatrick@google.com', subject: 'Gemini + Vertex AI plugin pack for Claude Code', body: `Hi Logan —

Congrats on the move to Google — saw you're leading DevRel for AI Studio and Gemini. Your OpenAI community work was great, excited to see what you build at Google.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. I'm also a Google Cloud Startup Program member with a merged PR (#580) in GoogleCloudPlatform/agent-starter-pack.

Quick pitch: A Gemini/Vertex plugin pack that helps developers:

- Set up Gemini API + Vertex AI projects with proper auth patterns
- Use Genkit for agent workflows (I already have ADK plugins)
- Debug common issues (quota, streaming, function calling schemas)

What I'm asking for:

1. API credits or Google Cloud credits to build and maintain the pack
2. Any official visibility (docs mention, blog feature, DevRel signal boost)

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)
- My Google contribution: https://github.com/GoogleCloudPlatform/agent-starter-pack/pull/580

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'webpaige@google.com', subject: 'Vertex AI plugin pack — would love your input', body: `Hi Paige —

I've followed your AI DevRel work for years — your ML explainers and community building are top-tier.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. I'm in the Google Cloud Startup Program and just got PR #580 merged into GoogleCloudPlatform/agent-starter-pack.

What I'm building: Plugin packs that auto-activate when devs work with specific tools. I already have Vertex AI + ADK plugins, but I'd love to make them official.

What I'm asking for:

1. Feedback on the Vertex/Genkit plugin workflows
2. Any path to official Google sponsorship or visibility
3. Cloud credits to expand testing

Happy to show you a quick demo — 15 min? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'paulo@railway.app', subject: 'Railway plugin pack for Claude Code developers', body: `Hi Paulo —

Railway's developer experience is best-in-class — the CLI, instant deploys, and nixpacks detection make it the fastest path from code to production.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate based on what developers are building.

Quick pitch: A Railway plugin pack that helps developers:

- Deploy apps to Railway with proper service configs
- Set up databases (Postgres, Redis, MySQL) with connection string handling
- Debug common issues (build failures, nixpacks detection, env vars)

What I'm asking for:

1. Railway credits to build and maintain the pack
2. Permission to display "Sponsored by Railway" (logo + link)

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'bfirshman@cloudflare.com', subject: 'Workers AI + Replicate plugin packs', body: `Hi Ben —

Congrats on the Cloudflare role — saw you're bringing your Replicate experience to Workers AI. The Cog container format was ahead of its time.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. Developers install skill packs that auto-activate based on what they're building.

Quick pitch: I'd love to build Workers AI + inference plugins that help developers:

- Deploy models to Workers AI with proper bindings and streaming
- Use AI Gateway for caching, logging, and rate limiting
- Handle edge inference patterns (cold starts, model selection, fallbacks)

What I'm asking for:

1. Workers AI credits to build and maintain the pack
2. Permission to display "Sponsored by Cloudflare" (logo + link)

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'swillison@gmail.com', subject: 'LLM + Datasette plugin pack idea', body: `Hi Simon —

Big fan of your work — Datasette, sqlite-utils, and especially your LLM CLI tool. Your "tools for thought" approach to AI is exactly right.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate based on developer context.

Idea: A plugin pack focused on your ecosystem:

- Datasette deployment patterns (Cloud Run, Fly.io, Vercel)
- sqlite-utils workflows for data wrangling
- LLM CLI integration for local model workflows

Not asking for money — I know you're indie. But if you'd be open to:

1. Feedback on the plugin design
2. A mention if you find it useful

I'd build it and maintain it as a community contribution.

Happy to chat: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'jason@jxnl.co', subject: 'Instructor plugin pack for Claude Code', body: `Hi Jason —

Your Instructor library is essential — structured outputs should be the default, not an afterthought. The Pydantic integration is clean.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate when developers are working on specific patterns.

Quick pitch: An Instructor-focused plugin pack that helps developers:

- Set up Instructor with different LLM providers (OpenAI, Anthropic, etc.)
- Design Pydantic models for structured extraction
- Handle validation errors and retries gracefully

What I'm asking for:

1. Your blessing to build an "official-ish" Instructor plugin
2. Any feedback on workflows that would be most useful
3. If 567 Studio does sponsorships — open to that too

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'paul@aider.chat', subject: 'Collaboration idea — Aider + Claude Code plugins', body: `Hi Paul —

Aider is impressive — the repo-map approach and git integration are smart design choices. Different philosophy than Claude Code, but both pushing AI coding forward.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ auto-activating skills.

Idea: I'm not here to compete — I think there's room for collaboration:

- Many devs use both tools for different workflows
- An "Aider patterns" plugin could help Claude Code users learn from Aider's approach
- Cross-pollination benefits both communities

What I'm asking for:

1. Your thoughts on whether this is interesting
2. Any Aider patterns you'd want surfaced in other tools
3. If you do sponsorships — I'm open to that conversation too

No pressure — just exploring: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'jmorganca@gmail.com', subject: 'Ollama plugin pack for Claude Code', body: `Hi Jeffrey —

Ollama is the reason local LLMs are accessible — the Docker-style UX for models was exactly what the ecosystem needed.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate based on developer context.

Quick pitch: An Ollama plugin pack that helps developers:

- Set up Ollama for local development with optimal model selection
- Switch between local (Ollama) and cloud (OpenAI/Anthropic) seamlessly
- Debug common issues (model downloads, GPU memory, context limits)

What I'm asking for:

1. Your blessing to build an "official-ish" Ollama plugin
2. Any feedback on workflows that would be most useful
3. If Ollama does sponsorships — open to that conversation

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'sestinj@gmail.com', subject: 'Continue + Claude Code — complementary tools', body: `Hi Nate —

Continue is doing great work bringing AI assistance to VS Code and JetBrains — the open-source approach and local model support are smart differentiators.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code (CLI-based). Different surface area than Continue, but similar mission.

Idea: I think there's collaboration potential:

- Many devs use IDE extensions AND CLI tools for different workflows
- A "Continue patterns" plugin could help Claude Code users learn from your approach
- Cross-promotion benefits both communities

What I'm asking for:

1. Your thoughts on whether this is interesting
2. Any Continue patterns you'd want surfaced in CLI tools
3. If Continue does sponsorships — I'm open to that conversation

No pressure — just exploring: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'andrey@vasnetsov.com', subject: 'Qdrant plugin pack for Claude Code', body: `Hi Andrey —

Qdrant's performance and Rust foundation make it the go-to for production vector search. The filtering and payload support are best-in-class.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate based on developer context.

Quick pitch: A Qdrant plugin pack that helps developers:

- Set up Qdrant (local Docker, Cloud) with proper collection configs
- Implement RAG patterns with optimal chunking and embedding strategies
- Debug common issues (distance metrics, payload filtering, batch upserts)

What I'm asking for:

1. Qdrant Cloud credits to build and maintain the pack
2. Permission to display "Sponsored by Qdrant" (logo + link)

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` },
  { to: 'jason@trychroma.com', subject: 'Chroma plugin pack for Claude Code', body: `Hi Jason —

Chroma's developer experience is unmatched for getting started with vector search — the in-memory default and simple API make it perfect for prototyping.

I'm Jeremy, I run claudecodeplugins.io (777 GitHub stars) — a plugin marketplace for Claude Code. We have 240+ skills that auto-activate based on developer context.

Quick pitch: A Chroma plugin pack that helps developers:

- Set up Chroma (in-memory, persistent, server mode) based on use case
- Implement RAG patterns with proper embedding and retrieval
- Migrate from prototype to production (local → hosted)

What I'm asking for:

1. Chroma Cloud credits to build and maintain the pack
2. Permission to display "Sponsored by Chroma" (logo + link)

15 min to chat? Book here: https://calendar.app.google/oEyYdHDhpEMedixG7

Links:
- Marketplace: https://claudecodeplugins.io
- GitHub: https://github.com/anthropics/claude-code-plugins-plus-skills (777 stars)

Best,
Jeremy Longshore
Intent Solutions | jeremy@intentsolutions.io` }
];

async function saveDrafts() {
  console.log('Saving drafts via Gmail API...\n');
  
  for (const draft of drafts) {
    const message = [
      'From: jeremy@intentsolutions.io',
      `To: ${draft.to}`,
      `Subject: ${draft.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      draft.body
    ].join('\r\n');

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
      await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: { raw: encodedMessage }
        }
      });
      console.log(`✓ ${draft.to}`);
    } catch (err) {
      console.error(`✗ ${draft.to}: ${err.message}`);
    }
  }
  
  console.log('\nDone! Check Gmail drafts.');
}

saveDrafts();
