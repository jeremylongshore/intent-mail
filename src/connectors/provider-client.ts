/**
 * Provider client factory.
 *
 * Centralizes the account -> oauth -> (refresh + persist) -> client dance that
 * was copy-pasted across mail_send / mail_sync / attachment tools. Returns a
 * ready-to-use Gmail or Outlook API client with tokens refreshed and the 401
 * refresh-persist hook wired.
 */

import { EmailProvider } from '../types/account.js';
import { getAccountById, updateTokens } from '../storage/services/account-storage.js';
import { createGmailOAuth, getGmailOAuthConfigFromEnv } from './gmail/oauth.js';
import { createOutlookOAuth, getOutlookOAuthConfigFromEnv } from './outlook/oauth.js';
import { createGmailClient, GmailClient } from './gmail/client.js';
import { createOutlookClient, OutlookClient } from './outlook/client.js';

/**
 * A resolved provider client. Exactly one of `gmail` / `outlook` is set,
 * matching `provider`.
 */
export interface ProviderClient {
  provider: EmailProvider;
  accountId: number;
  email: string;
  gmail?: GmailClient;
  outlook?: OutlookClient;
}

/**
 * Build a ready-to-use provider API client for an account.
 *
 * Loads the account (with tokens), validates it is active and authenticated,
 * proactively refreshes an expired access token (persisting the result), and
 * wires the on-401 refresh-persist callback for the Outlook client.
 *
 * @throws if the account is missing, inactive, or has no OAuth tokens.
 */
export async function getProviderClientForAccount(accountId: number): Promise<ProviderClient> {
  const account = getAccountById(accountId, true); // includeTokens
  if (!account) {
    throw new Error(`Account with ID ${accountId} not found`);
  }
  if (!account.isActive) {
    throw new Error(`Account ${account.email} is inactive`);
  }
  if (!account.tokens) {
    throw new Error(
      `Account ${account.email} has no OAuth tokens. Run mail_auth_start first.`
    );
  }

  if (account.provider === EmailProvider.GMAIL) {
    const oauth = createGmailOAuth(getGmailOAuthConfigFromEnv());
    oauth.setCredentials(account.tokens);
    if (oauth.isTokenExpired(account.tokens)) {
      const newTokens = await oauth.refreshAccessToken(account.tokens.refreshToken);
      updateTokens({ accountId: account.id, tokens: newTokens });
      oauth.setCredentials(newTokens);
    }
    return {
      provider: account.provider,
      accountId: account.id,
      email: account.email,
      gmail: createGmailClient(oauth),
    };
  }

  if (account.provider === EmailProvider.OUTLOOK) {
    const oauth = createOutlookOAuth(getOutlookOAuthConfigFromEnv());
    oauth.setCredentials(account.tokens);
    if (oauth.isTokenExpired(account.tokens)) {
      const newTokens = await oauth.refreshAccessToken(account.tokens.refreshToken);
      updateTokens({ accountId: account.id, tokens: newTokens });
      oauth.setCredentials(newTokens);
    }
    const outlook = createOutlookClient(oauth, {
      onTokensRefreshed: (tokens) => {
        updateTokens({ accountId: account.id, tokens });
      },
    });
    return {
      provider: account.provider,
      accountId: account.id,
      email: account.email,
      outlook,
    };
  }

  throw new Error(`Unsupported provider: ${account.provider}`);
}
