/**
 * Mail List Folders Tool
 *
 * List the destination folders/labels available for an account, so callers
 * (and mail_move) know valid destinations. Provider-routed:
 *  - Outlook: GET /me/mailFolders
 *  - Gmail:   labels are the folder analog (GET users.labels.list)
 */

import { z } from 'zod';
import { getProviderClientForAccount } from '../../connectors/provider-client.js';

const MailListFoldersInputSchema = z.object({
  accountId: z.number().int().positive().describe('Account ID to list folders/labels for'),
});

const FolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['folder', 'label']),
  unreadCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
});

const MailListFoldersOutputSchema = z.object({
  accountId: z.number().int().positive(),
  provider: z.string(),
  folders: z.array(FolderSchema),
});

export const mailListFoldersTool = {
  definition: {
    name: 'mail_list_folders',
    description:
      'List the folders (Outlook) or labels (Gmail) available for an account. Use the returned ids/names as the destination for mail_move.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: { type: 'number', description: 'Account ID to list folders/labels for' },
      },
      required: ['accountId'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailListFoldersInputSchema.parse(args);
    const client = await getProviderClientForAccount(input.accountId);

    let folders: z.infer<typeof FolderSchema>[];

    if (client.provider === 'outlook') {
      const graphFolders = await client.outlook!.listFolders();
      folders = graphFolders.map((f) => ({
        id: f.id,
        name: f.displayName,
        kind: 'folder' as const,
        unreadCount: f.unreadItemCount,
        totalCount: f.totalItemCount,
      }));
    } else {
      const labels = await client.gmail!.listLabels();
      folders = labels.map((l) => ({
        id: l.id,
        name: l.name,
        kind: 'label' as const,
      }));
    }

    const output = {
      accountId: input.accountId,
      provider: client.provider,
      folders,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(MailListFoldersOutputSchema.parse(output), null, 2),
        },
      ],
    };
  },
};

export type MailListFoldersInput = z.infer<typeof MailListFoldersInputSchema>;
export type MailListFoldersOutput = z.infer<typeof MailListFoldersOutputSchema>;
