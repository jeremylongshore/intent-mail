import { Box, Text, useInput } from 'ink';
import { useState, useEffect, type ReactElement } from 'react';
import Spinner from 'ink-spinner';
import type { Email, EmailConnector } from '../../agents/email-connector.js';

interface EmailDetailViewProps {
  email: Email;
  connector: EmailConnector;
  onBack: () => void;
  onReply: () => void;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAddress(addr: { email: string; name?: string }): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

// Word wrap text to fit terminal width
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

export function EmailDetailView({ email, connector, onBack, onReply }: EmailDetailViewProps): ReactElement {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [marking, setMarking] = useState(false);

  // Mark as read when opened
  useEffect(() => {
    if (!email.isRead) {
      connector.markAsRead([email.id]).catch(() => {});
    }
  }, [email.id, email.isRead, connector]);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Back
    if (key.escape || input === 'q' || input === 'b') {
      onBack();
    }

    // Scroll
    if (key.upArrow || input === 'k') {
      setScrollOffset((o) => Math.max(0, o - 1));
    }
    if (key.downArrow || input === 'j') {
      setScrollOffset((o) => o + 1);
    }
    if (key.pageUp || input === 'K') {
      setScrollOffset((o) => Math.max(0, o - 10));
    }
    if (key.pageDown || input === 'J') {
      setScrollOffset((o) => o + 10);
    }

    // Reply
    if (input === 'r') {
      onReply();
    }

    // Star/unstar
    if (input === 's') {
      setMarking(true);
      const action = email.isStarred ? connector.unstar([email.id]) : connector.star([email.id]);
      action.then(() => {
        email.isStarred = !email.isStarred;
        setMarking(false);
      }).catch(() => setMarking(false));
    }

    // Archive
    if (input === 'e') {
      connector.archive([email.id]).catch(() => {});
      onBack();
    }

    // Delete
    if (input === 'd' || input === '#') {
      connector.trash([email.id]).catch(() => {});
      onBack();
    }
  });

  const bodyLines = wrapText(email.body || email.snippet || '(No content)', 76);
  const visibleLines = bodyLines.slice(scrollOffset, scrollOffset + 15);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">IntentMail</Text>
          <Text dimColor> - Email</Text>
          {email.isStarred && <Text color="yellow"> ★</Text>}
          {marking && <Text color="gray"> <Spinner type="dots" /></Text>}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{'─'.repeat(80)}</Text>
        </Box>
      </Box>

      {/* Email metadata */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>From:    </Text>
          <Text bold>{formatAddress(email.from)}</Text>
        </Box>
        <Box>
          <Text dimColor>To:      </Text>
          <Text>{email.to.map(formatAddress).join(', ')}</Text>
        </Box>
        {email.cc && email.cc.length > 0 && (
          <Box>
            <Text dimColor>Cc:      </Text>
            <Text>{email.cc.map(formatAddress).join(', ')}</Text>
          </Box>
        )}
        <Box>
          <Text dimColor>Date:    </Text>
          <Text>{formatDateTime(new Date(email.date))}</Text>
        </Box>
        <Box>
          <Text dimColor>Subject: </Text>
          <Text bold>{email.subject}</Text>
        </Box>
        {email.labels.length > 0 && (
          <Box>
            <Text dimColor>Labels:  </Text>
            <Text color="magenta">{email.labels.join(', ')}</Text>
          </Box>
        )}
      </Box>

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>{'─'.repeat(40)}</Text>
          <Box marginTop={1}>
            <Text dimColor>Attachments: </Text>
            <Text color="green">
              {email.attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)}KB)`).join(', ')}
            </Text>
          </Box>
        </Box>
      )}

      {/* Body separator */}
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {/* Email body */}
      <Box flexDirection="column" marginBottom={1}>
        {visibleLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        {bodyLines.length > 15 && (
          <Box marginTop={1}>
            <Text dimColor>
              Lines {scrollOffset + 1}-{Math.min(scrollOffset + 15, bodyLines.length)} of {bodyLines.length} (j/k to scroll)
            </Text>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{'─'.repeat(80)}</Text>
        <Box marginTop={1}>
          <Text dimColor>[b/Esc] back | [r] reply | [s] star | [e] archive | [d] delete | [j/k] scroll</Text>
        </Box>
      </Box>
    </Box>
  );
}
