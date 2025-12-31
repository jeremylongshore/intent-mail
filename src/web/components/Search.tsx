/**
 * Search Component
 *
 * Search emails with keyword and semantic (AI) search.
 *
 * E4.S4.3: Responsive Inbox UI
 */

import React, { useState, useCallback } from 'react';
import { useEmailConnector } from '../hooks/useEmailConnector.js';
import { semanticSearch, type SemanticSearchResult } from '../../ai/semantic-search.js';
import type { Email } from '../../agents/email-connector.js';

interface SearchProps {
  onSelect: (email: Email) => void;
  onBack: () => void;
}

type SearchMode = 'keyword' | 'semantic';

export function Search({ onSelect, onBack }: SearchProps) {
  const { connector } = useEmailConnector();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [results, setResults] = useState<Email[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      if (mode === 'keyword' && connector) {
        const searchResults = await connector.search({ query, limit: 20 });
        setResults(searchResults.map((r) => r.email));
        setSemanticResults([]);
      } else if (mode === 'semantic') {
        const searchResults = await semanticSearch(query, { limit: 20 });
        setSemanticResults(searchResults.results);
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, mode, connector]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const displayResults = mode === 'semantic' ? semanticResults : results.map((email) => ({
    email,
    relevanceScore: 1,
    matchReason: 'Keyword match',
    matchedFields: ['subject', 'body'] as ('subject' | 'body')[],
    snippet: email.snippet,
  }));

  return (
    <div className="search">
      <div className="search-header">
        <button onClick={onBack} className="btn btn-secondary">
          \u2190 Back
        </button>
        <h2>Search Emails</h2>
      </div>

      <div className="search-controls">
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'keyword' ? 'Search by keywords...' : 'Describe what you\'re looking for...'}
            className="search-input"
          />
          <button
            onClick={handleSearch}
            className="btn btn-primary"
            disabled={searching || !query.trim()}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="search-mode-toggle">
          <button
            onClick={() => setMode('keyword')}
            className={`btn ${mode === 'keyword' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Keyword
          </button>
          <button
            onClick={() => setMode('semantic')}
            className={`btn ${mode === 'semantic' ? 'btn-primary' : 'btn-secondary'}`}
          >
            \ud83e\udd16 AI Semantic
          </button>
        </div>
      </div>

      {error && (
        <div className="search-error">
          {error}
        </div>
      )}

      {hasSearched && displayResults.length === 0 && !searching && (
        <div className="search-empty">
          <p>No emails found matching "{query}"</p>
          <p className="search-hint">
            {mode === 'keyword'
              ? 'Try different keywords or switch to AI Semantic search'
              : 'Try rephrasing your query or switch to Keyword search'}
          </p>
        </div>
      )}

      {displayResults.length > 0 && (
        <div className="search-results">
          <p className="results-count">Found {displayResults.length} emails</p>
          <ul className="email-list">
            {displayResults.map((result, index) => (
              <li
                key={result.email.id || index}
                className="email-item"
                onClick={() => {
                  const email: Email = {
                    ...result.email,
                    id: result.email.id?.toString() || result.email.providerMessageId || '',
                    from: typeof result.email.from === 'string'
                      ? { email: result.email.from, name: undefined }
                      : { email: result.email.from.address, name: result.email.from.name },
                    to: [],
                    body: result.email.bodyText || result.email.bodyHtml || '',
                    snippet: result.snippet || '',
                    date: new Date(result.email.date),
                    read: !result.email.labels?.includes('UNREAD'),
                    starred: result.email.labels?.includes('STARRED') || false,
                    threadId: result.email.threadId,
                  };
                  onSelect(email);
                }}
              >
                {mode === 'semantic' && (
                  <div className="relevance-score">
                    {Math.round(result.relevanceScore * 100)}%
                  </div>
                )}
                <div className="email-from">
                  {typeof result.email.from === 'string'
                    ? result.email.from
                    : result.email.from.name || result.email.from.address}
                </div>
                <div className="email-subject">
                  {result.email.subject || '(no subject)'}
                </div>
                <div className="email-snippet">{result.snippet}</div>
                <div className="email-date">
                  {new Date(result.email.date).toLocaleDateString()}
                </div>
                {mode === 'semantic' && result.matchReason && (
                  <div className="match-reason">{result.matchReason}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
