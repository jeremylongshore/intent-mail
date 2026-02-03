/**
 * DuckDB Connection Manager
 *
 * Singleton connection to DuckDB for high-performance analytics.
 * DuckDB runs queries hundreds of times faster than SQLite for analytics workloads.
 */

import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Default DuckDB database path
 */
const DEFAULT_DB_PATH = './data/analytics.duckdb';

/**
 * DuckDB connection instance
 */
let db: duckdb.Database | null = null;
let connection: duckdb.Connection | null = null;

/**
 * Initialize DuckDB connection
 */
export function initDuckDB(dbPath: string = DEFAULT_DB_PATH): duckdb.Connection {
  if (connection) {
    return connection;
  }

  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.error(`Initializing DuckDB at ${dbPath}...`);
  db = new duckdb.Database(dbPath);
  connection = db.connect();

  // Create analytics tables
  createAnalyticsTables(connection);

  console.error('DuckDB initialized successfully');
  return connection;
}

/**
 * Get DuckDB connection (initializes if needed)
 */
export function getDuckDB(): duckdb.Connection {
  if (!connection) {
    return initDuckDB();
  }
  return connection;
}

/**
 * Close DuckDB connection
 */
export function closeDuckDB(): void {
  if (connection) {
    connection.close();
    connection = null;
  }
  if (db) {
    db.close();
    db = null;
  }
  console.error('DuckDB connection closed');
}

/**
 * Create analytics tables in DuckDB
 */
function createAnalyticsTables(conn: duckdb.Connection): void {
  // Emails analytics table - optimized for OLAP queries
  conn.run(`
    CREATE TABLE IF NOT EXISTS emails_analytics (
      id INTEGER PRIMARY KEY,
      account_id INTEGER NOT NULL,
      provider_message_id VARCHAR NOT NULL,
      thread_id VARCHAR,

      -- Core fields
      from_address VARCHAR NOT NULL,
      from_name VARCHAR,
      from_domain VARCHAR,  -- Extracted from from_address
      subject VARCHAR NOT NULL,
      snippet VARCHAR,

      -- Metadata
      date TIMESTAMP NOT NULL,
      received_at TIMESTAMP,

      -- Flags (as boolean columns for fast filtering)
      is_read BOOLEAN DEFAULT FALSE,
      is_flagged BOOLEAN DEFAULT FALSE,
      is_draft BOOLEAN DEFAULT FALSE,
      is_answered BOOLEAN DEFAULT FALSE,

      -- Size
      size_bytes INTEGER,
      has_attachments BOOLEAN DEFAULT FALSE,

      -- Labels as array
      labels VARCHAR[],

      -- Sync metadata
      synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Attachments analytics table
  conn.run(`
    CREATE TABLE IF NOT EXISTS attachments_analytics (
      id INTEGER PRIMARY KEY,
      email_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,

      filename VARCHAR NOT NULL,
      mime_type VARCHAR NOT NULL,
      size_bytes INTEGER NOT NULL,

      -- Content-based dedup
      content_hash VARCHAR,
      extracted_at TIMESTAMP,

      FOREIGN KEY (email_id) REFERENCES emails_analytics(id)
    )
  `);

  // Create indexes for common analytics queries
  conn.run('CREATE INDEX IF NOT EXISTS idx_emails_date ON emails_analytics(date)');
  conn.run('CREATE INDEX IF NOT EXISTS idx_emails_from_domain ON emails_analytics(from_domain)');
  conn.run('CREATE INDEX IF NOT EXISTS idx_emails_account ON emails_analytics(account_id)');
  conn.run('CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments_analytics(email_id)');
  conn.run('CREATE INDEX IF NOT EXISTS idx_attachments_mime ON attachments_analytics(mime_type)');
}

/**
 * Execute a query and return results as array of objects
 */
export function queryDuckDB<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const conn = getDuckDB();

    const callback = (err: Error | null, rows: duckdb.TableData) => {
      if (err) {
        reject(err);
      } else {
        resolve((rows as T[]) || []);
      }
    };

    if (params.length > 0) {
      conn.all(sql, ...params, callback);
    } else {
      conn.all(sql, callback);
    }
  });
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export function runDuckDB(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = getDuckDB();

    conn.run(sql, ...params, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Execute multiple statements in a transaction
 */
export async function runDuckDBTransaction(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
  await runDuckDB('BEGIN TRANSACTION');

  try {
    for (const stmt of statements) {
      await runDuckDB(stmt.sql, stmt.params || []);
    }
    await runDuckDB('COMMIT');
  } catch (error) {
    await runDuckDB('ROLLBACK');
    throw error;
  }
}

/**
 * Get DuckDB version info
 */
export async function getDuckDBVersion(): Promise<string> {
  const rows = await queryDuckDB<{ version: string }>('SELECT version() as version');
  return rows[0]?.version || 'unknown';
}

// Export type for external use
export type { Database as DuckDatabase, Connection as DuckConnection } from 'duckdb';
