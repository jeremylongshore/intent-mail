/**
 * Web Dashboard Main Application
 *
 * Main React component for the IntentMail web interface.
 *
 * E4.S4.1: React Web App Scaffold
 */

import React, { useState, useCallback } from 'react';
import { Inbox } from './components/Inbox.js';
import { EmailDetail } from './components/EmailDetail.js';
import { Compose } from './components/Compose.js';
import { Search } from './components/Search.js';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { EmailProvider } from './hooks/useEmailConnector.js';
import type { Email } from '../agents/email-connector.js';

type View = 'inbox' | 'detail' | 'compose' | 'search';

interface AppState {
  view: View;
  selectedEmail: Email | null;
  replyTo: Email | null;
  searchQuery: string;
}

function AppContent() {
  const { isAuthenticated, login, logout, loading: authLoading } = useAuth();
  const [state, setState] = useState<AppState>({
    view: 'inbox',
    selectedEmail: null,
    replyTo: null,
    searchQuery: '',
  });

  const navigate = useCallback((view: View) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  const selectEmail = useCallback((email: Email) => {
    setState((prev) => ({ ...prev, selectedEmail: email, view: 'detail' }));
  }, []);

  const startCompose = useCallback((replyTo?: Email) => {
    setState((prev) => ({ ...prev, replyTo: replyTo || null, view: 'compose' }));
  }, []);

  const startSearch = useCallback(() => {
    setState((prev) => ({ ...prev, view: 'search' }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, view: 'inbox', selectedEmail: null, replyTo: null }));
  }, []);

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-login">
        <div className="login-card">
          <h1>IntentMail</h1>
          <p>Sign in to access your emails</p>
          <button onClick={login} className="btn btn-primary">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>IntentMail</h1>
        <nav className="app-nav">
          <button onClick={() => navigate('inbox')} className={state.view === 'inbox' ? 'active' : ''}>
            Inbox
          </button>
          <button onClick={() => startCompose()} className={state.view === 'compose' ? 'active' : ''}>
            Compose
          </button>
          <button onClick={startSearch} className={state.view === 'search' ? 'active' : ''}>
            Search
          </button>
        </nav>
        <button onClick={logout} className="btn btn-secondary">
          Sign Out
        </button>
      </header>

      <main className="app-main">
        {state.view === 'inbox' && (
          <Inbox onSelect={selectEmail} onCompose={startCompose} onSearch={startSearch} />
        )}
        {state.view === 'detail' && state.selectedEmail && (
          <EmailDetail
            email={state.selectedEmail}
            onBack={goBack}
            onReply={() => startCompose(state.selectedEmail!)}
          />
        )}
        {state.view === 'compose' && (
          <Compose replyTo={state.replyTo} onBack={goBack} onSent={goBack} />
        )}
        {state.view === 'search' && (
          <Search onSelect={selectEmail} onBack={goBack} />
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <EmailProvider>
        <AppContent />
      </EmailProvider>
    </AuthProvider>
  );
}
