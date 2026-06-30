import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { useState, useEffect, type ReactElement } from 'react';
import type { Email, EmailConnector } from '../../agents/email-connector.js';

interface InboxViewProps {
  connector: EmailConnector;
  onSelectEmail: (email: Email) => void;
  onCompose: () => void;
  onSearch: () => void;
}

// Format date for display
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && now.getDate() === date.getDate()) {
    // Today - show time
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    // This week - show day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (now.getFullYear() === date.getFullYear()) {
    // This year - show month/day
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // Other years - show full date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }
}

// Truncate string with ellipsis
function truncate(str: string, len: number): string {
  if (str.length <= len) return str.padEnd(len);
  return str.slice(0, len - 1) + '…';
}

// Get sender display name
function getSenderName(email: Email): string {
  return email.from.name || email.from.email.split('@')[0];
}

export function InboxView({ connector, onSelectEmail, onCompose, onSearch }: InboxViewProps): ReactElement {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [folder] = useState('inbox');

  // Load emails
  useEffect(() => {
    const loadEmails = async () => {
      setLoading(true);
      try {
        const result = await connector.getEmails(folder, 50);
        // Sort by date descending
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEmails(result);
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        setLoading(false);
      }
    };
    void loadEmails();
  }, [connector, folder]);

  // Keyboard navigation
  useInput((input, key) => {
    if (loading) return;

    // Navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(emails.length - 1, i + 1));
    }

    // Page navigation
    if (key.pageUp || input === 'K') {
      setSelectedIndex((i) => Math.max(0, i - 10));
    }
    if (key.pageDown || input === 'J') {
      setSelectedIndex((i) => Math.min(emails.length - 1, i + 10));
    }

    // Home/End
    if (input === 'g') {
      setSelectedIndex(0);
    }
    if (input === 'G') {
      setSelectedIndex(emails.length - 1);
    }

    // Open email
    if (key.return || input === 'o') {
      if (emails[selectedIndex]) {
        onSelectEmail(emails[selectedIndex]);
      }
    }

    // Compose
    if (input === 'c') {
      onCompose();
    }

    // Search
    if (input === '/') {
      onSearch();
    }

    // Refresh
    if (input === 'r') {
      setLoading(true);
      connector.getEmails(folder, 50).then((result) => {
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEmails(result);
        setLoading(false);
      }).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to refresh');
        setLoading(false);
      });
    }

    // Toggle read status
    if (input === 'u') {
      const email = emails[selectedIndex];
      if (email) {
        if (email.isRead) {
          connector.markAsUnread([email.id]).catch(() => {});
          email.isRead = false;
        } else {
          connector.markAsRead([email.id]).catch(() => {});
          email.isRead = true;
        }
        setEmails([...emails]);
      }
    }

    // Star/unstar
    if (input === 's') {
      const email = emails[selectedIndex];
      if (email) {
        if (email.isStarred) {
          connector.unstar([email.id]).catch(() => {});
          email.isStarred = false;
        } else {
          connector.star([email.id]).catch(() => {});
          email.isStarred = true;
        }
        setEmails([...emails]);
      }
    }

    // Archive
    if (input === 'e') {
      const email = emails[selectedIndex];
      if (email) {
        connector.archive([email.id]).catch(() => {});
        setEmails(emails.filter((_, i) => i !== selectedIndex));
        if (selectedIndex >= emails.length - 1) {
          setSelectedIndex(Math.max(0, emails.length - 2));
        }
      }
    }

    // Delete/Trash
    if (input === 'd' || input === '#') {
      const email = emails[selectedIndex];
      if (email) {
        connector.trash([email.id]).catch(() => {});
        setEmails(emails.filter((_, i) => i !== selectedIndex));
        if (selectedIndex >= emails.length - 1) {
          setSelectedIndex(Math.max(0, emails.length - 2));
        }
      }
    }
  });

  const unreadCount = emails.filter((e) => !e.isRead).length;

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">IntentMail</Text>
          <Text dimColor> - Loading...</Text>
        </Box>
        <Box>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text> Fetching emails...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">IntentMail</Text>
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[r] retry | [q] quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">IntentMail</Text>
        <Text> - </Text>
        <Text bold>{folder}</Text>
        <Text dimColor> ({emails.length} emails</Text>
        {unreadCount > 0 && <Text color="yellow">, {unreadCount} unread</Text>}
        <Text dimColor>)</Text>
        <Text dimColor> | {connector.provider}</Text>
      </Box>

      {/* Email list header */}
      <Box>
        <Text dimColor>{'  '}</Text>
        <Text dimColor>{truncate('FROM', 20)}</Text>
        <Text dimColor> </Text>
        <Text dimColor>{truncate('SUBJECT', 45)}</Text>
        <Text dimColor> </Text>
        <Text dimColor>DATE</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {/* Email list */}
      {emails.length === 0 ? (
        <Box>
          <Text dimColor>No emails in {folder}. Run `intentmail config` to add an account.</Text>
        </Box>
      ) : (
        emails.slice(0, 20).map((email, index) => {
          const isSelected = index === selectedIndex;
          const indicator = email.isStarred ? '★' : email.isRead ? ' ' : '●';
          const indicatorColor = email.isStarred ? 'yellow' : email.isRead ? 'gray' : 'cyan';

          return (
            <Box key={email.id}>
              <Text
                backgroundColor={isSelected ? 'blue' : undefined}
                color={isSelected ? 'white' : undefined}
              >
                <Text color={indicatorColor}>{indicator}</Text>
                <Text> </Text>
                <Text bold={!email.isRead}>{truncate(getSenderName(email), 20)}</Text>
                <Text> </Text>
                <Text bold={!email.isRead}>{truncate(email.subject, 45)}</Text>
                <Text> </Text>
                <Text dimColor={email.isRead}>{formatDate(new Date(email.date)).padStart(8)}</Text>
              </Text>
            </Box>
          );
        })
      )}

      {emails.length > 20 && (
        <Box marginTop={1}>
          <Text dimColor>... and {emails.length - 20} more emails (scroll with j/k)</Text>
        </Box>
      )}

      {/* Footer with shortcuts */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{'─'.repeat(80)}</Text>
        <Box marginTop={1}>
          <Text dimColor>[j/k] navigate | [Enter] open | [c] compose | [/] search | [r] refresh | [q] quit</Text>
        </Box>
        <Box>
          <Text dimColor>[s] star | [u] toggle read | [e] archive | [d] delete</Text>
        </Box>
      </Box>
    </Box>
  );
}
