/**
 * Gmail Query Syntax - AST Types
 *
 * Represents parsed Gmail-style search queries as an abstract syntax tree.
 * Supports operators: from:, to:, cc:, subject:, has:, is:, label:,
 * larger:, smaller:, before:, after:, older_than:, newer_than:, filename:
 */

/**
 * Operator types for field-based searches
 */
export type FieldOperator =
  | 'from'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'subject'
  | 'label'
  | 'filename'
  | 'in';

/**
 * Has operators (has:attachment, has:drive, etc.)
 */
export type HasOperator = 'attachment' | 'drive' | 'document' | 'spreadsheet' | 'presentation' | 'youtube';

/**
 * Is operators (is:read, is:unread, is:starred, etc.)
 */
export type IsOperator = 'read' | 'unread' | 'starred' | 'important' | 'snoozed' | 'muted';

/**
 * Size operators with parsed byte value
 */
export interface SizeCondition {
  type: 'size';
  operator: 'larger' | 'smaller';
  bytes: number;
}

/**
 * Date operators with parsed ISO date
 */
export interface DateCondition {
  type: 'date';
  operator: 'before' | 'after';
  date: string; // ISO 8601 date
}

/**
 * Relative date operators (older_than:7d, newer_than:1m)
 */
export interface RelativeDateCondition {
  type: 'relative_date';
  operator: 'older_than' | 'newer_than';
  date: string; // Computed ISO 8601 date
}

/**
 * Field-based condition (from:user@example.com)
 */
export interface FieldCondition {
  type: 'field';
  field: FieldOperator;
  value: string;
  negated: boolean;
}

/**
 * Has condition (has:attachment)
 */
export interface HasCondition {
  type: 'has';
  what: HasOperator;
  negated: boolean;
}

/**
 * Is condition (is:unread)
 */
export interface IsCondition {
  type: 'is';
  state: IsOperator;
  negated: boolean;
}

/**
 * Full-text search term
 */
export interface TextTerm {
  type: 'text';
  value: string;
  exact: boolean; // true if quoted "exact phrase"
  negated: boolean;
}

/**
 * OR grouping of conditions
 */
export interface OrGroup {
  type: 'or';
  conditions: QueryCondition[];
}

/**
 * Parenthesized group
 */
export interface ParenGroup {
  type: 'group';
  conditions: QueryCondition[];
  negated: boolean;
}

/**
 * All possible query conditions
 */
export type QueryCondition =
  | FieldCondition
  | HasCondition
  | IsCondition
  | SizeCondition
  | DateCondition
  | RelativeDateCondition
  | TextTerm
  | OrGroup
  | ParenGroup;

/**
 * Complete parsed query AST
 */
export interface QueryAST {
  conditions: QueryCondition[];
  rawQuery: string;
}

/**
 * Parse result with potential errors
 */
export interface ParseResult {
  success: boolean;
  ast?: QueryAST;
  errors: ParseError[];
}

/**
 * Parse error with position information
 */
export interface ParseError {
  message: string;
  position: number;
  length: number;
}
