#!/usr/bin/env npx tsx
/**
 * Test IMAP connector
 */

import 'dotenv/config';
import { ImapEmailConnector } from '../src/agents/imap-connector.js';

async function main() {
  console.log('GMAIL_USER_EMAIL:', process.env.GMAIL_USER_EMAIL || '(not set)');
  console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '***set***' : '(not set)');

  const connector = new ImapEmailConnector();

  try {
    await connector.connect();
    console.log('\n=== CONNECTED TO GMAIL ===\n');

    // Get folders
    const folders = await connector.getFolders();
    console.log('Folders:', folders.slice(0, 5).join(', '), '...');

    // Get inbox emails
    console.log('\n=== RECENT INBOX MESSAGES ===\n');
    const emails = await connector.getEmails('inbox', 5);

    for (const email of emails) {
      const readMarker = email.isRead ? ' ' : '*';
      const starMarker = email.isStarred ? '⭐' : '  ';
      const sender = email.from.name || email.from.email;

      console.log(`[${readMarker}]${starMarker} ${sender}`);
      console.log(`   Subject: ${email.subject}`);
      console.log(`   Date: ${email.date.toLocaleDateString()}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.error(error);
  } finally {
    await connector.disconnect();
    console.log('Disconnected.');
  }
}

main().catch(console.error);
