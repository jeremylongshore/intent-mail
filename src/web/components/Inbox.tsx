/**
 * Inbox Component
 *
 * Displays the user's email inbox with pagination and actions.
 *
 * E4.S4.3: Responsive Inbox UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEmailConnector } from '../hooks/useEmailConnector.js';
import type { Email } from '../../agents/email-connector.js';

interface InboxProps {
  onSelect: (email: Email) => void;
  onCompose: () => void;
  onSearch: () => void;
}

const EMAILS_PER_PAGE = 20;

export function Inbox({ onSelect, onCompose, onSearch }: InboxProps) {
  const { connector, loading: connectorLoading } = useEmailConnector();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchEmails = useCallback(async () => {
    if (!connector) return;

    setLoading(true);
    setError(null);

    try {
      const result = await connector.getEmails('inbox', EMAILS_PER_PAGE);
      setEmails(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [connector]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails, page]);

  const handleRefresh = () => {
    fetchEmails();
  };

  const handleMarkRead = async (email: Email) => {
    if (!connector) return;
    try {
      await connector.markAsRead(email.id);
      fetchEmails();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleStar = async (email: Email) => {
    if (!connector) return;
    try {
      if (email.starred) {
        await connector.unstar(email.id);
      } else {
        await connector.star(email.id);
      }
      fetchEmails();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const handleArchive = async (email: Email) => {
    if (!connector) return;
    try {
      await connector.archive(email.id);
      fetchEmails();
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  if (connectorLoading || loading) {
    return (
      <div className="inbox loading">
        <div className="spinner" />
        <p>Loading emails...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inbox error">
        <p>Error: {error}</p>
        <button onClick={handleRefresh} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="inbox">
      <div className="inbox-header">
        <h2>Inbox</h2>
        <div className="inbox-actions">
          <button onClick={handleRefresh} className="btn btn-secondary">
            Refresh
          </button>
          <button onClick={onCompose} className="btn btn-primary">
            Compose
          </button>
          <button onClick={onSearch} className="btn btn-secondary">
            Search
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="inbox-empty">
          <p>No emails in your inbox</p>
        </div>
      ) : (
        <ul className="email-list">
          {emails.map((email) => (
            <li
              key={email.id}
              className={`email-item ${email.read ? 'read' : 'unread'}`}
              onClick={() => onSelect(email)}
            >
              <div className="email-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleStar(email)}
                  className={`btn-icon ${email.starred ? 'starred' : ''}`}
                  title={email.starred ? 'Unstar' : 'Star'}
                >
                  {email.starred ? '\u2605' : '\u2606'}
                </button>
                <button
                  onClick={() => handleArchive(email)}
                  className="btn-icon"
                  title="Archive"
                >
                  \ud83d\udce5
                </button>
              </div>
              <div className="email-from">
                {email.from.name || email.from.email}
              </div>
              <div className="email-subject">
                {email.subject || '(no subject)'}
              </div>
              <div className="email-snippet">{email.snippet}</div>
              <div className="email-date">
                {new Date(email.date).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="inbox-pagination">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={emails.length < EMAILS_PER_PAGE}
          className="btn btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );
}
