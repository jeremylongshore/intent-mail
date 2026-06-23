/**
 * Mail List Contexts Tool
 *
 * Lists the project/client context handles defined in context/contexts.json so
 * callers (and the web @-mention autocomplete) can discover what
 * @project:/@client: handles are available to inject into drafts and triage.
 */

import { z } from 'zod';
import { loadContexts, listContextHandles } from '../../ai/context-store.js';

const MailListContextsInputSchema = z.object({});

export const mailListContextsTool = {
  definition: {
    name: 'mail_list_contexts',
    description:
      'List available project/client context handles (from context/contexts.json). Use the returned handles as @project:<handle> / @client:<handle> in mail_draft to inject that context.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  handler: async (args: unknown) => {
    MailListContextsInputSchema.parse(args ?? {});
    const store = loadContexts();
    const handles = listContextHandles(store);

    const output = {
      count: handles.length,
      handles: handles.map((h) => ({
        mention: `@${h.kind}:${h.handle}`,
        kind: h.kind,
        handle: h.handle,
        description: (h.kind === 'project' ? store.projects : store.clients)[h.handle],
      })),
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    };
  },
};
