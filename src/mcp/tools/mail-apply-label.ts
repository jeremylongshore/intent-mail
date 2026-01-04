/**
 * Mail Apply Label Tool
 *
 * Apply or remove labels from emails.
 */

import { z } from 'zod';
import { addLabels, removeLabels, getEmailById } from '../../storage/services/email-storage.js';

/**
 * Input schema for mail_apply_label
 */
const MailApplyLabelInputSchema = z.object({
  emailId: z.number().int().positive().describe('Email ID to modify'),
  addLabels: z.array(z.string()).optional().describe('Labels to add'),
  removeLabels: z.array(z.string()).optional().describe('Labels to remove'),
}).refine(
  (data) => (data.addLabels && data.addLabels.length > 0) || (data.removeLabels && data.removeLabels.length > 0),
  {
    message: 'Must specify at least one label to add or remove',
  }
);

/**
 * Output schema for mail_apply_label
 */
const MailApplyLabelOutputSchema = z.object({
  emailId: z.number().int().positive(),
  labels: z.array(z.string()),
  labelsAdded: z.array(z.string()),
  labelsRemoved: z.array(z.string()),
  success: z.boolean(),
});

/**
 * Mail apply label tool definition and handler
 */
export const mailApplyLabelTool = {
  definition: {
    name: 'mail_apply_label',
    description:
      'Apply or remove labels from an email. Labels are used for categorization (e.g., "Work", "Personal", "Important").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailId: {
          type: 'number',
          description: 'Email ID to modify',
        },
        addLabels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Labels to add (e.g., ["Work", "Important"])',
        },
        removeLabels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Labels to remove',
        },
      },
      required: ['emailId'],
    },
  },

  handler: async (args: unknown) => {
    // Validate input
    const input = MailApplyLabelInputSchema.parse(args);

    // Get current email state
    const email = await getEmailById(input.emailId);
    if (!email) {
      throw new Error(`Email with ID ${input.emailId} not found`);
    }

    const currentLabels = new Set(email.labels);
    const labelsAdded: string[] = [];
    const labelsRemoved: string[] = [];

    // Add labels
    if (input.addLabels && input.addLabels.length > 0) {
      await addLabels(input.emailId, input.addLabels);
      for (const label of input.addLabels) {
        if (!currentLabels.has(label)) {
          labelsAdded.push(label);
          currentLabels.add(label);
        }
      }
    }

    // Remove labels
    if (input.removeLabels && input.removeLabels.length > 0) {
      for (const label of input.removeLabels) {
        if (currentLabels.has(label)) {
          labelsRemoved.push(label);
          currentLabels.delete(label);
        }
      }

      if (labelsRemoved.length > 0) {
        await removeLabels(input.emailId, labelsRemoved);
      }
    }

    // Get updated email
    const updatedEmail = await getEmailById(input.emailId);

    // Build output
    const output = {
      emailId: input.emailId,
      labels: updatedEmail?.labels || Array.from(currentLabels),
      labelsAdded,
      labelsRemoved,
      success: true,
    };

    // Validate output
    const validated = MailApplyLabelOutputSchema.parse(output);

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

export type MailApplyLabelInput = z.infer<typeof MailApplyLabelInputSchema>;
export type MailApplyLabelOutput = z.infer<typeof MailApplyLabelOutputSchema>;
