import { Box, Text, useApp, useInput } from 'ink';
import { useState, useEffect, type ReactElement } from 'react';
import Spinner from 'ink-spinner';
import { InboxView } from './InboxView.js';
import { EmailDetailView } from './EmailDetailView.js';
import { ComposeView } from './ComposeView.js';
import { SearchView } from './SearchView.js';
import type { Email, EmailConnector } from '../../agents/email-connector.js';
import { initEmailConnector } from '../../agents/email-connector.js';

export type View = 'inbox' | 'detail' | 'compose' | 'search';

interface AppState {
  view: View;
  selectedEmail: Email | null;
  replyTo: Email | null;
}

/**
 * Props for the main App component
 * Supports adapter pattern - connector can be injected or auto-initialized
 */
export interface AppProps {
  /** Pre-initialized email connector (from adapter) */
  connector?: EmailConnector;
}

export function App({ connector: injectedConnector }: AppProps): ReactElement {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    view: 'inbox',
    selectedEmail: null,
    replyTo: null,
  });
  const [connector, setConnector] = useState<EmailConnector | null>(injectedConnector ?? null);
  const [loading, setLoading] = useState(!injectedConnector);
  const [error, setError] = useState<string | null>(null);

  // Initialize connector on mount (only if not injected)
  useEffect(() => {
    if (injectedConnector) return; // Already have connector

    const init = async () => {
      try {
        const conn = await initEmailConnector();
        setConnector(conn);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [injectedConnector]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Quit on 'q' from inbox
    if (input === 'q' && state.view === 'inbox') {
      exit();
    }
    // Escape goes back to inbox
    if (key.escape && state.view !== 'inbox') {
      setState((s) => ({ ...s, view: 'inbox', selectedEmail: null }));
    }
  });

  const navigateTo = (view: View, email?: Email) => {
    setState((s) => ({
      ...s,
      view,
      selectedEmail: email ?? s.selectedEmail,
    }));
  };

  const handleCompose = (replyTo?: Email) => {
    setState((s) => ({
      ...s,
      view: 'compose',
      replyTo: replyTo ?? null,
    }));
  };

  const handleBack = () => {
    setState((s) => ({ ...s, view: 'inbox', selectedEmail: null, replyTo: null }));
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Connecting to email...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">✗ Error: {error}</Text>
        <Text dimColor>Press any key to exit</Text>
      </Box>
    );
  }

  if (!connector) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">✗ No email connector available</Text>
        <Text dimColor>Run `intentmail config` to set up your email account</Text>
      </Box>
    );
  }

  // Render the current view
  switch (state.view) {
    case 'detail':
      return state.selectedEmail ? (
        <EmailDetailView
          email={state.selectedEmail}
          connector={connector}
          onBack={handleBack}
          onReply={() => handleCompose(state.selectedEmail!)}
        />
      ) : (
        <InboxView
          connector={connector}
          onSelectEmail={(email) => navigateTo('detail', email)}
          onCompose={() => handleCompose()}
          onSearch={() => navigateTo('search')}
        />
      );

    case 'compose':
      return (
        <ComposeView
          useAI={false}
          replyTo={state.replyTo ?? undefined}
          connector={connector}
          onBack={handleBack}
        />
      );

    case 'search':
      return (
        <SearchView
          initialQuery=""
          connector={connector}
          onSelectEmail={(email) => navigateTo('detail', email)}
          onBack={handleBack}
        />
      );

    case 'inbox':
    default:
      return (
        <InboxView
          connector={connector}
          onSelectEmail={(email) => navigateTo('detail', email)}
          onCompose={() => handleCompose()}
          onSearch={() => navigateTo('search')}
        />
      );
  }
}
