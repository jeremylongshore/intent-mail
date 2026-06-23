/**
 * Account Type Definitions
 *
 * Zod schemas and TypeScript types for email account entities.
 */

import { z } from 'zod';

/**
 * Supported email providers
 */
export enum EmailProvider {
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
}

/**
 * OAuth tokens schema
 */
export const OAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),  // ISO 8601
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

/**
 * Account sync state schema
 */
export const SyncStateSchema = z.object({
  lastHistoryId: z.string().optional(),  // Gmail History API
  deltaToken: z.string().optional(),      // Outlook Graph API
  lastSyncAt: z.string().optional(),      // ISO 8601
});

export type SyncState = z.infer<typeof SyncStateSchema>;

/**
 * Watch state schema (for push notifications)
 */
export const WatchStateSchema = z.object({
  expiration: z.string().optional(),      // ISO 8601 - when watch expires
  historyId: z.string().optional(),       // History ID when watch was set up
  pushEnabled: z.boolean().default(false),
});

export type WatchState = z.infer<typeof WatchStateSchema>;

/**
 * Account schema (domain object)
 */
export const AccountSchema = z.object({
  id: z.number().int().positive(),
  provider: z.nativeEnum(EmailProvider),
  email: z.string().email(),
  displayName: z.string().optional(),

  // OAuth tokens (optional - may not be loaded for privacy)
  tokens: OAuthTokensSchema.optional(),

  // Sync state
  syncState: SyncStateSchema.optional(),

  // Watch state (push notifications)
  watchState: WatchStateSchema.optional(),

  // Status
  isActive: z.boolean(),

  // Timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * Account row (database representation with snake_case)
 */
export interface AccountRow {
  id: number;
  provider: string;  // 'gmail' | 'outlook'
  email: string;
  display_name: string | null;

  // OAuth tokens
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  token_enc_version?: number; // 0 = plaintext (legacy), 1 = AES-256-GCM

  // Delta sync state
  last_history_id: string | null;
  delta_token: string | null;
  last_sync_at: string | null;

  // Push notification / watch state
  watch_expiration: string | null;
  watch_history_id: string | null;
  push_enabled: number;  // 0 or 1

  // Status
  is_active: number;  // 0 or 1

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Create account input
 */
export const CreateAccountInputSchema = z.object({
  provider: z.nativeEnum(EmailProvider),
  email: z.string().email(),
  displayName: z.string().optional(),
  tokens: OAuthTokensSchema,
});

export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

/**
 * Update tokens input
 */
export const UpdateTokensInputSchema = z.object({
  accountId: z.number().int().positive(),
  tokens: OAuthTokensSchema,
});

export type UpdateTokensInput = z.infer<typeof UpdateTokensInputSchema>;

/**
 * Update sync state input
 */
export const UpdateSyncStateInputSchema = z.object({
  accountId: z.number().int().positive(),
  syncState: SyncStateSchema,
});

export type UpdateSyncStateInput = z.infer<typeof UpdateSyncStateInputSchema>;

/**
 * Account with email count (for list views)
 */
export const AccountWithStatsSchema = AccountSchema.extend({
  emailCount: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
});

export type AccountWithStats = z.infer<typeof AccountWithStatsSchema>;
