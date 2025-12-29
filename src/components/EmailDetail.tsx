/**
 * EmailDetail - Platform-agnostic email detail view
 *
 * Transforms email detail data into render-ready format for any platform.
 * E1.S1.2: Shared Component Layer
 */

import type { EmailDetailProps } from '../adapters/types.js';

/**
 * Formatted email address for display
 */
export interface FormattedAddress {
  display: string;
  email: string;
  name?: string;
}

/**
 * Formatted attachment info
 */
export interface FormattedAttachment {
  id: string;
  filename: string;
  sizeKB: number;
  mimeType: string;
}

/**
 * Complete render data for email detail view
 */
export interface EmailDetailRenderData {
  id: string;
  from: FormattedAddress;
  to: FormattedAddress[];
  cc?: FormattedAddress[];
  subject: string;
  date: string;
  labels: string[];
  isStarred: boolean;
  isRead: boolean;
  bodyLines: string[];
  visibleBodyLines: string[];
  attachments: FormattedAttachment[];
  scrollOffset: number;
  totalLines: number;
  hasMore: boolean;
}

/**
 * Format email address for display
 */
function formatAddress(addr: { email: string; name?: string }): FormattedAddress {
  const display = addr.name ? `${addr.name} <${addr.email}>` : addr.email;
  return {
    display,
    email: addr.email,
    name: addr.name,
  };
}

/**
 * Format date and time for display
 */
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

/**
 * Word wrap text to fit width
 */
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

/**
 * Transform email detail props into render-ready data
 *
 * Platform-agnostic business logic for email detail view.
 * Platform adapters consume this data for rendering.
 */
export function useEmailDetail(
  props: EmailDetailProps,
  options?: { bodyWidth?: number; visibleLines?: number }
): EmailDetailRenderData {
  const { email, scrollOffset } = props;
  const bodyWidth = options?.bodyWidth ?? 76;
  const visibleLineCount = options?.visibleLines ?? 15;

  // Format addresses
  const from = formatAddress(email.from);
  const to = email.to.map(formatAddress);
  const cc = email.cc && email.cc.length > 0 ? email.cc.map(formatAddress) : undefined;

  // Format attachments
  const attachments: FormattedAttachment[] = email.attachments.map((att) => ({
    id: att.id,
    filename: att.filename,
    sizeKB: Math.round(att.size / 1024),
    mimeType: att.mimeType,
  }));

  // Wrap body text
  const bodyContent = email.body || email.snippet || '(No content)';
  const bodyLines = wrapText(bodyContent, bodyWidth);

  // Calculate visible portion
  const visibleBodyLines = bodyLines.slice(scrollOffset, scrollOffset + visibleLineCount);
  const hasMore = bodyLines.length > visibleLineCount;

  return {
    id: email.id,
    from,
    to,
    cc,
    subject: email.subject,
    date: formatDateTime(new Date(email.date)),
    labels: email.labels,
    isStarred: email.isStarred,
    isRead: email.isRead,
    bodyLines,
    visibleBodyLines,
    attachments,
    scrollOffset,
    totalLines: bodyLines.length,
    hasMore,
  };
}

/**
 * Action handlers interface
 */
export interface EmailDetailActions {
  onBack: () => void;
  onReply: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onScrollUp: () => void;
  onScrollDown: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
}
