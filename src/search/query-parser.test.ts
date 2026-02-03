/**
 * Gmail Query Parser Tests
 *
 * Comprehensive tests for parsing Gmail-style search queries.
 */

import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  parseSize,
  parseRelativeDate,
  parseAbsoluteDate,
  validateQuery,
} from './query-parser.js';
import type {
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

describe('parseSize', () => {
  it('parses plain bytes', () => {
    expect(parseSize('1024')).toBe(1024);
    expect(parseSize('0')).toBe(0);
    expect(parseSize('500')).toBe(500);
  });

  it('parses kilobytes', () => {
    expect(parseSize('1K')).toBe(1024);
    expect(parseSize('1k')).toBe(1024);
    expect(parseSize('5K')).toBe(5 * 1024);
    expect(parseSize('2KB')).toBe(2 * 1024);
    expect(parseSize('2kb')).toBe(2 * 1024);
  });

  it('parses megabytes', () => {
    expect(parseSize('1M')).toBe(1024 * 1024);
    expect(parseSize('5M')).toBe(5 * 1024 * 1024);
    expect(parseSize('10MB')).toBe(10 * 1024 * 1024);
    expect(parseSize('2.5M')).toBe(Math.floor(2.5 * 1024 * 1024));
  });

  it('parses gigabytes', () => {
    expect(parseSize('1G')).toBe(1024 * 1024 * 1024);
    expect(parseSize('2GB')).toBe(2 * 1024 * 1024 * 1024);
  });

  it('returns null for invalid sizes', () => {
    expect(parseSize('abc')).toBeNull();
    expect(parseSize('')).toBeNull();
    expect(parseSize('M5')).toBeNull();
  });
});

describe('parseRelativeDate', () => {
  it('parses days', () => {
    const result = parseRelativeDate('7d');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify result is a valid date in the past
    const parsed = new Date(result!);
    const now = new Date();
    expect(parsed.getTime()).toBeLessThan(now.getTime());
  });

  it('parses weeks', () => {
    const result = parseRelativeDate('2w');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const parsed = new Date(result!);
    const now = new Date();
    expect(parsed.getTime()).toBeLessThan(now.getTime());
  });

  it('parses months', () => {
    const result = parseRelativeDate('1m');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const parsed = new Date(result!);
    const now = new Date();
    expect(parsed.getTime()).toBeLessThan(now.getTime());
  });

  it('parses years', () => {
    const result = parseRelativeDate('1y');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const parsed = new Date(result!);
    const now = new Date();
    expect(parsed.getTime()).toBeLessThan(now.getTime());
  });

  it('returns null for invalid dates', () => {
    expect(parseRelativeDate('abc')).toBeNull();
    expect(parseRelativeDate('7')).toBeNull();
    expect(parseRelativeDate('d7')).toBeNull();
  });
});

describe('parseAbsoluteDate', () => {
  it('parses ISO format', () => {
    expect(parseAbsoluteDate('2025-01-15')).toBe('2025-01-15');
    expect(parseAbsoluteDate('2024-12-31')).toBe('2024-12-31');
  });

  it('parses US format', () => {
    expect(parseAbsoluteDate('01/15/2025')).toBe('2025-01-15');
    expect(parseAbsoluteDate('1/5/2025')).toBe('2025-01-05');
    expect(parseAbsoluteDate('12/31/2024')).toBe('2024-12-31');
  });

  it('parses month name formats', () => {
    expect(parseAbsoluteDate('Jan 15 2025')).toBe('2025-01-15');
    expect(parseAbsoluteDate('January 15 2025')).toBe('2025-01-15');
    expect(parseAbsoluteDate('Dec 31, 2024')).toBe('2024-12-31');
  });

  it('returns null for invalid dates', () => {
    expect(parseAbsoluteDate('not a date')).toBeNull();
    expect(parseAbsoluteDate('')).toBeNull();
    expect(parseAbsoluteDate('2025')).toBeNull();
  });
});

describe('parseQuery - empty and basic', () => {
  it('handles empty query', () => {
    const result = parseQuery('');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(0);
  });

  it('handles whitespace only', () => {
    const result = parseQuery('   ');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(0);
  });

  it('parses single word', () => {
    const result = parseQuery('hello');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(1);

    const term = result.ast?.conditions[0] as TextTerm;
    expect(term.type).toBe('text');
    expect(term.value).toBe('hello');
    expect(term.exact).toBe(false);
    expect(term.negated).toBe(false);
  });

  it('parses multiple words as separate terms', () => {
    const result = parseQuery('hello world');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(2);

    const term1 = result.ast?.conditions[0] as TextTerm;
    expect(term1.value).toBe('hello');

    const term2 = result.ast?.conditions[1] as TextTerm;
    expect(term2.value).toBe('world');
  });
});

describe('parseQuery - quoted phrases', () => {
  it('parses quoted phrase', () => {
    const result = parseQuery('"hello world"');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(1);

    const term = result.ast?.conditions[0] as TextTerm;
    expect(term.type).toBe('text');
    expect(term.value).toBe('hello world');
    expect(term.exact).toBe(true);
  });

  it('handles escaped quotes in phrase', () => {
    const result = parseQuery('"say \\"hello\\""');
    expect(result.success).toBe(true);

    const term = result.ast?.conditions[0] as TextTerm;
    expect(term.value).toBe('say "hello"');
  });
});

describe('parseQuery - field operators', () => {
  it('parses from:', () => {
    const result = parseQuery('from:user@example.com');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(1);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.type).toBe('field');
    expect(cond.field).toBe('from');
    expect(cond.value).toBe('user@example.com');
    expect(cond.negated).toBe(false);
  });

  it('parses to:', () => {
    const result = parseQuery('to:team@company.com');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('to');
    expect(cond.value).toBe('team@company.com');
  });

  it('parses subject:', () => {
    const result = parseQuery('subject:meeting');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('subject');
    expect(cond.value).toBe('meeting');
  });

  it('parses subject with quoted value', () => {
    const result = parseQuery('subject:"weekly meeting"');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('subject');
    expect(cond.value).toBe('weekly meeting');
  });

  it('parses label:', () => {
    const result = parseQuery('label:important');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('label');
    expect(cond.value).toBe('important');
  });

  it('parses filename:', () => {
    const result = parseQuery('filename:report.pdf');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('filename');
    expect(cond.value).toBe('report.pdf');
  });

  it('parses in:', () => {
    const result = parseQuery('in:inbox');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('in');
    expect(cond.value).toBe('inbox');
  });
});

describe('parseQuery - has: operator', () => {
  it('parses has:attachment', () => {
    const result = parseQuery('has:attachment');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as HasCondition;
    expect(cond.type).toBe('has');
    expect(cond.what).toBe('attachment');
    expect(cond.negated).toBe(false);
  });

  it('parses has:drive', () => {
    const result = parseQuery('has:drive');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as HasCondition;
    expect(cond.what).toBe('drive');
  });

  it('reports error for invalid has value', () => {
    const result = parseQuery('has:invalid');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid has:');
  });
});

describe('parseQuery - is: operator', () => {
  it('parses is:read', () => {
    const result = parseQuery('is:read');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as IsCondition;
    expect(cond.type).toBe('is');
    expect(cond.state).toBe('read');
    expect(cond.negated).toBe(false);
  });

  it('parses is:unread', () => {
    const result = parseQuery('is:unread');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as IsCondition;
    expect(cond.state).toBe('unread');
  });

  it('parses is:starred', () => {
    const result = parseQuery('is:starred');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as IsCondition;
    expect(cond.state).toBe('starred');
  });

  it('reports error for invalid is value', () => {
    const result = parseQuery('is:invalid');
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid is:');
  });
});

describe('parseQuery - size operators', () => {
  it('parses larger:', () => {
    const result = parseQuery('larger:5M');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as SizeCondition;
    expect(cond.type).toBe('size');
    expect(cond.operator).toBe('larger');
    expect(cond.bytes).toBe(5 * 1024 * 1024);
  });

  it('parses smaller:', () => {
    const result = parseQuery('smaller:10K');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as SizeCondition;
    expect(cond.operator).toBe('smaller');
    expect(cond.bytes).toBe(10 * 1024);
  });

  it('reports error for invalid size', () => {
    const result = parseQuery('larger:abc');
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('Invalid size');
  });
});

describe('parseQuery - date operators', () => {
  it('parses before:', () => {
    const result = parseQuery('before:2025-01-01');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as DateCondition;
    expect(cond.type).toBe('date');
    expect(cond.operator).toBe('before');
    expect(cond.date).toBe('2025-01-01');
  });

  it('parses after:', () => {
    const result = parseQuery('after:2024-06-01');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as DateCondition;
    expect(cond.operator).toBe('after');
    expect(cond.date).toBe('2024-06-01');
  });

  it('parses older_than:', () => {
    const result = parseQuery('older_than:7d');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as RelativeDateCondition;
    expect(cond.type).toBe('relative_date');
    expect(cond.operator).toBe('older_than');
    expect(cond.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses newer_than:', () => {
    const result = parseQuery('newer_than:1m');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as RelativeDateCondition;
    expect(cond.operator).toBe('newer_than');
  });
});

describe('parseQuery - negation', () => {
  it('negates word with minus', () => {
    const result = parseQuery('-spam');
    expect(result.success).toBe(true);

    const term = result.ast?.conditions[0] as TextTerm;
    expect(term.value).toBe('spam');
    expect(term.negated).toBe(true);
  });

  it('negates field with minus', () => {
    const result = parseQuery('-from:newsletter@company.com');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as FieldCondition;
    expect(cond.field).toBe('from');
    expect(cond.negated).toBe(true);
  });

  it('negates has:', () => {
    const result = parseQuery('-has:attachment');
    expect(result.success).toBe(true);

    const cond = result.ast?.conditions[0] as HasCondition;
    expect(cond.negated).toBe(true);
  });

  it('negates quoted phrase', () => {
    const result = parseQuery('-"spam message"');
    expect(result.success).toBe(true);

    const term = result.ast?.conditions[0] as TextTerm;
    expect(term.value).toBe('spam message');
    expect(term.negated).toBe(true);
  });
});

describe('parseQuery - OR expressions', () => {
  it('parses simple OR', () => {
    const result = parseQuery('cat OR dog');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(1);

    const or = result.ast?.conditions[0] as OrGroup;
    expect(or.type).toBe('or');
    expect(or.conditions).toHaveLength(2);

    expect((or.conditions[0] as TextTerm).value).toBe('cat');
    expect((or.conditions[1] as TextTerm).value).toBe('dog');
  });

  it('parses chained OR', () => {
    const result = parseQuery('cat OR dog OR bird');
    expect(result.success).toBe(true);

    const or = result.ast?.conditions[0] as OrGroup;
    expect(or.conditions).toHaveLength(3);
  });

  it('parses OR with operators', () => {
    const result = parseQuery('from:alice OR from:bob');
    expect(result.success).toBe(true);

    const or = result.ast?.conditions[0] as OrGroup;
    expect(or.conditions).toHaveLength(2);
    expect((or.conditions[0] as FieldCondition).value).toBe('alice');
    expect((or.conditions[1] as FieldCondition).value).toBe('bob');
  });

  it('handles lowercase or as OR operator (case-insensitive)', () => {
    const result = parseQuery('this or that');
    expect(result.success).toBe(true);
    // Both 'OR' and 'or' are treated as OR operator
    expect(result.ast?.conditions).toHaveLength(1);
    const or = result.ast?.conditions[0] as OrGroup;
    expect(or.type).toBe('or');
    expect(or.conditions).toHaveLength(2);
  });
});

describe('parseQuery - parentheses', () => {
  it('parses simple parentheses', () => {
    const result = parseQuery('(meeting)');
    expect(result.success).toBe(true);

    const group = result.ast?.conditions[0] as ParenGroup;
    expect(group.type).toBe('group');
    expect(group.conditions).toHaveLength(1);
    expect(group.negated).toBe(false);
  });

  it('parses negated parentheses', () => {
    const result = parseQuery('-(spam OR junk)');
    expect(result.success).toBe(true);

    const group = result.ast?.conditions[0] as ParenGroup;
    expect(group.type).toBe('group');
    expect(group.negated).toBe(true);
  });

  it('parses nested expressions', () => {
    const result = parseQuery('from:boss (urgent OR important)');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(2);

    expect((result.ast?.conditions[0] as FieldCondition).field).toBe('from');
    expect((result.ast?.conditions[1] as ParenGroup).type).toBe('group');
  });
});

describe('parseQuery - complex queries', () => {
  it('parses real-world query 1', () => {
    const result = parseQuery('from:newsletter@company.com has:attachment larger:5M');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(3);
  });

  it('parses real-world query 2', () => {
    const result = parseQuery('subject:meeting after:2025-01-01 -spam');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(3);
  });

  it('parses real-world query 3', () => {
    const result = parseQuery('is:unread from:boss OR from:ceo subject:urgent');
    expect(result.success).toBe(true);
    // is:unread, (from:boss OR from:ceo), subject:urgent
    expect(result.ast?.conditions).toHaveLength(3);
  });

  it('parses real-world query 4', () => {
    const result = parseQuery('"weekly report" has:attachment filename:report.pdf older_than:30d');
    expect(result.success).toBe(true);
    expect(result.ast?.conditions).toHaveLength(4);
  });

  it('preserves rawQuery', () => {
    const query = 'from:test@example.com subject:hello';
    const result = parseQuery(query);
    expect(result.ast?.rawQuery).toBe(query);
  });
});

describe('validateQuery', () => {
  it('returns empty array for valid query', () => {
    const errors = validateQuery('from:user@example.com');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for invalid query', () => {
    const errors = validateQuery('has:invalid');
    expect(errors.length).toBeGreaterThan(0);
  });
});
