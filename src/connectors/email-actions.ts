/**
 * Email action service — the single implementation of the inbox write verbs,
 * shared by the individual MCP tools (mail_flag / mail_move) and the
 * consolidated mail_action tool, so action logic lives in exactly one place.
 *
 * Every action writes through to the provider (Gmail / Microsoft Graph) and
 * mirrors the change into the local store, returning the resulting ActionState
 * so callers (e.g. the live artifact) can patch a single row optimistically.
 */

import { getProviderClientForAccount } from './provider-client.js';
import {
  getEmailById,
  updateEmailFlags,
  addLabels,
  removeLabels,
} from '../storage/services/email-storage.js';
import { stageForDeletion } from '../storage/services/deletion-staging.js';
import { EmailFlag, Email } from '../types/email.js';

/** The post-action state of an email row. */
export interface ActionState {
  emailId: number;
  provider: string;
  isRead: boolean;
  flagged: boolean;
  labels: string[];
  flags: EmailFlag[];
  staged: boolean;
}

/** Destinations that mean "remove from inbox" on Gmail. */
export const ARCHIVE_ALIASES: ReadonlySet<string> = new Set([
  'archive',
  'archived',
  'all mail',
  'allmail',
]);

function requireEmail(emailId: number): Email {
  const email = getEmailById(emailId);
  if (!email) {
    throw new Error(`Email with ID ${emailId} not found`);
  }
  return email;
}

function stateOf(email: Email, provider: string, staged = false): ActionState {
  return {
    emailId: email.id,
    provider,
    isRead: email.flags.includes(EmailFlag.SEEN),
    flagged: email.flags.includes(EmailFlag.FLAGGED),
    labels: email.labels,
    flags: email.flags,
    staged,
  };
}

/** Flag or unflag for follow-up. */
export async function flagAction(emailId: number, flagged: boolean): Promise<ActionState> {
  const email = requireEmail(emailId);
  const client = await getProviderClientForAccount(email.accountId);

  if (client.provider === 'outlook') {
    if (flagged) {
      await client.outlook!.setFlag(email.providerMessageId);
    } else {
      await client.outlook!.clearFlag(email.providerMessageId);
    }
  } else {
    await client.gmail!.modifyMessageLabels(
      email.providerMessageId,
      flagged ? ['STARRED'] : undefined,
      flagged ? undefined : ['STARRED']
    );
  }

  const flags = new Set(email.flags);
  if (flagged) flags.add(EmailFlag.FLAGGED);
  else flags.delete(EmailFlag.FLAGGED);
  const newFlags = Array.from(flags);
  updateEmailFlags(emailId, newFlags);

  return stateOf({ ...email, flags: newFlags }, client.provider);
}

/** Mark read or unread. */
export async function markReadAction(emailId: number, isRead: boolean): Promise<ActionState> {
  const email = requireEmail(emailId);
  const client = await getProviderClientForAccount(email.accountId);

  if (client.provider === 'outlook') {
    await client.outlook!.setRead(email.providerMessageId, isRead);
  } else {
    // Gmail: read state is the UNREAD label.
    await client.gmail!.modifyMessageLabels(
      email.providerMessageId,
      isRead ? undefined : ['UNREAD'],
      isRead ? ['UNREAD'] : undefined
    );
  }

  const flags = new Set(email.flags);
  if (isRead) flags.add(EmailFlag.SEEN);
  else flags.delete(EmailFlag.SEEN);
  const newFlags = Array.from(flags);
  updateEmailFlags(emailId, newFlags);

  return stateOf({ ...email, flags: newFlags }, client.provider);
}

/** Move to a folder (Outlook) or relabel (Gmail). */
export async function moveAction(emailId: number, destination: string): Promise<ActionState> {
  const email = requireEmail(emailId);
  const client = await getProviderClientForAccount(email.accountId);
  const isArchive = ARCHIVE_ALIASES.has(destination.trim().toLowerCase());

  if (client.provider === 'outlook') {
    await client.outlook!.moveMessage(email.providerMessageId, destination);
  } else if (isArchive) {
    await client.gmail!.modifyMessageLabels(email.providerMessageId, undefined, ['INBOX']);
    removeLabels(emailId, ['INBOX']);
  } else {
    await client.gmail!.modifyMessageLabels(email.providerMessageId, [destination], undefined);
    addLabels(emailId, [destination]);
  }

  return stateOf(requireEmail(emailId), client.provider);
}

/** Archive (Outlook Archive folder / Gmail remove-from-inbox). */
export async function archiveAction(emailId: number): Promise<ActionState> {
  const email = requireEmail(emailId);
  const client = await getProviderClientForAccount(email.accountId);

  if (client.provider === 'outlook') {
    await client.outlook!.archiveMessage(email.providerMessageId);
  } else {
    await client.gmail!.modifyMessageLabels(email.providerMessageId, undefined, ['INBOX']);
    removeLabels(emailId, ['INBOX']);
  }

  return stateOf(requireEmail(emailId), client.provider);
}

/**
 * Stage for deletion (phase 1 of the two-phase delete). Nothing is removed
 * from the provider; the email is recorded for a later mail_commit_deletions.
 */
export function stageDeleteAction(emailId: number): ActionState {
  const email = requireEmail(emailId);
  const result = stageForDeletion([emailId]);
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].error);
  }
  return stateOf(email, 'local', true);
}

/**
 * Unsubscribe (best-effort): archive the message so the sender drops out of
 * the inbox. Header-based List-Unsubscribe execution is a tracked follow-up;
 * this keeps the inbox clean without making an unverified outbound request.
 */
export async function unsubscribeAction(emailId: number): Promise<ActionState> {
  return archiveAction(emailId);
}
