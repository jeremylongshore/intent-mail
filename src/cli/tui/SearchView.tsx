import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useState, useCallback } from 'react';
import type { Email, EmailConnector, EmailSearchResult } from '../../agents/email-connector.js';

interface SearchViewProps {
  initialQuery: string;
  connector?: EmailConnector;
  onSelectEmail?: (email: Email) => void;
  onBack?: () => void;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str.padEnd(len);
  return str.slice(0, len - 1) + '…';
}

function getSenderName(email: Email): string {
  return email.from.name || email.from.email.split('@')[0];
}

export function SearchView({ initialQuery, connector, onSelectEmail, onBack }: SearchViewProps): JSX.Element {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<EmailSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputFocused, setInputFocused] = useState(true);

  const handleSearch = useCallback(async (): Promise<void> => {
    if (!query.trim()) return;
    if (!connector) {
      setError('No email connector configured');
      return;
    }

    setLoading(true);
    setSearched(true);
    setError(null);
    setInputFocused(false);

    try {
      const searchResults = await connector.search({
        query: query.trim(),
        limit: 20,
      });
      setResults(searchResults);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, connector]);

  useInput((input, key) => {
    // Back
    if (key.escape) {
      if (results.length > 0 && !inputFocused) {
        // Go back to input
        setInputFocused(true);
      } else if (onBack) {
        onBack();
      }
    }

    // Search on Enter when input focused
    if (key.return && inputFocused) {
      void handleSearch();
    }

    // Open selected email
    if (key.return && !inputFocused && results.length > 0) {
      const result = results[selectedIndex];
      if (result && onSelectEmail) {
        onSelectEmail(result.email);
      }
    }

    // Navigation when not focused on input
    if (!inputFocused && results.length > 0) {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      }
      if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
      }
    }

    // Focus input with /
    if (input === '/' && !inputFocused) {
      setInputFocused(true);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">IntentMail</Text>
        <Text> - Search</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={inputFocused ? 'cyan' : undefined}>Search: </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          focus={inputFocused}
          placeholder="Enter search query..."
        />
        {loading && (
          <Text color="cyan"> <Spinner type="dots" /></Text>
        )}
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Results */}
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(80)}</Text>
      </Box>

      {loading ? (
        <Box marginBottom={1}>
          <Text>
            <Spinner type="dots" /> Searching...
          </Text>
        </Box>
      ) : results.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text dimColor>Found {results.length} results:</Text>
          </Box>

          {/* Results list header */}
          <Box>
            <Text dimColor>{'SCORE  '}</Text>
            <Text dimColor>{truncate('FROM', 18)}</Text>
            <Text dimColor> </Text>
            <Text dimColor>{truncate('SUBJECT', 50)}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor>{'─'.repeat(80)}</Text>
          </Box>

          {results.slice(0, 15).map((result, index) => {
            const isSelected = index === selectedIndex && !inputFocused;
            const email = result.email;
            const scorePercent = Math.round(result.score * 20); // Normalize to percentage

            return (
              <Box key={email.id}>
                <Text
                  backgroundColor={isSelected ? 'blue' : undefined}
                  color={isSelected ? 'white' : undefined}
                >
                  <Text color="green">{String(scorePercent).padStart(3)}%</Text>
                  <Text>   </Text>
                  <Text bold={!email.isRead}>{truncate(getSenderName(email), 18)}</Text>
                  <Text> </Text>
                  <Text bold={!email.isRead}>{truncate(email.subject, 50)}</Text>
                </Text>
              </Box>
            );
          })}

          {results.length > 15 && (
            <Box marginTop={1}>
              <Text dimColor>... and {results.length - 15} more results</Text>
            </Box>
          )}
        </Box>
      ) : searched && !error ? (
        <Box marginBottom={1}>
          <Text dimColor>No results found for "{query}"</Text>
        </Box>
      ) : !error ? (
        <Box marginBottom={1}>
          <Text dimColor>Type a search query and press Enter</Text>
        </Box>
      ) : null}

      {/* Footer */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{'─'.repeat(80)}</Text>
        <Box marginTop={1}>
          <Text dimColor>
            [Enter] search/open | [j/k] navigate | [/] focus search | [Esc] back
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
