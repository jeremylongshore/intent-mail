/**
 * Gmail Query Syntax Parser
 *
 * Tokenizes and parses Gmail-style search queries into an AST.
 *
 * Supported syntax:
 *   from:user@example.com    to:team@company.com   cc:manager@
 *   subject:meeting          has:attachment        label:important
 *   is:read / is:unread      is:starred
 *   larger:5M / smaller:10K  before:2025-01-01     after:2024-06-01
 *   older_than:7d            newer_than:1m         newer_than:1y
 *   filename:report.pdf      "exact phrase"        -exclude
 *   term1 OR term2           (grouping)
 */

import type {
  QueryCondition,
  ParseResult,
  ParseError,
  FieldOperator,
  HasOperator,
  IsOperator,
} from './query-ast.js';

/**
 * Token types produced by the lexer
 */
type TokenType =
  | 'OPERATOR'    // from:, to:, subject:, etc.
  | 'VALUE'       // The value after an operator
  | 'QUOTED'      // "quoted string"
  | 'WORD'        // Plain word
  | 'OR'          // OR keyword
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'MINUS'       // - (negation)
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Field operators that take a value
 */
const FIELD_OPERATORS: Set<string> = new Set([
  'from', 'to', 'cc', 'bcc', 'subject', 'label', 'filename', 'in',
]);


/**
 * Valid 'has' values
 */
const HAS_VALUES: Set<string> = new Set([
  'attachment', 'drive', 'document', 'spreadsheet', 'presentation', 'youtube',
]);

/**
 * Valid 'is' values
 */
const IS_VALUES: Set<string> = new Set([
  'read', 'unread', 'starred', 'important', 'snoozed', 'muted',
]);

/**
 * Lexer: tokenize input string
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos])) {
      pos++;
      continue;
    }

    // Check for parentheses
    if (input[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos });
      pos++;
      continue;
    }

    if (input[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos });
      pos++;
      continue;
    }

    // Check for minus (negation)
    if (input[pos] === '-' && (pos === 0 || /\s/.test(input[pos - 1]))) {
      tokens.push({ type: 'MINUS', value: '-', position: pos });
      pos++;
      continue;
    }

    // Check for quoted string
    if (input[pos] === '"') {
      const start = pos;
      pos++; // Skip opening quote
      let value = '';
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          // Handle escaped characters
          pos++;
          value += input[pos];
        } else {
          value += input[pos];
        }
        pos++;
      }
      pos++; // Skip closing quote
      tokens.push({ type: 'QUOTED', value, position: start });
      continue;
    }

    // Check for operator:value pattern
    const operatorMatch = input.slice(pos).match(/^([a-z_]+):/i);
    if (operatorMatch) {
      const operator = operatorMatch[1].toLowerCase();
      const operatorPos = pos;
      pos += operatorMatch[0].length;

      // Now read the value (could be quoted or unquoted)
      let value = '';
      if (input[pos] === '"') {
        // Quoted value
        pos++; // Skip opening quote
        while (pos < input.length && input[pos] !== '"') {
          if (input[pos] === '\\' && pos + 1 < input.length) {
            pos++;
            value += input[pos];
          } else {
            value += input[pos];
          }
          pos++;
        }
        pos++; // Skip closing quote
      } else {
        // Unquoted value - read until whitespace or special char
        while (pos < input.length && !/[\s()]/.test(input[pos])) {
          value += input[pos];
          pos++;
        }
      }

      tokens.push({ type: 'OPERATOR', value: operator, position: operatorPos });
      tokens.push({ type: 'VALUE', value, position: operatorPos + operatorMatch[0].length });
      continue;
    }

    // Check for OR keyword
    if (input.slice(pos, pos + 2).toUpperCase() === 'OR' &&
        (pos + 2 >= input.length || /[\s()]/.test(input[pos + 2]))) {
      tokens.push({ type: 'OR', value: 'OR', position: pos });
      pos += 2;
      continue;
    }

    // Regular word
    let word = '';
    const wordStart = pos;
    while (pos < input.length && !/[\s()"]/.test(input[pos])) {
      word += input[pos];
      pos++;
    }
    if (word) {
      tokens.push({ type: 'WORD', value: word, position: wordStart });
    }
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return tokens;
}

/**
 * Parse size value with units (5M, 10K, 1024)
 */
export function parseSize(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*([kmgKMG])?[bB]?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = (match[2] || '').toUpperCase();

  switch (unit) {
    case 'K':
      return Math.floor(num * 1024);
    case 'M':
      return Math.floor(num * 1024 * 1024);
    case 'G':
      return Math.floor(num * 1024 * 1024 * 1024);
    default:
      return Math.floor(num);
  }
}

/**
 * Parse relative date (7d, 1m, 1y) to ISO date
 */
export function parseRelativeDate(value: string): string | null {
  const match = value.match(/^(\d+)\s*([dDwWmMyY])$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const now = new Date();

  switch (unit) {
    case 'd':
      now.setDate(now.getDate() - num);
      break;
    case 'w':
      now.setDate(now.getDate() - num * 7);
      break;
    case 'm':
      now.setMonth(now.getMonth() - num);
      break;
    case 'y':
      now.setFullYear(now.getFullYear() - num);
      break;
    default:
      return null;
  }

  return now.toISOString().split('T')[0];
}

/**
 * Parse absolute date (2025-01-01, 01/01/2025, Jan 1 2025)
 */
export function parseAbsoluteDate(value: string): string | null {
  // ISO format: 2025-01-01
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return value;
    }
  }

  // US format: 01/01/2025 or 1/1/2025
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0');
    const day = usMatch[2].padStart(2, '0');
    const year = usMatch[3];
    const isoDate = `${year}-${month}-${day}`;
    const date = new Date(isoDate);
    if (!isNaN(date.getTime())) {
      return isoDate;
    }
  }

  // Month name formats: Jan 1 2025, January 1, 2025
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  const monthMatch = value.match(/^([a-z]+)\s+(\d{1,2}),?\s*(\d{4})$/i);
  if (monthMatch) {
    const monthNum = months[monthMatch[1].toLowerCase()];
    if (monthNum) {
      const day = monthMatch[2].padStart(2, '0');
      const year = monthMatch[3];
      return `${year}-${monthNum}-${day}`;
    }
  }

  return null;
}

/**
 * Parser class
 */
class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', position: 0 };
  }

  private advance(): Token {
    const token = this.current();
    if (token.type !== 'EOF') {
      this.pos++;
    }
    return token;
  }

  private error(message: string, token: Token): void {
    this.errors.push({
      message,
      position: token.position,
      length: token.value.length || 1,
    });
  }

  /**
   * Parse a single condition
   */
  private parseCondition(negated: boolean = false): QueryCondition | null {
    const token = this.current();

    // Handle negation
    if (token.type === 'MINUS') {
      this.advance();
      return this.parseCondition(true);
    }

    // Handle parenthesized group
    if (token.type === 'LPAREN') {
      this.advance();
      const conditions: QueryCondition[] = [];
      while (this.current().type !== 'RPAREN' && this.current().type !== 'EOF') {
        const cond = this.parseOrExpression();
        if (cond) {
          conditions.push(cond);
        }
      }
      if (this.current().type === 'RPAREN') {
        this.advance();
      } else {
        this.error('Missing closing parenthesis', token);
      }
      return { type: 'group', conditions, negated };
    }

    // Handle operator:value
    if (token.type === 'OPERATOR') {
      const operator = token.value.toLowerCase();
      this.advance();
      const valueToken = this.current();

      if (valueToken.type !== 'VALUE') {
        this.error(`Expected value after ${operator}:`, token);
        return null;
      }
      this.advance();
      const value = valueToken.value;

      // Field operators
      if (FIELD_OPERATORS.has(operator)) {
        return {
          type: 'field',
          field: operator as FieldOperator,
          value,
          negated,
        };
      }

      // Has operator
      if (operator === 'has') {
        if (HAS_VALUES.has(value.toLowerCase())) {
          return {
            type: 'has',
            what: value.toLowerCase() as HasOperator,
            negated,
          };
        }
        this.error(`Invalid has: value "${value}"`, valueToken);
        return null;
      }

      // Is operator
      if (operator === 'is') {
        if (IS_VALUES.has(value.toLowerCase())) {
          return {
            type: 'is',
            state: value.toLowerCase() as IsOperator,
            negated,
          };
        }
        this.error(`Invalid is: value "${value}"`, valueToken);
        return null;
      }

      // Size operators
      if (operator === 'larger' || operator === 'smaller') {
        const bytes = parseSize(value);
        if (bytes !== null) {
          return {
            type: 'size',
            operator,
            bytes,
          };
        }
        this.error(`Invalid size value "${value}"`, valueToken);
        return null;
      }

      // Date operators
      if (operator === 'before' || operator === 'after') {
        const date = parseAbsoluteDate(value);
        if (date) {
          return {
            type: 'date',
            operator,
            date,
          };
        }
        this.error(`Invalid date "${value}"`, valueToken);
        return null;
      }

      // Relative date operators
      if (operator === 'older_than' || operator === 'newer_than') {
        const date = parseRelativeDate(value);
        if (date) {
          return {
            type: 'relative_date',
            operator,
            date,
          };
        }
        this.error(`Invalid relative date "${value}"`, valueToken);
        return null;
      }

      // Unknown operator - treat as field search
      return {
        type: 'field',
        field: 'subject' as FieldOperator, // Default to subject
        value: `${operator}:${value}`,
        negated,
      };
    }

    // Handle quoted string
    if (token.type === 'QUOTED') {
      this.advance();
      return {
        type: 'text',
        value: token.value,
        exact: true,
        negated,
      };
    }

    // Handle plain word
    if (token.type === 'WORD') {
      this.advance();
      return {
        type: 'text',
        value: token.value,
        exact: false,
        negated,
      };
    }

    return null;
  }

  /**
   * Parse OR expressions: term OR term OR term
   */
  private parseOrExpression(): QueryCondition | null {
    const left = this.parseCondition();
    if (!left) return null;

    // Check for OR
    if (this.current().type === 'OR') {
      const orConditions: QueryCondition[] = [left];

      while (this.current().type === 'OR') {
        this.advance(); // Skip OR
        const right = this.parseCondition();
        if (right) {
          orConditions.push(right);
        }
      }

      if (orConditions.length > 1) {
        return { type: 'or', conditions: orConditions };
      }
    }

    return left;
  }

  /**
   * Parse entire query
   */
  parse(): ParseResult {
    const conditions: QueryCondition[] = [];

    while (this.current().type !== 'EOF') {
      const condition = this.parseOrExpression();
      if (condition) {
        conditions.push(condition);
      } else if (this.current().type !== 'EOF') {
        // Skip unrecognized token
        this.advance();
      }
    }

    if (this.errors.length > 0) {
      return {
        success: false,
        errors: this.errors,
      };
    }

    return {
      success: true,
      ast: {
        conditions,
        rawQuery: '',
      },
      errors: [],
    };
  }
}

/**
 * Parse a Gmail-style query string into an AST
 */
export function parseQuery(query: string): ParseResult {
  if (!query || query.trim().length === 0) {
    return {
      success: true,
      ast: { conditions: [], rawQuery: query },
      errors: [],
    };
  }

  const tokens = tokenize(query.trim());
  const parser = new Parser(tokens);
  const result = parser.parse();

  if (result.ast) {
    result.ast.rawQuery = query;
  }

  return result;
}

/**
 * Validate a query string without fully parsing
 */
export function validateQuery(query: string): ParseError[] {
  const result = parseQuery(query);
  return result.errors;
}
