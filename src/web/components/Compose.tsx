/**
 * Compose Component
 *
 * Form for composing and sending emails with AI assistance.
 *
 * E4.S4.4: Web Compose/Reply
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useEmailConnector } from '../hooks/useEmailConnector.js';
import { generateDraft, type DraftOptions, type DraftTone, type DraftIntent } from '../../ai/draft-generator.js';
import type { Email } from '../../agents/email-connector.js';

interface ComposeProps {
  replyTo?: Email | null;
  onBack: () => void;
  onSent: () => void;
}

export function Compose({ replyTo, onBack, onSent }: ComposeProps) {
  const { connector } = useEmailConnector();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<DraftTone>('professional');
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (replyTo) {
      setTo(replyTo.from.email);
      setSubject(`Re: ${replyTo.subject}`);
    }
  }, [replyTo]);

  const handleSend = useCallback(async () => {
    if (!connector) return;
    if (!to.trim()) {
      setError('Please enter a recipient');
      return;
    }

    setSending(true);
    setError(null);

    try {
      await connector.send({
        to: [{ email: to }],
        subject,
        body,
        replyToMessageId: replyTo?.id,
        threadId: replyTo?.threadId,
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [connector, to, subject, body, replyTo, onSent]);

  const handleGenerateDraft = useCallback(async () => {
    if (!aiPrompt.trim()) {
      setError('Please describe what you want to write');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const options: DraftOptions = {
        intent: 'inform' as DraftIntent,
        tone: aiTone,
        to: to || undefined,
        context: aiPrompt,
      };

      const result = await generateDraft(options);
      setBody(result.body);
      if (result.suggestedSubject && !subject) {
        setSubject(result.suggestedSubject);
      }
      setShowAiPanel(false);
      setAiPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, aiTone, to, subject]);

  return (
    <div className="compose">
      <div className="compose-header">
        <button onClick={onBack} className="btn btn-secondary">
          \u2190 Back
        </button>
        <h2>{replyTo ? 'Reply' : 'Compose'}</h2>
        <button
          onClick={() => setShowAiPanel(!showAiPanel)}
          className={`btn ${showAiPanel ? 'btn-primary' : 'btn-secondary'}`}
        >
          \ud83e\udd16 AI Assist
        </button>
      </div>

      {error && (
        <div className="compose-error">
          {error}
        </div>
      )}

      {showAiPanel && (
        <div className="ai-panel">
          <h3>AI Draft Assistant</h3>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe the email you want to write..."
            rows={3}
          />
          <div className="ai-options">
            <label>
              Tone:
              <select value={aiTone} onChange={(e) => setAiTone(e.target.value as DraftTone)}>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </label>
            <button
              onClick={handleGenerateDraft}
              className="btn btn-primary"
              disabled={generating || !aiPrompt.trim()}
            >
              {generating ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
        </div>
      )}

      <form className="compose-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <div className="form-field">
          <label htmlFor="to">To:</label>
          <input
            id="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="subject">Subject:</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
          />
        </div>

        <div className="form-field">
          <label htmlFor="body">Message:</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here..."
            rows={15}
          />
        </div>

        <div className="compose-actions">
          <button
            type="button"
            onClick={onBack}
            className="btn btn-secondary"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !to.trim()}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
