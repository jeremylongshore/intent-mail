#!/usr/bin/env npx tsx
import 'dotenv/config';
import { ImapFlow } from 'imapflow';

async function main() {
  // Validate required environment variables
  const user = process.env.GMAIL_USER_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Error: Missing required environment variables');
    console.error('  GMAIL_USER_EMAIL - Your Gmail address');
    console.error('  GMAIL_APP_PASSWORD - Gmail app password');
    process.exit(1);
  }

  const filter = process.argv[2] || 'cloudflare';

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('[Gmail]/Drafts');

  try {
    for await (const msg of client.fetch('1:*', { envelope: true, source: true })) {
      const to = msg.envelope?.to?.[0]?.address || '';
      const subject = msg.envelope?.subject || '';

      if (to.toLowerCase().includes(filter.toLowerCase()) ||
          subject.toLowerCase().includes(filter.toLowerCase())) {
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('\n=== RAW SOURCE ===\n');
        console.log(msg.source.toString());
        break;
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(console.error);
