#!/usr/bin/env npx tsx
/**
 * Read Gmail drafts
 */

import 'dotenv/config';
import { ImapEmailConnector } from '../src/agents/imap-connector.js';

async function main() {
  const filter = process.argv[2]; // optional filter
  const connector = new ImapEmailConnector();
  await connector.connect();

  const drafts = await connector.getEmails('[Gmail]/Drafts', 20);

  if (filter) {
    // Show full content of matching draft
    const match = drafts.find(d =>
      d.to.some(t => t.email.toLowerCase().includes(filter.toLowerCase())) ||
      d.subject.toLowerCase().includes(filter.toLowerCase())
    );

    if (match) {
      console.log('To:', match.to.map(t => t.email).join(', '));
      console.log('Subject:', match.subject);
      console.log('Date:', match.date);
      console.log('\n--- BODY ---\n');
      console.log(match.body);
    } else {
      console.log(`No draft found matching: ${filter}`);
    }
  } else {
    // List all drafts
    console.log('=== DRAFTS ===\n');
    for (const draft of drafts) {
      console.log('To:', draft.to.map(t => t.email).join(', ') || '(no recipient)');
      console.log('Subject:', draft.subject || '(no subject)');
      console.log('Date:', draft.date.toLocaleDateString());
      console.log('Preview:', (draft.snippet || draft.body || '(empty)').slice(0, 150));
      console.log('---');
    }
    console.log(`\nTotal: ${drafts.length} drafts`);
  }

  await connector.disconnect();
}

main().catch(console.error);
