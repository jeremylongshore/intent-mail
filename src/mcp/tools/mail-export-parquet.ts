/**
 * Mail Export Parquet Tool
 *
 * Export email data to Parquet format for data science tools.
 */

import { z } from 'zod';
import {
  initDuckDB,
  exportEmailsToParquet,
  exportAttachmentsToParquet,
  listExports,
} from '../../analytics/index.js';
import { syncAllEmails } from '../../analytics/sync-to-duckdb.js';

/**
 * Input schema for mail_export_parquet
 */
const MailExportParquetInputSchema = z.object({
  type: z.enum(['emails', 'attachments', 'both']).default('emails').describe('What to export'),
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  syncFirst: z.boolean().default(true).describe('Sync SQLite to DuckDB before export'),
  outputDir: z.string().optional().describe('Custom output directory'),
});

/**
 * Output schema for mail_export_parquet
 */
const MailExportParquetOutputSchema = z.object({
  exports: z.array(z.object({
    type: z.string(),
    success: z.boolean(),
    filePath: z.string(),
    rowCount: z.number(),
    sizeHuman: z.string(),
    duration: z.number(),
    error: z.string().optional(),
  })),
  existingExports: z.array(z.object({
    filename: z.string(),
    path: z.string(),
    sizeHuman: z.string(),
    createdAt: z.string(),
  })),
  usage: z.object({
    pandas: z.string(),
    polars: z.string(),
    duckdb: z.string(),
  }),
});

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Mail export parquet tool definition and handler
 */
export const mailExportParquetTool = {
  definition: {
    name: 'mail_export_parquet',
    description: `Export email data to Parquet format.

Parquet is the standard format for data science and analytics tools:
- pandas: df = pd.read_parquet('emails.parquet')
- polars: df = pl.read_parquet('emails.parquet')
- DuckDB: SELECT * FROM 'emails.parquet'
- BigQuery: Load directly as external table
- Spark: spark.read.parquet('emails.parquet')

Exports are compressed with zstd for optimal size/speed.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['emails', 'attachments', 'both'],
          description: 'What to export (default: emails)',
          default: 'emails',
        },
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        syncFirst: {
          type: 'boolean',
          description: 'Sync SQLite to DuckDB before export (default true)',
          default: true,
        },
        outputDir: {
          type: 'string',
          description: 'Custom output directory',
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailExportParquetInputSchema.parse(args);

    // Initialize DuckDB
    initDuckDB();

    // Sync if requested
    if (input.syncFirst) {
      await syncAllEmails(input.accountId);
    }

    const exports: Array<{
      type: string;
      success: boolean;
      filePath: string;
      rowCount: number;
      sizeHuman: string;
      duration: number;
      error?: string;
    }> = [];

    // Export emails
    if (input.type === 'emails' || input.type === 'both') {
      const result = await exportEmailsToParquet(
        input.outputDir ? `${input.outputDir}/emails.parquet` : undefined,
        input.accountId
      );
      exports.push({
        type: 'emails',
        success: result.success,
        filePath: result.filePath,
        rowCount: result.rowCount,
        sizeHuman: formatBytes(result.sizeBytes),
        duration: result.duration,
        error: result.error,
      });
    }

    // Export attachments
    if (input.type === 'attachments' || input.type === 'both') {
      const result = await exportAttachmentsToParquet(
        input.outputDir ? `${input.outputDir}/attachments.parquet` : undefined,
        input.accountId
      );
      exports.push({
        type: 'attachments',
        success: result.success,
        filePath: result.filePath,
        rowCount: result.rowCount,
        sizeHuman: formatBytes(result.sizeBytes),
        duration: result.duration,
        error: result.error,
      });
    }

    // List existing exports
    const existingExports = listExports(input.outputDir).map((e) => ({
      filename: e.filename,
      path: e.path,
      sizeHuman: formatBytes(e.sizeBytes),
      createdAt: e.createdAt,
    }));

    // Get file path for usage examples
    const emailsPath = exports.find((e) => e.type === 'emails')?.filePath || 'emails.parquet';

    const output = {
      exports,
      existingExports,
      usage: {
        pandas: `import pandas as pd\ndf = pd.read_parquet('${emailsPath}')`,
        polars: `import polars as pl\ndf = pl.read_parquet('${emailsPath}')`,
        duckdb: `SELECT * FROM '${emailsPath}' LIMIT 10`,
      },
    };

    const validated = MailExportParquetOutputSchema.parse(output);

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

export type MailExportParquetInput = z.infer<typeof MailExportParquetInputSchema>;
export type MailExportParquetOutput = z.infer<typeof MailExportParquetOutputSchema>;
