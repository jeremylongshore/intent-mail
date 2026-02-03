/**
 * Mail Extract Attachments Tool
 *
 * Batch extract attachments to filesystem with content-based deduplication.
 */

import { z } from 'zod';
import {
  getPendingAttachments,
  extractAttachment,
  BatchExtractionResult,
} from '../../storage/services/attachment-liberation.js';
import { getDatabase } from '../../storage/database.js';
import { createGmailClient } from '../../connectors/gmail/client.js';
import { createGmailOAuth, getGmailOAuthConfigFromEnv } from '../../connectors/gmail/oauth.js';
import { getAccountById } from '../../storage/services/account-storage.js';
import { EmailProvider } from '../../types/account.js';

/**
 * Input schema for mail_extract_attachments
 */
const MailExtractAttachmentsInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  limit: z.number().int().positive().max(100).default(20).describe('Max attachments to extract (max 100)'),
  skipLargerThan: z.number().int().positive().optional().describe('Skip attachments larger than this size in bytes'),
  mimeTypeFilter: z.array(z.string()).optional().describe('Only extract these MIME types (e.g., ["image/png", "application/pdf"])'),
  dryRun: z.boolean().default(false).describe('Preview without actually extracting'),
});

/**
 * Output schema for mail_extract_attachments
 */
const MailExtractAttachmentsOutputSchema = z.object({
  extracted: z.array(z.object({
    attachmentId: z.number(),
    emailId: z.number(),
    filename: z.string(),
    contentHash: z.string(),
    localPath: z.string(),
    sizeBytes: z.number(),
    deduplicated: z.boolean(),
  })),
  skipped: z.number(),
  errors: z.array(z.object({
    attachmentId: z.number(),
    error: z.string(),
  })),
  totalBytes: z.number(),
  savedBytes: z.number(),
  dryRun: z.boolean(),
  pending: z.number(),
});

/**
 * Mail extract attachments tool definition and handler
 */
export const mailExtractAttachmentsTool = {
  definition: {
    name: 'mail_extract_attachments',
    description: `Extract attachments from emails to local filesystem.

Features:
- Content-based deduplication using SHA-256 hashes
- Organized storage: by-hash/ for deduped files, by-email/ for symlinks
- Batch processing with configurable limits
- MIME type filtering
- Dry-run mode for preview

The extracted files are stored in:
  data/attachments/by-hash/XX/YY/full-hash  (actual files)
  data/attachments/by-email/account/year/month/filename  (symlinks)`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        limit: {
          type: 'number',
          description: 'Max attachments to extract (max 100, default 20)',
          default: 20,
        },
        skipLargerThan: {
          type: 'number',
          description: 'Skip attachments larger than this size in bytes',
        },
        mimeTypeFilter: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only extract these MIME types',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview without actually extracting',
          default: false,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailExtractAttachmentsInputSchema.parse(args);
    const db = getDatabase();

    // Get pending attachments
    let pending = getPendingAttachments(input.accountId, input.limit * 2);

    // Apply filters
    if (input.skipLargerThan) {
      pending = pending.filter((a) => a.sizeBytes <= input.skipLargerThan!);
    }

    // Get MIME types and filter
    if (input.mimeTypeFilter && input.mimeTypeFilter.length > 0) {
      const mimeTypes = new Set(input.mimeTypeFilter);
      const attachmentMimeTypes = new Map<number, string>();

      for (const a of pending) {
        const row = db.prepare('SELECT mime_type FROM attachments WHERE id = ?')
          .get(a.id) as { mime_type: string } | undefined;
        if (row) {
          attachmentMimeTypes.set(a.id, row.mime_type);
        }
      }

      pending = pending.filter((a) => {
        const mimeType = attachmentMimeTypes.get(a.id);
        return mimeType && mimeTypes.has(mimeType);
      });
    }

    // Limit to requested count
    pending = pending.slice(0, input.limit);

    const result: BatchExtractionResult = {
      extracted: [],
      skipped: 0,
      errors: [],
      totalBytes: 0,
      savedBytes: 0,
    };

    if (input.dryRun) {
      // Just return what would be extracted
      const output = {
        extracted: pending.map((a) => ({
          attachmentId: a.id,
          emailId: a.emailId,
          filename: a.filename,
          contentHash: '(dry-run)',
          localPath: '(dry-run)',
          sizeBytes: a.sizeBytes,
          deduplicated: false,
        })),
        skipped: 0,
        errors: [],
        totalBytes: pending.reduce((sum, a) => sum + a.sizeBytes, 0),
        savedBytes: 0,
        dryRun: true,
        pending: pending.length,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }

    // Extract attachments
    for (const attachment of pending) {
      try {
        // Get email and account info
        const emailRow = db.prepare(`
          SELECT e.account_id, e.provider_message_id, a.provider_attachment_id
          FROM emails e
          JOIN attachments a ON a.email_id = e.id
          WHERE a.id = ?
        `).get(attachment.id) as {
          account_id: number;
          provider_message_id: string;
          provider_attachment_id: string | null;
        } | undefined;

        if (!emailRow || !emailRow.provider_attachment_id) {
          result.errors.push({
            attachmentId: attachment.id,
            error: 'Missing provider attachment ID',
          });
          continue;
        }

        // Get account
        const account = getAccountById(emailRow.account_id);
        if (!account) {
          result.errors.push({
            attachmentId: attachment.id,
            error: 'Account not found',
          });
          continue;
        }

        // Fetch attachment content from provider
        let content: Buffer;

        if (account.provider === EmailProvider.GMAIL) {
          if (!account.tokens) {
            result.errors.push({
              attachmentId: attachment.id,
              error: 'Account has no OAuth tokens',
            });
            continue;
          }

          // Create Gmail client with proper OAuth
          const config = getGmailOAuthConfigFromEnv();
          const oauth = createGmailOAuth(config);
          oauth.setCredentials(account.tokens);

          // Check and refresh tokens if needed
          if (oauth.isTokenExpired(account.tokens)) {
            // Skip for now, let sync handle token refresh
            result.errors.push({
              attachmentId: attachment.id,
              error: 'OAuth tokens expired. Run mail_sync to refresh.',
            });
            continue;
          }

          const gmailClient = createGmailClient(oauth);
          const attachmentData = await gmailClient.getAttachment(
            emailRow.provider_message_id,
            emailRow.provider_attachment_id
          );
          content = Buffer.from(attachmentData.data, 'base64');
        } else {
          // TODO: Implement Outlook attachment fetching
          result.errors.push({
            attachmentId: attachment.id,
            error: `Provider ${account.provider} not yet supported for extraction`,
          });
          continue;
        }

        // Extract to filesystem
        const extractResult = await extractAttachment(attachment.id, content);

        result.extracted.push({
          attachmentId: extractResult.attachmentId,
          emailId: extractResult.emailId,
          filename: extractResult.filename,
          contentHash: extractResult.contentHash,
          localPath: extractResult.localPath,
          sizeBytes: extractResult.sizeBytes,
          deduplicated: extractResult.deduplicated,
        });

        result.totalBytes += extractResult.sizeBytes;
        if (extractResult.deduplicated) {
          result.savedBytes += extractResult.sizeBytes;
        }
      } catch (error) {
        result.errors.push({
          attachmentId: attachment.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Get remaining pending count
    const remainingPending = getPendingAttachments(input.accountId, 1);

    const output = {
      extracted: result.extracted,
      skipped: result.skipped,
      errors: result.errors,
      totalBytes: result.totalBytes,
      savedBytes: result.savedBytes,
      dryRun: false,
      pending: remainingPending.length > 0 ? remainingPending.length : 0,
    };

    const validated = MailExtractAttachmentsOutputSchema.parse(output);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(validated, null, 2),
        },
      ],
    };
  },
};

export type MailExtractAttachmentsInput = z.infer<typeof MailExtractAttachmentsInputSchema>;
export type MailExtractAttachmentsOutput = z.infer<typeof MailExtractAttachmentsOutputSchema>;
