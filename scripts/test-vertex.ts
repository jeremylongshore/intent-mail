#!/usr/bin/env npx tsx
/**
 * Test Vertex AI provider
 */

import 'dotenv/config';
import { MultiProviderRouter } from '../src/ai/router.js';

async function main() {
  console.log('=== Vertex AI Provider Test ===\n');
  console.log('GCP_PROJECT:', process.env.GCP_PROJECT || '(not set)');
  console.log('GCP_LOCATION:', process.env.GCP_LOCATION || '(not set)');
  console.log();

  console.log('Creating router...');
  const router = await MultiProviderRouter.create();

  console.log('Providers:', router.getProviders().join(' → '));
  console.log();

  // Test a simple generation
  console.log('Testing generateDraft...');
  try {
    const draft = await router.generateDraft({
      to: 'test@example.com',
      subject: 'Quick test',
      context: 'Just testing the AI provider - respond with a brief hello message'
    });

    console.log('Draft:');
    console.log('---');
    console.log(draft.slice(0, 500));
    console.log('---');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }

  console.log();
  console.log('Stats:', router.getStats());
}

main().catch(console.error);
