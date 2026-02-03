/**
 * Gmail Query AST to SQL Conversion
 *
 * Converts parsed Gmail-style query AST into SQLite-compatible SQL
 * WHERE clauses and parameters for the emails table.
 */

import {
  QueryAST,
  QueryCondition,
  FieldCondition,
  HasCondition,
  IsCondition,
  SizeCondition,
  DateCondition,
  RelativeDateCondition,
  TextTerm,
  OrGroup,
  ParenGroup,
} from './query-ast.js';
import { EmailFlag } from '../types/email.js';

/**
 * Result of converting AST to SQL
 */
export interface SqlConversion {
  whereClause: string;
  params: unknown[];
  useFts: boolean;
  ftsQuery?: string;
}

/**
 * Map Gmail 'is' states to our flag/condition
 */
const IS_STATE_MAP: Record<string, { flag?: EmailFlag; condition?: string }> = {
  read: { flag: EmailFlag.SEEN },
  unread: { flag: EmailFlag.SEEN }, // Negated check
  starred: { flag: EmailFlag.FLAGGED },
  important: { condition: "e.labels LIKE '%IMPORTANT%'" },
  snoozed: { condition: "e.labels LIKE '%SNOOZED%'" },
  muted: { condition: "e.labels LIKE '%MUTED%'" },
};

/**
 * Map Gmail 'in' folder names to labels
 */
const IN_FOLDER_MAP: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
  drafts: 'DRAFT',
  trash: 'TRASH',
  spam: 'SPAM',
  starred: 'STARRED',
  important: 'IMPORTANT',
  anywhere: '', // Special: matches all
};

/**
 * Context for building SQL
 */
interface BuildContext {
  conditions: string[];
  params: unknown[];
  ftsTerms: string[];
}

/**
 * Escape FTS5 special characters
 */
function escapeFts(value: string): string {
  // FTS5 special chars that need escaping
  return value.replace(/['"(){}[\]:^*\\]/g, '\\$&');
}

/**
 * Build SQL for a single condition
 */
function buildConditionSql(
  condition: QueryCondition,
  ctx: BuildContext
): string {
  switch (condition.type) {
    case 'field':
      return buildFieldCondition(condition, ctx);

    case 'has':
      return buildHasCondition(condition, ctx);

    case 'is':
      return buildIsCondition(condition, ctx);

    case 'size':
      return buildSizeCondition(condition, ctx);

    case 'date':
      return buildDateCondition(condition, ctx);

    case 'relative_date':
      return buildRelativeDateCondition(condition, ctx);

    case 'text':
      return buildTextCondition(condition, ctx);

    case 'or':
      return buildOrCondition(condition, ctx);

    case 'group':
      return buildGroupCondition(condition, ctx);

    default:
      return '1=1'; // Fallback: always true
  }
}

/**
 * Build field condition (from:, to:, subject:, etc.)
 */
function buildFieldCondition(
  condition: FieldCondition,
  ctx: BuildContext
): string {
  const { field, value, negated } = condition;
  const op = negated ? 'NOT LIKE' : 'LIKE';

  switch (field) {
    case 'from':
      ctx.params.push(`%${value}%`, `%${value}%`);
      return `(e.from_address ${op} ? OR e.from_name ${op} ?)`;

    case 'to':
      ctx.params.push(`%${value}%`);
      return `e.to_addresses ${op} ?`;

    case 'cc':
      ctx.params.push(`%${value}%`);
      return `e.cc_addresses ${op} ?`;

    case 'bcc':
      ctx.params.push(`%${value}%`);
      return `e.bcc_addresses ${op} ?`;

    case 'subject':
      ctx.params.push(`%${value}%`);
      return `e.subject ${op} ?`;

    case 'label':
      ctx.params.push(`%${value}%`);
      return `e.labels ${op} ?`;

    case 'filename':
      // Join with attachments table
      ctx.params.push(`%${value}%`);
      return `e.id ${negated ? 'NOT ' : ''}IN (
        SELECT a.email_id FROM attachments a WHERE a.filename LIKE ?
      )`;

    case 'in':
      const labelValue = IN_FOLDER_MAP[value.toLowerCase()] || value.toUpperCase();
      if (labelValue === '') {
        // 'in:anywhere' matches all
        return '1=1';
      }
      ctx.params.push(`%${labelValue}%`);
      return `e.labels ${op} ?`;

    default:
      return '1=1';
  }
}

/**
 * Build has: condition
 */
function buildHasCondition(condition: HasCondition, ctx: BuildContext): string {
  const { what, negated } = condition;

  switch (what) {
    case 'attachment':
      return negated ? 'e.has_attachments = 0' : 'e.has_attachments = 1';

    case 'drive':
    case 'document':
    case 'spreadsheet':
    case 'presentation':
      // These map to specific attachment types or body content
      const mimeTypes: Record<string, string[]> = {
        drive: ['application/vnd.google-apps.'],
        document: ['application/vnd.google-apps.document', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml'],
        spreadsheet: ['application/vnd.google-apps.spreadsheet', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml'],
        presentation: ['application/vnd.google-apps.presentation', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml'],
      };
      const types = mimeTypes[what] || [];
      if (types.length === 0) return '1=1';

      const typeConditions = types.map(() => 'a.mime_type LIKE ?').join(' OR ');
      types.forEach((t) => ctx.params.push(`%${t}%`));

      return `e.id ${negated ? 'NOT ' : ''}IN (
        SELECT a.email_id FROM attachments a WHERE ${typeConditions}
      )`;

    case 'youtube':
      ctx.params.push('%youtube.com%', '%youtu.be%');
      return `(e.body_text ${negated ? 'NOT ' : ''}LIKE ? OR e.body_text ${negated ? 'NOT ' : ''}LIKE ?)`;

    default:
      return '1=1';
  }
}

/**
 * Build is: condition
 */
function buildIsCondition(condition: IsCondition, _ctx: BuildContext): string {
  const { state, negated } = condition;
  const mapping = IS_STATE_MAP[state];

  if (!mapping) return '1=1';

  if (mapping.flag) {
    const flagCheck = `e.flags LIKE '%${mapping.flag}%'`;
    // For 'unread', we negate the SEEN flag check
    if (state === 'unread') {
      return negated ? flagCheck : `NOT (${flagCheck})`;
    }
    return negated ? `NOT (${flagCheck})` : flagCheck;
  }

  if (mapping.condition) {
    return negated ? `NOT (${mapping.condition})` : mapping.condition;
  }

  return '1=1';
}

/**
 * Build size condition
 */
function buildSizeCondition(condition: SizeCondition, ctx: BuildContext): string {
  const { operator, bytes } = condition;
  ctx.params.push(bytes);

  if (operator === 'larger') {
    return 'e.size_bytes > ?';
  } else {
    return 'e.size_bytes < ?';
  }
}

/**
 * Build date condition (before:/after:)
 */
function buildDateCondition(condition: DateCondition, ctx: BuildContext): string {
  const { operator, date } = condition;
  ctx.params.push(date);

  if (operator === 'before') {
    return 'date(e.date) < date(?)';
  } else {
    return 'date(e.date) > date(?)';
  }
}

/**
 * Build relative date condition (older_than:/newer_than:)
 */
function buildRelativeDateCondition(
  condition: RelativeDateCondition,
  ctx: BuildContext
): string {
  const { operator, date } = condition;
  ctx.params.push(date);

  if (operator === 'older_than') {
    return 'date(e.date) < date(?)';
  } else {
    return 'date(e.date) > date(?)';
  }
}

/**
 * Build text search condition
 */
function buildTextCondition(condition: TextTerm, ctx: BuildContext): string {
  const { value, exact, negated } = condition;

  if (exact) {
    // Exact phrase: use FTS5 phrase search
    const ftsPhrase = `"${escapeFts(value)}"`;
    if (negated) {
      ctx.ftsTerms.push(`NOT ${ftsPhrase}`);
    } else {
      ctx.ftsTerms.push(ftsPhrase);
    }
  } else {
    // Plain term
    const ftsTerm = escapeFts(value);
    if (negated) {
      ctx.ftsTerms.push(`NOT ${ftsTerm}`);
    } else {
      ctx.ftsTerms.push(ftsTerm);
    }
  }

  // Return placeholder - actual FTS will be handled separately
  return '__FTS_PLACEHOLDER__';
}

/**
 * Build OR group condition
 */
function buildOrCondition(condition: OrGroup, ctx: BuildContext): string {
  const parts = condition.conditions
    .map((c) => buildConditionSql(c, ctx))
    .filter((p) => p !== '1=1' && p !== '__FTS_PLACEHOLDER__');

  if (parts.length === 0) return '1=1';
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' OR ')})`;
}

/**
 * Build parenthesized group condition
 */
function buildGroupCondition(condition: ParenGroup, ctx: BuildContext): string {
  const parts = condition.conditions
    .map((c) => buildConditionSql(c, ctx))
    .filter((p) => p !== '1=1' && p !== '__FTS_PLACEHOLDER__');

  if (parts.length === 0) return '1=1';

  const grouped = parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`;
  return condition.negated ? `NOT (${grouped})` : grouped;
}

/**
 * Convert QueryAST to SQL WHERE clause and parameters
 */
export function astToSql(ast: QueryAST): SqlConversion {
  const ctx: BuildContext = {
    conditions: [],
    params: [],
    ftsTerms: [],
  };

  // Build conditions for each AST node
  for (const condition of ast.conditions) {
    const sql = buildConditionSql(condition, ctx);
    if (sql !== '1=1' && sql !== '__FTS_PLACEHOLDER__') {
      ctx.conditions.push(sql);
    }
  }

  // Build FTS query if we have text terms
  let ftsQuery: string | undefined;
  if (ctx.ftsTerms.length > 0) {
    ftsQuery = ctx.ftsTerms.join(' ');
    ctx.conditions.push(`e.id IN (
      SELECT rowid FROM emails_fts WHERE emails_fts MATCH ?
    )`);
    ctx.params.push(ftsQuery);
  }

  // Build final WHERE clause
  let whereClause = '';
  if (ctx.conditions.length > 0) {
    whereClause = ctx.conditions.join(' AND ');
  }

  return {
    whereClause,
    params: ctx.params,
    useFts: ctx.ftsTerms.length > 0,
    ftsQuery,
  };
}

/**
 * Convenience function: parse query and convert to SQL in one step
 * Note: This is async due to dynamic import to avoid circular dependencies.
 * For synchronous usage, import parseQuery directly from query-parser.js
 */
export async function queryToSql(query: string): Promise<SqlConversion | null> {
  // Dynamic import to avoid circular dependency between parser and SQL converter
  const { parseQuery } = await import('./query-parser.js');
  const result = parseQuery(query);

  if (!result.success || !result.ast) {
    return null;
  }

  return astToSql(result.ast);
}
