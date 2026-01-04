import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useState } from 'react';
import type { Email, EmailConnector, EmailDraft } from '../../agents/email-connector.js';
import { generateDraft, suggestReply, type DraftTone } from '../../ai/index.js';

interface ComposeViewProps {
  useAI: boolean;
  replyTo?: Email;
  connector?: EmailConnector;
  onBack?: () => void;
}

type ComposeField = 'to' | 'subject' | 'body';

export function ComposeView({ useAI, replyTo, connector, onBack }: ComposeViewProps): JSX.Element {
  const { exit } = useApp();

  // Pre-fill for replies
  const replyToAddress = replyTo?.from.email || '';
  const replySubject = replyTo?.subject?.startsWith('Re: ')
    ? replyTo.subject
    : replyTo?.subject
    ? `Re: ${replyTo.subject}`
    : '';

  const [to, setTo] = useState(replyToAddress);
  const [subject, setSubject] = useState(replySubject);
  const [body, setBody] = useState('');
  const [activeField, setActiveField] = useState<ComposeField>('to');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      exit();
    }
  };

  useInput((input: string, key: { escape?: boolean; tab?: boolean; ctrl?: boolean; return?: boolean; shift?: boolean }) => {
    if (key.escape) {
      handleBack();
    }
    if (key.tab) {
      const fields: ComposeField[] = ['to', 'subject', 'body'];
      const currentIndex = fields.indexOf(activeField);
      const nextIndex = key.shift
        ? (currentIndex - 1 + fields.length) % fields.length
        : (currentIndex + 1) % fields.length;
      setActiveField(fields[nextIndex]);
    }
    if (key.ctrl && input === 's') {
      void handleSend();
    }
    if (key.ctrl && input === 'g' && useAI) {
      void handleAIGenerate();
    }
  });

  const handleSend = async (): Promise<void> => {
    if (!to || !subject) {
      setError('To and Subject are required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      if (connector) {
        const draft: EmailDraft = {
          to: [{ email: to }],
          subject,
          body,
          replyToMessageId: replyTo?.id,
          threadId: replyTo?.threadId,
        };
        await connector.send(draft);
      } else {
        // Fallback - just simulate
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setSent(true);
      setTimeout(() => {
        handleBack();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
      setSending(false);
    }
  };

  const handleAIGenerate = async (): Promise<void> => {
    setAiGenerating(true);
    setError(null);
    try {
      let generatedBody: string;

      if (replyTo) {
        // For replies, use suggestReply with thread context
        const storageEmail = {
          id: 0,
          accountId: 0,
          providerMessageId: replyTo.id,
          threadId: replyTo.threadId,
          from: { address: replyTo.from.email, name: replyTo.from.name },
          to: replyTo.to.map(t => ({ address: t.email, name: t.name })),
          subject: replyTo.subject,
          bodyText: replyTo.body,
          snippet: replyTo.snippet,
          date: replyTo.date.toISOString(),
          labels: replyTo.labels,
          flags: [],
          hasAttachments: replyTo.attachments.length > 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const result = await suggestReply([storageEmail], 'professional' as DraftTone);
        generatedBody = result.body;
      } else {
        // For new emails, generate based on subject context
        const result = await generateDraft({
          to,
          subject: subject || undefined,
          intent: 'inform',
          tone: 'professional',
          context: subject ? `Write an email about: ${subject}` : undefined,
          length: 'medium',
        });
        generatedBody = result.body;
        // Use suggested subject if none provided
        if (!subject && result.suggestedSubject) {
          setSubject(result.suggestedSubject);
        }
      }

      setBody(generatedBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI draft');
    } finally {
      setAiGenerating(false);
    }
  };

  if (sent) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">Email sent successfully!</Text>
        <Text dimColor>Returning to inbox...</Text>
      </Box>
    );
  }

  if (sending) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          <Spinner type="dots" /> Sending email...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">IntentMail</Text>
        <Text> - Compose</Text>
        {replyTo && <Text dimColor> (Reply)</Text>}
        {useAI && <Text color="yellow"> [AI Assist]</Text>}
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Form fields */}
      <Box marginBottom={1}>
        <Box width={10}>
          <Text color={activeField === 'to' ? 'cyan' : undefined}>To:</Text>
        </Box>
        <Box flexGrow={1}>
          <TextInput
            value={to}
            onChange={setTo}
            focus={activeField === 'to'}
            placeholder="recipient@example.com"
          />
        </Box>
      </Box>

      <Box marginBottom={1}>
        <Box width={10}>
          <Text color={activeField === 'subject' ? 'cyan' : undefined}>Subject:</Text>
        </Box>
        <Box flexGrow={1}>
          <TextInput
            value={subject}
            onChange={setSubject}
            focus={activeField === 'subject'}
            placeholder="Email subject"
          />
        </Box>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text dimColor>{'─'.repeat(80)}</Text>
        </Box>
        <Box>
          <Text color={activeField === 'body' ? 'cyan' : undefined}>Body:</Text>
        </Box>
        <Box marginTop={1}>
          {aiGenerating ? (
            <Text>
              <Spinner type="dots" /> AI generating draft...
            </Text>
          ) : (
            <Box flexDirection="column">
              <TextInput
                value={body}
                onChange={setBody}
                focus={activeField === 'body'}
                placeholder="Write your message... (multi-line support coming soon)"
              />
              {replyTo && body.length === 0 && (
                <Box marginTop={1} flexDirection="column">
                  <Text dimColor>--- Original Message ---</Text>
                  <Text dimColor>From: {replyTo.from.name || replyTo.from.email}</Text>
                  <Text dimColor>Date: {new Date(replyTo.date).toLocaleString()}</Text>
                  <Text dimColor>{replyTo.snippet}</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{'─'.repeat(80)}</Text>
        <Box marginTop={1}>
          <Text dimColor>
            [Tab] next field | [Shift+Tab] prev | [Ctrl+S] send | [Esc] cancel
            {useAI && ' | [Ctrl+G] AI generate'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
