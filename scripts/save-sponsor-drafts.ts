/**
 * Save sponsor outreach emails to Gmail Drafts
 */

import { createImapConnection, saveDrafts, type DraftEmail } from '../dist/connectors/imap/index.js';

const drafts: DraftEmail[] = [
  // 1. Craig Cannon (Supabase) - HIGH PRIORITY
  {
    to: 'c@craigc.org',
    subject: 'Claude Code plugin project - sponsorship inquiry',
    bodyText: `Hi Craig,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a community-driven plugin hub for Claude Code.

Why Supabase: I saw Supabase has invested $250k+ in OSS sponsorships. My project serves AI developers building with Claude - a community that overlaps with Supabase users.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- Google Cloud Startup Program member
- 175+ agent skills, first 100% Anthropic 2025 schema compliant

Sponsorship: Logo on README + claudecodeplugins.io

15 min to chat?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 2. Harrison Chase (LangChain) - HIGH PRIORITY
  {
    to: 'h.chase@langchain.com',
    subject: 'Claude Code plugins + LangChain integration',
    bodyText: `Hi Harrison,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code with 175+ agent skills.

Why LangChain: Many of my users build LangChain applications. A LangChain-focused skill pack or sponsorship would benefit both communities.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- Google Cloud Startup Program member
- First project 100% compliant with Anthropic's 2025 skills schema

Interested in:
- Sponsorship (logo placement)
- Or: collaboration on LangChain-specific Claude Code skills

Open to a quick chat?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 3. Alex Albert (Anthropic) - HIGH PRIORITY
  {
    to: 'alex@anthropic.com',
    subject: 'Claude Code Plugins ecosystem - community update',
    bodyText: `Hi Alex,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a community plugin hub for Claude Code.

Why reaching out: My project was the first to achieve 100% compliance with Anthropic's 2025 skills schema. I'd love to connect about:
- Official recognition or listing
- Potential sponsorship
- Feedback on the ecosystem

Background:
- 175+ agent skills for Claude Code
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- Sites: claudecodeplugins.io, claudecodeskills.io

Would love to chat about how we can work together.

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 4. Walter Aldana (Groq) - HIGH PRIORITY
  {
    to: 'waldana@groq.com',
    subject: 'Claude Code plugins - Groq integration opportunity',
    bodyText: `Hi Walter,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code.

Why Groq: Fast inference is crucial for AI developers. I noticed Groq's Vercel OSS Program partnership - would love to discuss similar sponsorship.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- Google Cloud Startup Program member
- 175+ agent skills, first 100% Anthropic 2025 schema compliant

Sponsorship: Logo on README + claudecodeplugins.io

15 min to chat?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 5. Jeff Boudier (Hugging Face) - HIGH PRIORITY
  {
    to: 'jeff@huggingface.co',
    subject: 'Claude Code plugins ecosystem',
    bodyText: `Hi Jeff,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code with 175+ agent skills.

Why Hugging Face: Many AI developers in my community use HF for models and datasets. Would love to explore sponsorship or a Hugging Face skill pack.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- First project 100% Anthropic 2025 schema compliant

Open to chatting?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 6. OpenJS Foundation - MEDIUM PRIORITY
  {
    to: 'sponsor@openjsf.org',
    subject: 'Project sponsorship inquiry - Claude Code Plugins',
    bodyText: `Dear OpenJS team,

I'm inquiring about sponsorship for my open source project.

Project: claude-code-plugins-plus-skills
- 777 GitHub stars
- 175+ agent skills for Claude Code
- Apache 2.0 licensed

Alignment: My project serves JavaScript/TypeScript developers building AI applications with Claude Code.

I'd welcome the opportunity to discuss membership or sponsorship.

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 7. Ollama - MEDIUM PRIORITY
  {
    to: 'hello@ollama.com',
    subject: 'Claude Code plugins + Ollama integration',
    bodyText: `Hi Ollama team,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code.

Idea: An Ollama-focused skill pack for Claude Code users who want local model support alongside Claude.

Would you be interested in sponsoring or collaborating?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 8. LlamaIndex - MEDIUM PRIORITY
  {
    to: 'hello@llamaindex.cloud',
    subject: 'Claude Code plugins + LlamaIndex RAG tools',
    bodyText: `Hi LlamaIndex team,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐).

Idea: LlamaIndex RAG skill pack for Claude Code - help developers build better retrieval pipelines.

Interested in sponsorship or collaboration?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 9. Cohere - MEDIUM PRIORITY
  {
    to: 'contact@cohere.ai',
    subject: 'Claude Code plugins - partnership inquiry',
    bodyText: `Hi Cohere team,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code with 175+ agent skills.

Many enterprise AI developers use multiple LLM providers. Would love to explore a Cohere skill pack or sponsorship.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- Google Cloud Startup Program member

Open to discussing?

Jeremy Longshore
jeremy@intentsolutions.io`
  },
  // 10. Replicate - MEDIUM PRIORITY
  {
    to: 'partnerships@replicate.com',
    subject: 'Claude Code plugins - Replicate integration',
    bodyText: `Hi Replicate team,

I'm Jeremy, creator of claude-code-plugins-plus-skills (777 ⭐) - a plugin hub for Claude Code.

Idea: Replicate skill pack for Claude Code - make it easy to deploy and run models via Replicate.

Background:
- PR #580 merged into GoogleCloudPlatform/agent-starter-pack
- 175+ agent skills

Interested in sponsorship or collaboration?

Jeremy Longshore
jeremy@intentsolutions.io`
  }
];

async function main() {
  // Validate required environment variables
  const user = process.env.GMAIL_USER_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Error: Missing required environment variables');
    console.error('  GMAIL_USER_EMAIL - Your Gmail address');
    console.error('  GMAIL_APP_PASSWORD - Gmail app password (not regular password)');
    console.error('\nTo create an app password:');
    console.error('  1. Go to https://myaccount.google.com/apppasswords');
    console.error('  2. Generate a new app password for "Mail"');
    process.exit(1);
  }

  console.log('Connecting to Gmail IMAP...');

  const connection = await createImapConnection({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: true
  });

  try {
    await connection.connect();
    console.log('Connected! Saving drafts...\n');

    const result = await saveDrafts(
      connection,
      user,
      drafts
    );

    console.log('\n=== Results ===');
    console.log(`Saved: ${result.saved}`);
    console.log(`Failed: ${result.failed}`);
    console.log('\nDetails:');
    for (const r of result.results) {
      const status = r.success ? '✓' : '✗';
      console.log(`  ${status} ${r.to}: ${r.message}`);
    }

  } finally {
    await connection.disconnect();
  }
}

main().catch(console.error);
