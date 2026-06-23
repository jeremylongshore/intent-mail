/**
 * DailyReview — the web app's default surface (C6). The browser counterpart of
 * the live artifact: it reads /api/digest via useDigest and round-trips actions
 * through /api/action (optimistic). Imports ONLY the api client + view types —
 * never server modules — so the browser bundle stays clean of native deps.
 */

import React, { useState } from 'react';
import { useDigest } from '../../hooks/useDigest.js';
import type { Digest, DigestEmail, DigestGroup, Priority, DigestAction } from '../../types.js';
import '../../styles/tokens.css';

const PRIORITY_LABEL: Record<Priority, string> = { P1: 'Urgent', P2: 'High', P3: 'Normal', P4: 'Low' };

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={`im-chip ${priority}`} title={PRIORITY_LABEL[priority]}>
      {priority}
    </span>
  );
}

export function WhyPill({ why }: { why: string }) {
  return (
    <div className="im-why">
      <span className="lbl">why</span> {why}
    </div>
  );
}

export function StatsHeader({ stats }: { stats: Digest['stats'] }) {
  const items: Array<{ n: number; l: string; hot?: boolean }> = [
    { n: stats.total, l: 'In review' },
    { n: stats.new, l: 'New' },
    { n: stats.needResponse, l: 'Need response' },
    { n: stats.highPriority, l: 'High priority', hot: stats.highPriority > 0 },
  ];
  return (
    <div className="im-stats">
      {items.map((it) => (
        <div className={`im-stat${it.hot ? ' hot' : ''}`} key={it.l}>
          <div className="n">{it.n}</div>
          <div className="l">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

export function QuickActions({
  email,
  onAction,
}: {
  email: DigestEmail;
  onAction: (op: DigestAction) => void;
}) {
  return (
    <div className="im-actions">
      {email.actions.map((op) => (
        <button
          key={op}
          className={`im-act${op === 'stage_delete' ? ' danger' : ''}`}
          onClick={() => onAction(op)}
        >
          {op.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

export function EmailRow({
  email,
  done,
  onAction,
}: {
  email: DigestEmail;
  done: boolean;
  onAction: (op: DigestAction) => void;
}) {
  return (
    <div className={`im-row${done ? ' done' : ''}`}>
      <div className="im-row-top">
        <PriorityChip priority={email.priority} />
        <div className="im-subjwrap">
          <div className="im-subjline">
            <span className="im-subject">{email.subject || '(no subject)'}</span>
            {email.needsResponse && <span className="im-badge needs">needs reply</span>}
            {email.collapsed && <span className="im-badge">thread ×{email.threadSize}</span>}
          </div>
          <div className="im-from">{email.from.name || email.from.address}</div>
          <WhyPill why={email.why} />
          <div className="im-summary">
            {email.summary}
            {email.deadline?.date && (
              <span className="im-deadline"> · due {new Date(email.deadline.date).toLocaleDateString()}</span>
            )}
          </div>
          <QuickActions email={email} onAction={onAction} />
        </div>
      </div>
    </div>
  );
}

export function CategoryGroup({
  group,
  doneIds,
  onAction,
}: {
  group: DigestGroup;
  doneIds: Set<number>;
  onAction: (emailId: number, op: DigestAction) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="im-group">
      <div className="im-group-head" onClick={() => setOpen((o) => !o)}>
        <span>{open ? '▾' : '▸'}</span>
        <span className="im-group-title">{group.label}</span>
        <span className="im-group-count">{group.emails.length}</span>
      </div>
      {open && (
        <div className="im-group-body">
          {group.emails.map((e) => (
            <EmailRow
              key={e.emailId}
              email={e}
              done={doneIds.has(e.emailId)}
              onAction={(op) => onAction(e.emailId, op)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DailyReview({ accountId }: { accountId?: number }) {
  const { digest, loading, error, doneIds, act, reload } = useDigest({ accountId });

  if (loading) return <div className="im-wrap"><div className="im-empty">Loading your daily review…</div></div>;
  if (error) {
    return (
      <div className="im-wrap">
        <div className="im-empty">
          {error}
          <div><button className="im-act" onClick={reload}>Retry</button></div>
        </div>
      </div>
    );
  }
  if (!digest || digest.groups.length === 0) {
    return <div className="im-wrap"><div className="im-empty">Nothing to review. Sync an account to get started.</div></div>;
  }

  return (
    <div className="im-wrap">
      <StatsHeader stats={digest.stats} />
      {digest.suggestions.map((s, i) => (
        <div className="im-suggestion" key={i}>💡 {s}</div>
      ))}
      {digest.groups.map((g) => (
        <CategoryGroup key={g.category} group={g} doneIds={doneIds} onAction={act} />
      ))}
    </div>
  );
}
