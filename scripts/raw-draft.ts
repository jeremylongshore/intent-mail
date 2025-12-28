#!/usr/bin/env npx tsx
import 'dotenv/config';
import { ImapFlow } from 'imapflow';

async function main() {
  const filter = process.argv[2] || 'cloudflare';

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER_EMAIL!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
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
