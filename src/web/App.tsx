/**
 * Web Dashboard — DailyReview surface.
 *
 * The web app is the decoupled DailyReview surface: the browser talks only to
 * the local /api server (src/web/server), never to provider connectors or
 * native deps. The former browser-OAuth webmail views (Inbox/Compose/
 * EmailDetail/Search + the in-browser connector) were removed — they held the
 * OAuth token client-side (the opposite of the self-hosted model) and dragged
 * keytar into the bundle, which broke `npm run build:web`.
 */

import React from 'react';
import { DailyReview } from './components/daily-review/DailyReview.js';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>IntentMail · Daily Review</h1>
      </header>
      <main className="app-main">
        <DailyReview />
      </main>
    </div>
  );
}
