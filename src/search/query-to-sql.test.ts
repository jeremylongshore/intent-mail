/**
 * Gmail Query to SQL Conversion Tests
 *
 * Tests for converting parsed Gmail-style queries to SQL.
 */

import { describe, it, expect } from 'vitest';
import { parseQuery } from './query-parser.js';
import { astToSql, SqlConversion } from './query-to-sql.js';

function querySql(query: string): SqlConversion {
  const result = parseQuery(query);
  if (!result.success || !result.ast) {
    throw new Error(`Parse failed: ${result.errors.map((e) => e.message).join(', ')}`);
  }
  return astToSql(result.ast);
}

describe('astToSql - basic text search', () => {
  it('converts single word to FTS', () => {
    const sql = querySql('hello');
    expect(sql.useFts).toBe(true);
    expect(sql.ftsQuery).toBe('hello');
    expect(sql.whereClause).toContain('emails_fts MATCH');
  });

  it('converts multiple words to FTS with AND', () => {
    const sql = querySql('hello world');
    expect(sql.useFts).toBe(true);
    expect(sql.ftsQuery).toBe('hello world');
  });

  it('converts quoted phrase to FTS phrase search', () => {
    const sql = querySql('"hello world"');
    expect(sql.useFts).toBe(true);
    expect(sql.ftsQuery).toBe('"hello world"');
  });

  it('converts negated word to FTS NOT', () => {
    const sql = querySql('-spam');
    expect(sql.useFts).toBe(true);
    expect(sql.ftsQuery).toBe('NOT spam');
  });
});

describe('astToSql - field operators', () => {
  it('converts from: to LIKE query', () => {
    const sql = querySql('from:user@example.com');
    expect(sql.whereClause).toContain('e.from_address');
    expect(sql.whereClause).toContain('LIKE');
    expect(sql.params).toContain('%user@example.com%');
  });

  it('converts to: to LIKE query', () => {
    const sql = querySql('to:team@company.com');
    expect(sql.whereClause).toContain('e.to_addresses');
    expect(sql.whereClause).toContain('LIKE');
    expect(sql.params).toContain('%team@company.com%');
  });

  it('converts subject: to LIKE query', () => {
    const sql = querySql('subject:meeting');
    expect(sql.whereClause).toContain('e.subject');
    expect(sql.whereClause).toContain('LIKE');
    expect(sql.params).toContain('%meeting%');
  });

  it('converts label: to labels LIKE query', () => {
    const sql = querySql('label:important');
    expect(sql.whereClause).toContain('e.labels');
    expect(sql.whereClause).toContain('LIKE');
    expect(sql.params).toContain('%important%');
  });

  it('converts negated from: to NOT LIKE', () => {
    const sql = querySql('-from:newsletter@spam.com');
    expect(sql.whereClause).toContain('NOT LIKE');
  });

  it('converts filename: to attachments subquery', () => {
    const sql = querySql('filename:report.pdf');
    expect(sql.whereClause).toContain('attachments');
    expect(sql.whereClause).toContain('a.filename');
    expect(sql.params).toContain('%report.pdf%');
  });

  it('converts in: to labels query', () => {
    const sql = querySql('in:inbox');
    expect(sql.whereClause).toContain('e.labels');
    expect(sql.params).toContain('%INBOX%');
  });
});

describe('astToSql - has: operator', () => {
  it('converts has:attachment', () => {
    const sql = querySql('has:attachment');
    expect(sql.whereClause).toBe('e.has_attachments = 1');
    expect(sql.useFts).toBe(false);
  });

  it('converts -has:attachment', () => {
    const sql = querySql('-has:attachment');
    expect(sql.whereClause).toBe('e.has_attachments = 0');
  });

  it('converts has:document to MIME type check', () => {
    const sql = querySql('has:document');
    expect(sql.whereClause).toContain('attachments');
    expect(sql.whereClause).toContain('a.mime_type');
  });

  it('converts has:youtube to body check', () => {
    const sql = querySql('has:youtube');
    expect(sql.whereClause).toContain('e.body_text');
    // youtube.com is in params, not in the SQL template
    expect(sql.params).toContain('%youtube.com%');
    expect(sql.params).toContain('%youtu.be%');
  });
});

describe('astToSql - is: operator', () => {
  it('converts is:read to SEEN flag check', () => {
    const sql = querySql('is:read');
    expect(sql.whereClause).toContain('e.flags');
    expect(sql.whereClause).toContain('SEEN');
  });

  it('converts is:unread to NOT SEEN flag check', () => {
    const sql = querySql('is:unread');
    expect(sql.whereClause).toContain('NOT');
    expect(sql.whereClause).toContain('SEEN');
  });

  it('converts is:starred to FLAGGED flag check', () => {
    const sql = querySql('is:starred');
    expect(sql.whereClause).toContain('FLAGGED');
  });

  it('converts is:important to IMPORTANT label check', () => {
    const sql = querySql('is:important');
    expect(sql.whereClause).toContain('IMPORTANT');
  });
});

describe('astToSql - size operators', () => {
  it('converts larger: to size comparison', () => {
    const sql = querySql('larger:5M');
    expect(sql.whereClause).toBe('e.size_bytes > ?');
    expect(sql.params).toContain(5 * 1024 * 1024);
  });

  it('converts smaller: to size comparison', () => {
    const sql = querySql('smaller:10K');
    expect(sql.whereClause).toBe('e.size_bytes < ?');
    expect(sql.params).toContain(10 * 1024);
  });
});

describe('astToSql - date operators', () => {
  it('converts before: to date comparison', () => {
    const sql = querySql('before:2025-01-01');
    expect(sql.whereClause).toContain('date(e.date) < date(?)');
    expect(sql.params).toContain('2025-01-01');
  });

  it('converts after: to date comparison', () => {
    const sql = querySql('after:2024-06-01');
    expect(sql.whereClause).toContain('date(e.date) > date(?)');
    expect(sql.params).toContain('2024-06-01');
  });

  it('converts older_than: to date comparison', () => {
    const sql = querySql('older_than:7d');
    expect(sql.whereClause).toContain('date(e.date) < date(?)');
    expect(sql.params.length).toBe(1);
    expect(sql.params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('converts newer_than: to date comparison', () => {
    const sql = querySql('newer_than:1m');
    expect(sql.whereClause).toContain('date(e.date) > date(?)');
  });
});

describe('astToSql - OR expressions', () => {
  it('converts OR to SQL OR', () => {
    const sql = querySql('from:alice OR from:bob');
    expect(sql.whereClause).toContain(' OR ');
  });

  it('wraps OR in parentheses', () => {
    const sql = querySql('from:alice OR from:bob');
    expect(sql.whereClause).toMatch(/\(.*OR.*\)/);
  });
});

describe('astToSql - complex queries', () => {
  it('combines multiple conditions with AND', () => {
    const sql = querySql('from:boss has:attachment larger:1M');
    expect(sql.whereClause).toContain(' AND ');
    expect(sql.params.length).toBeGreaterThanOrEqual(2);
  });

  it('handles mixed FTS and non-FTS', () => {
    const sql = querySql('from:boss urgent meeting');
    expect(sql.useFts).toBe(true);
    expect(sql.whereClause).toContain('from_address');
    expect(sql.whereClause).toContain('emails_fts');
  });

  it('handles real-world query', () => {
    const sql = querySql('from:newsletter@company.com has:attachment larger:5M after:2024-01-01');
    expect(sql.whereClause).toContain('from_address');
    expect(sql.whereClause).toContain('has_attachments');
    expect(sql.whereClause).toContain('size_bytes');
    expect(sql.whereClause).toContain('date(e.date)');
    // from: adds 2 params (for from_address and from_name), larger: adds 1, after: adds 1 = 4
    // has:attachment adds no params
    expect(sql.params.length).toBe(4);
  });

  it('produces valid SQL with no conditions for empty query', () => {
    const sql = querySql('');
    expect(sql.whereClause).toBe('');
    expect(sql.params).toHaveLength(0);
    expect(sql.useFts).toBe(false);
  });
});

describe('astToSql - parameter ordering', () => {
  it('maintains parameter order matching placeholders', () => {
    const sql = querySql('from:alice to:bob subject:meeting');
    // Params should be in order of conditions
    // from: generates 2 params (for from_address and from_name)
    expect(sql.params[0]).toBe('%alice%');
    expect(sql.params[1]).toBe('%alice%'); // Duplicate for from_name
    expect(sql.params[2]).toBe('%bob%');
    expect(sql.params[3]).toBe('%meeting%');
  });
});
