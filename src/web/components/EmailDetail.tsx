/**
 * Email Detail Component
 *
 * Displays a single email with full content and actions.
 *
 * E4.S4.3: Responsive Inbox UI
 */

import React, { useState } from 'react';
import { useEmailConnector } from '../hooks/useEmailConnector.js';
import type { Email } from '../../agents/email-connector.js';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onReply: () => void;
}

export function EmailDetail({ email, onBack, onReply }: EmailDetailProps) {
  const { connector } = useEmailConnector();
  const [loading, setLoading] = useState(false);

  const handleStar = async () => {
    if (!connector) return;
    setLoading(true);
    try {
      if (email.starred) {
        await connector.unstar(email.id);
      } else {
        await connector.star(email.id);
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!connector) return;
    setLoading(true);
    try {
      await connector.archive(email.id);
      onBack();
    } catch (err) {
      console.error('Failed to archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrash = async () => {
    if (!connector) return;
    setLoading(true);
    try {
      await connector.trash(email.id);
      onBack();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-detail">
      <div className="email-detail-header">
        <button onClick={onBack} className="btn btn-secondary">
          \u2190 Back
        </button>
        <div className="email-detail-actions">
          <button onClick={onReply} className="btn btn-primary" disabled={loading}>
            Reply
          </button>
          <button onClick={handleStar} className="btn btn-secondary" disabled={loading}>
            {email.starred ? 'Unstar' : 'Star'}
          </button>
          <button onClick={handleArchive} className="btn btn-secondary" disabled={loading}>
            Archive
          </button>
          <button onClick={handleTrash} className="btn btn-danger" disabled={loading}>
            Delete
          </button>
        </div>
      </div>

      <article className="email-content">
        <header className="email-meta">
          <h2 className="email-subject">{email.subject || '(no subject)'}</h2>
          <div className="email-from-to">
            <div className="email-from">
              <strong>From:</strong> {email.from.name || email.from.email}
              {email.from.name && <span className="email-address">&lt;{email.from.email}&gt;</span>}
            </div>
            <div className="email-to">
              <strong>To:</strong>{' '}
              {email.to.map((r) => r.name || r.email).join(', ')}
            </div>
            {email.cc && email.cc.length > 0 && (
              <div className="email-cc">
                <strong>Cc:</strong>{' '}
                {email.cc.map((r) => r.name || r.email).join(', ')}
              </div>
            )}
          </div>
          <div className="email-date">
            {new Date(email.date).toLocaleString()}
          </div>
        </header>

        <div
          className="email-body"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />

        {email.attachments && email.attachments.length > 0 && (
          <div className="email-attachments">
            <h3>Attachments ({email.attachments.length})</h3>
            <ul>
              {email.attachments.map((attachment, index) => (
                <li key={index}>
                  <a href={attachment.url} download={attachment.filename}>
                    {attachment.filename} ({Math.round(attachment.size / 1024)}KB)
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}
