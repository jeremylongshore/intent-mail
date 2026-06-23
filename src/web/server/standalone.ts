/**
 * Standalone entry for the local web API server (used by `npm run dev:web-api`).
 * In production it is reached via `intentmail serve-web`.
 */

import { startApiServer } from './api-server.js';

startApiServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start IntentMail web API:', error);
  process.exit(1);
});
