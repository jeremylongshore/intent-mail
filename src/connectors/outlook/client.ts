/**
 * Outlook Graph API Client
 *
 * Microsoft Graph API client for email operations.
 */

import { OutlookOAuth } from './oauth.js';
import { OAuthTokens } from '../../types/account.js';
import {
  fetchWithRetry,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
} from '../shared/retry.js';

/**
 * Graph API base URL
 */
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Fields requested on every message read. Centralized so list/get/delta stay
 * in sync with the GraphMessage interface.
 */
const MESSAGE_SELECT_FIELDS =
  'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead,isDraft,flag,importance,categories,internetMessageId,conversationIndex';

/**
 * Graph message flag status values.
 */
export type GraphFlagStatus = 'notFlagged' | 'flagged' | 'complete';

/**
 * Graph message importance values.
 */
export type GraphImportance = 'low' | 'normal' | 'high';

/**
 * User profile from Graph API
 */
export interface OutlookUserProfile {
  emailAddress: string;
  displayName: string;
  id: string;
}

/**
 * Email address in Graph API format
 */
export interface GraphEmailAddress {
  name?: string;
  address: string;
}

/**
 * Mail folder from Graph API
 */
export interface GraphMailFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount?: number;
  unreadItemCount?: number;
  totalItemCount?: number;
}

/**
 * Message from Graph API
 */
export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: GraphEmailAddress;
  };
  toRecipients: Array<{ emailAddress: GraphEmailAddress }>;
  ccRecipients?: Array<{ emailAddress: GraphEmailAddress }>;
  bccRecipients?: Array<{ emailAddress: GraphEmailAddress }>;
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
  isDraft: boolean;
  flag?: {
    flagStatus: GraphFlagStatus;
  };
  importance?: GraphImportance;
  categories?: string[];
  internetMessageId?: string;
  conversationIndex?: string;
}

/**
 * Messages response from Graph API
 */
export interface GraphMessagesResponse {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/**
 * Patch payload for updating a message. All fields optional; only the
 * provided ones are sent to Graph.
 */
export interface MessageUpdate {
  isRead?: boolean;
  flag?: { flagStatus: GraphFlagStatus };
  importance?: GraphImportance;
  categories?: string[];
}

/**
 * Well-known Graph mail folders that can be addressed by name in a path
 * segment (no folder-id lookup required).
 */
export const WELL_KNOWN_FOLDERS = [
  'archive',
  'inbox',
  'drafts',
  'sentitems',
  'deleteditems',
  'junkemail',
  'clutter',
  'conflicts',
  'localfailures',
  'outbox',
  'recoverableitemsdeletions',
  'scheduled',
  'searchfolders',
  'serverfailures',
  'syncissues',
] as const;

export type WellKnownFolder = (typeof WELL_KNOWN_FOLDERS)[number];

/**
 * Options controlling client behavior.
 */
export interface OutlookClientOptions {
  /** Retry policy for transient throttling/5xx failures. */
  retryPolicy?: RetryPolicy;
  /**
   * Invoked when the client transparently refreshes the access token after a
   * 401. Use this to persist the new tokens (e.g. into account storage).
   */
  onTokensRefreshed?: (tokens: OAuthTokens) => void | Promise<void>;
}

/**
 * Resolve a destination into a Graph folder path segment.
 *
 * Graph accepts well-known folder names ("archive", "deleteditems", …)
 * directly in the path in place of a folder id, so callers can pass either a
 * concrete folder id or a well-known name.
 */
export function resolveWellKnownFolder(destination: string): string {
  const normalized = destination.trim().toLowerCase().replace(/[\s_-]/g, '');
  const aliases: Record<string, WellKnownFolder> = {
    archive: 'archive',
    trash: 'deleteditems',
    deleted: 'deleteditems',
    deleteditems: 'deleteditems',
    junk: 'junkemail',
    spam: 'junkemail',
    junkemail: 'junkemail',
    inbox: 'inbox',
    drafts: 'drafts',
    sent: 'sentitems',
    sentitems: 'sentitems',
    outbox: 'outbox',
  };

  if (normalized in aliases) {
    return aliases[normalized];
  }
  if ((WELL_KNOWN_FOLDERS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  // Otherwise treat the input as a concrete folder id.
  return destination;
}

/**
 * Parse a Graph response body, tolerating empty bodies (204 No Content from
 * DELETE, 202 Accepted from sendMail). Returns `undefined` (cast to T) when
 * there is nothing to parse.
 */
async function parseGraphBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 202) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

/**
 * Outlook Graph API client
 */
export class OutlookClient {
  private oauth: OutlookOAuth;
  private retryPolicy: RetryPolicy;
  private onTokensRefreshed?: (tokens: OAuthTokens) => void | Promise<void>;

  constructor(oauth: OutlookOAuth, options: OutlookClientOptions = {}) {
    this.oauth = oauth;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.onTokensRefreshed = options.onTokensRefreshed;
  }

  /**
   * Refresh the access token using the stored refresh token, persisting the
   * new tokens via the optional callback. Used as a 401 recovery step.
   */
  private async refreshTokens(): Promise<void> {
    const creds = this.oauth.getCredentials();
    if (!creds?.refreshToken) {
      throw new Error('Cannot refresh Graph token: no refresh token available');
    }
    const newTokens = await this.oauth.refreshAccessToken(creds.refreshToken);
    this.oauth.setCredentials(newTokens);
    if (this.onTokensRefreshed) {
      await this.onTokensRefreshed(newTokens);
    }
  }

  /**
   * Make an authenticated Graph API request.
   *
   * Handles three things the naive implementation got wrong:
   *  1. Absolute `@odata.nextLink` / `@odata.deltaLink` URLs are used as-is
   *     (not prefixed with the API base — that broke pagination/delta past
   *     page 1).
   *  2. Empty 202/204 bodies are tolerated (DELETE/sendMail no longer throw
   *     on `.json()` of an empty body).
   *  3. Transient throttling (429) and 5xx are retried with backoff, and a
   *     single 401 triggers a token refresh + one retry.
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;

    const doFetch = (): Promise<Response> => {
      const accessToken = this.oauth.getAccessToken();
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    };

    let response = await fetchWithRetry(doFetch, this.retryPolicy);

    // Single 401 -> refresh -> retry.
    if (response.status === 401) {
      await this.refreshTokens();
      response = await fetchWithRetry(doFetch, this.retryPolicy);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph API request failed: ${response.status} - ${errorText}`);
    }

    return parseGraphBody<T>(response);
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<OutlookUserProfile> {
    const data = await this.request<{ mail: string; userPrincipalName?: string; displayName: string; id: string }>('/me');

    return {
      // Personal/consumer accounts can have a null `mail`; fall back to UPN.
      emailAddress: data.mail || data.userPrincipalName || '',
      displayName: data.displayName,
      id: data.id,
    };
  }

  /**
   * List messages (paginated)
   */
  async listMessages(options: {
    maxResults?: number;
    pageToken?: string;
  }): Promise<GraphMessagesResponse> {
    const params = new URLSearchParams();

    if (options.maxResults) {
      params.set('$top', options.maxResults.toString());
    }

    // Select only fields we need to reduce payload size
    params.set('$select', MESSAGE_SELECT_FIELDS);
    params.set('$orderby', 'receivedDateTime desc');

    // A page token is an absolute @odata.nextLink — use it verbatim.
    const endpoint = options.pageToken || `/me/messages?${params}`;

    return this.request<GraphMessagesResponse>(endpoint);
  }

  /**
   * Get delta changes (incremental sync)
   */
  async getDelta(deltaLink?: string): Promise<GraphMessagesResponse> {
    // A delta/next link is an absolute URL — use it verbatim.
    const endpoint = deltaLink || `/me/messages/delta?$select=${MESSAGE_SELECT_FIELDS}`;

    return this.request<GraphMessagesResponse>(endpoint);
  }

  /**
   * Get single message by ID
   */
  async getMessage(messageId: string): Promise<GraphMessage> {
    return this.request<GraphMessage>(
      `/me/messages/${messageId}?$select=${MESSAGE_SELECT_FIELDS}`
    );
  }

  /**
   * Send message
   */
  async sendMessage(message: {
    subject: string;
    body: {
      contentType: 'Text' | 'HTML';
      content: string;
    };
    toRecipients: Array<{ emailAddress: GraphEmailAddress }>;
    ccRecipients?: Array<{ emailAddress: GraphEmailAddress }>;
    bccRecipients?: Array<{ emailAddress: GraphEmailAddress }>;
    internetMessageId?: string;
    attachments?: Array<{
      '@odata.type': '#microsoft.graph.fileAttachment';
      name: string;
      contentType: string;
      contentBytes: string;
      contentId?: string;
    }>;
  }): Promise<void> {
    await this.request<void>('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Update message fields (read state, flag, importance, categories).
   */
  async updateMessage(messageId: string, update: MessageUpdate): Promise<GraphMessage> {
    return this.request<GraphMessage>(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  /**
   * Mark a message read or unread.
   */
  async setRead(messageId: string, isRead: boolean): Promise<GraphMessage> {
    return this.updateMessage(messageId, { isRead });
  }

  /**
   * Flag a message for follow-up.
   */
  async setFlag(messageId: string): Promise<GraphMessage> {
    return this.updateMessage(messageId, { flag: { flagStatus: 'flagged' } });
  }

  /**
   * Clear a message's follow-up flag.
   */
  async clearFlag(messageId: string): Promise<GraphMessage> {
    return this.updateMessage(messageId, { flag: { flagStatus: 'notFlagged' } });
  }

  /**
   * Set a message's importance.
   */
  async setImportance(messageId: string, importance: GraphImportance): Promise<GraphMessage> {
    return this.updateMessage(messageId, { importance });
  }

  /**
   * Add categories (labels) to message
   */
  async addCategories(messageId: string, categories: string[]): Promise<GraphMessage> {
    // Get current categories
    const message = await this.getMessage(messageId);
    const currentCategories = message.categories || [];

    // Merge and deduplicate
    const newCategories = Array.from(new Set([...currentCategories, ...categories]));

    return this.updateMessage(messageId, { categories: newCategories });
  }

  /**
   * Remove categories from message
   */
  async removeCategories(messageId: string, categoriesToRemove: string[]): Promise<GraphMessage> {
    // Get current categories
    const message = await this.getMessage(messageId);
    const currentCategories = message.categories || [];

    // Filter out categories to remove
    const newCategories = currentCategories.filter((cat) => !categoriesToRemove.includes(cat));

    return this.updateMessage(messageId, { categories: newCategories });
  }

  /**
   * List mail folders (top-level). Includes well-known + user folders.
   */
  async listFolders(options: { top?: number } = {}): Promise<GraphMailFolder[]> {
    const params = new URLSearchParams();
    params.set('$top', String(options.top ?? 100));
    params.set(
      '$select',
      'id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount'
    );

    const response = await this.request<{ value: GraphMailFolder[] }>(
      `/me/mailFolders?${params}`
    );
    return response.value;
  }

  /**
   * Move message to a folder. The destination may be a concrete folder id or
   * a well-known folder name (e.g. "archive", "deleteditems").
   */
  async moveMessage(messageId: string, destination: string): Promise<GraphMessage> {
    const destinationId = resolveWellKnownFolder(destination);
    return this.request<GraphMessage>(`/me/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId }),
    });
  }

  /**
   * Archive a message (move to the well-known Archive folder).
   */
  async archiveMessage(messageId: string): Promise<GraphMessage> {
    return this.moveMessage(messageId, 'archive');
  }

  /**
   * Delete message (moves to Deleted Items per Graph semantics).
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.request<void>(`/me/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List attachments for a message
   */
  async listAttachments(messageId: string): Promise<Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
    contentId?: string;
    '@odata.type'?: string;
  }>> {
    const response = await this.request<{
      value: Array<{
        id: string;
        name: string;
        contentType: string;
        size: number;
        isInline: boolean;
        contentId?: string;
        '@odata.type'?: string;
      }>;
    }>(`/me/messages/${messageId}/attachments`);

    return response.value;
  }

  /**
   * Get attachment data
   */
  async getAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<{ data: string; size: number; name: string; contentType: string }> {
    const response = await this.request<{
      '@odata.type': string;
      id: string;
      name: string;
      contentType: string;
      size: number;
      contentBytes?: string;
    }>(`/me/messages/${messageId}/attachments/${attachmentId}`);

    // Only fileAttachment carries contentBytes; itemAttachment / reference
    // attachments do not and must be guarded by the caller.
    if (response['@odata.type'] !== '#microsoft.graph.fileAttachment') {
      throw new Error(
        `Attachment ${attachmentId} is a ${response['@odata.type']}, not a file attachment; binary content is unavailable.`
      );
    }

    return {
      data: response.contentBytes ?? '',
      size: response.size,
      name: response.name,
      contentType: response.contentType,
    };
  }
}

/**
 * Create Outlook Graph API client
 */
export function createOutlookClient(
  oauth: OutlookOAuth,
  options: OutlookClientOptions = {}
): OutlookClient {
  return new OutlookClient(oauth, options);
}
