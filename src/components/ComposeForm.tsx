/**
 * ComposeForm - Platform-agnostic email composition
 *
 * Form state management and validation for email composition.
 * E1.S1.2: Shared Component Layer
 */

import type { ComposeProps } from '../adapters/types.js';

/**
 * Compose form field type
 */
export type ComposeField = 'to' | 'subject' | 'body';

/**
 * Form validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: {
    to?: string;
    subject?: string;
    body?: string;
  };
}

/**
 * Complete render data for compose view
 */
export interface ComposeFormRenderData {
  to: string;
  subject: string;
  body: string;
  replyTo?: {
    from: string;
    date: string;
    subject: string;
    snippet: string;
  };
  sending: boolean;
  error: string | null;
  validation: ValidationResult;
  canSend: boolean;
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate compose form data
 */
function validateForm(to: string, subject: string, body: string): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  if (!to.trim()) {
    errors.to = 'Recipient is required';
  } else if (!isValidEmail(to)) {
    errors.to = 'Invalid email address';
  }

  if (!subject.trim()) {
    errors.subject = 'Subject is required';
  }

  // Body is optional but could have minimum length requirement
  if (body.trim().length === 0) {
    // Warning only - not an error
  }

  const valid = Object.keys(errors).length === 0;

  return { valid, errors };
}

/**
 * Transform compose props into render-ready data
 *
 * Platform-agnostic form state and validation logic.
 */
export function useComposeForm(props: ComposeProps): ComposeFormRenderData {
  const { to, subject, body, replyTo, sending, error } = props;

  // Validate form
  const validation = validateForm(to, subject, body);

  // Format reply-to context if present
  const replyToData = replyTo
    ? {
        from: replyTo.from.name || replyTo.from.email,
        date: new Date(replyTo.date).toLocaleString(),
        subject: replyTo.subject,
        snippet: replyTo.snippet,
      }
    : undefined;

  return {
    to,
    subject,
    body,
    replyTo: replyToData,
    sending,
    error,
    validation,
    canSend: validation.valid && !sending,
  };
}

/**
 * Action handlers interface
 */
export interface ComposeFormActions {
  onToChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onAIGenerate?: () => void;
  onNextField: () => void;
  onPreviousField: () => void;
}

/**
 * Field navigation helper
 */
export function getNextField(current: ComposeField, reverse = false): ComposeField {
  const fields: ComposeField[] = ['to', 'subject', 'body'];
  const currentIndex = fields.indexOf(current);

  if (reverse) {
    const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
    return fields[prevIndex];
  } else {
    const nextIndex = (currentIndex + 1) % fields.length;
    return fields[nextIndex];
  }
}
