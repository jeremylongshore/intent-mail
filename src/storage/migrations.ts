/**
 * Database Migration System
 *
 * Version-based migrations with checksum verification.
 */

import { createHash } from 'crypto';
import { getDatabase } from './database.js';
import { Migration, MigrationRow, StorageError } from '../types/storage.js';
import { ALL_SCHEMA } from './schema.js';

/**
 * Calculate SHA-256 checksum of SQL string
 */
function calculateChecksum(sql: string): string {
  return createHash('sha256').update(sql.trim()).digest('hex');
}

/**
 * Migration definitions
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: ALL_SCHEMA.join('\n\n'),
    checksum: '', // Will be calculated
  },
  {
    version: 2,
    name: 'add_attachment_liberation',
    up: `
-- Add content_hash for deduplication
ALTER TABLE attachments ADD COLUMN content_hash TEXT;

-- Add local_path_hash for content-addressed storage (path based on hash)
-- local_path already exists, we'll use it for the actual file path

-- Add extracted_at timestamp
ALTER TABLE attachments ADD COLUMN extracted_at TEXT;

-- Add index for content_hash for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_attachments_content_hash ON attachments(content_hash);
`,
    checksum: '', // Will be calculated
  },
  {
    version: 3,
    name: 'add_safe_deletion',
    up: `
-- Add deletion staging columns to emails table
ALTER TABLE emails ADD COLUMN deletion_staged_at TEXT;
ALTER TABLE emails ADD COLUMN deletion_backup_path TEXT;

-- Create deletion log table for audit trail
CREATE TABLE IF NOT EXISTS deletion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  provider_message_id TEXT NOT NULL,

  -- Email snapshot for recovery
  email_subject TEXT NOT NULL,
  email_from TEXT NOT NULL,
  email_date TEXT NOT NULL,

  -- Deletion workflow
  staged_at TEXT NOT NULL,
  backup_path TEXT,
  committed_at TEXT,
  committed_by TEXT,

  -- Retention info
  retention_days INTEGER NOT NULL DEFAULT 30,
  expires_at TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for deletion workflow
CREATE INDEX IF NOT EXISTS idx_emails_deletion_staged ON emails(deletion_staged_at);
CREATE INDEX IF NOT EXISTS idx_deletion_log_email_id ON deletion_log(email_id);
CREATE INDEX IF NOT EXISTS idx_deletion_log_account_id ON deletion_log(account_id);
CREATE INDEX IF NOT EXISTS idx_deletion_log_expires_at ON deletion_log(expires_at);
CREATE INDEX IF NOT EXISTS idx_deletion_log_committed_at ON deletion_log(committed_at);
`,
    checksum: '', // Will be calculated
  },
  {
    version: 4,
    name: 'add_realtime_sync',
    up: `
-- Add push notification / watch state columns to accounts
ALTER TABLE accounts ADD COLUMN watch_expiration TEXT;
ALTER TABLE accounts ADD COLUMN watch_history_id TEXT;
ALTER TABLE accounts ADD COLUMN push_enabled INTEGER DEFAULT 0;

-- Create push notification log for debugging and metrics
CREATE TABLE IF NOT EXISTS push_notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,

  -- Notification data
  history_id TEXT NOT NULL,
  message_data TEXT,  -- Raw Pub/Sub message (base64 decoded)

  -- Processing state
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  sync_triggered INTEGER DEFAULT 0,

  -- Error tracking
  error TEXT,

  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_push_log_account ON push_notification_log(account_id);
CREATE INDEX IF NOT EXISTS idx_push_log_received ON push_notification_log(received_at);
CREATE INDEX IF NOT EXISTS idx_accounts_watch ON accounts(watch_expiration);
`,
    checksum: '', // Will be calculated
  },
];

// Calculate checksums for all migrations
migrations.forEach((migration) => {
  migration.checksum = calculateChecksum(migration.up);
});

/**
 * Get applied migrations from database
 */
function getAppliedMigrations(): MigrationRow[] {
  const db = getDatabase();

  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      checksum TEXT NOT NULL
    );
  `);

  const stmt = db.prepare('SELECT * FROM migrations ORDER BY version ASC');
  return stmt.all() as MigrationRow[];
}

/**
 * Apply a single migration
 */
function applyMigration(migration: Migration): void {
  const db = getDatabase();

  console.log(`Applying migration v${migration.version}: ${migration.name}`);

  // Run migration in transaction
  const transaction = db.transaction(() => {
    // Execute migration SQL
    db.exec(migration.up);

    // Record migration
    db.prepare(`
      INSERT INTO migrations (version, name, checksum)
      VALUES (?, ?, ?)
    `).run(migration.version, migration.name, migration.checksum);
  });

  transaction();

  console.log(`✓ Migration v${migration.version} applied successfully`);
}

/**
 * Run all pending migrations
 */
export function runMigrations(): void {
  console.log('Checking for pending migrations...');

  const appliedMigrations = getAppliedMigrations();
  const appliedVersions = new Map(
    appliedMigrations.map((m) => [m.version, m])
  );

  let migrationsApplied = 0;

  for (const migration of migrations) {
    const applied = appliedVersions.get(migration.version);

    if (applied) {
      // Migration already applied - verify checksum
      if (applied.checksum !== migration.checksum) {
        throw new StorageError(
          `Migration v${migration.version} checksum mismatch! ` +
            `Database has been tampered with or migration changed after application.\n` +
            `Expected: ${migration.checksum}\n` +
            `Got: ${applied.checksum}`,
          'MIGRATION_CHECKSUM_MISMATCH'
        );
      }
      console.log(`✓ Migration v${migration.version} already applied (checksum verified)`);
      continue;
    }

    // Apply pending migration
    applyMigration(migration);
    migrationsApplied++;
  }

  if (migrationsApplied === 0) {
    console.log('All migrations up to date');
  } else {
    console.log(`Applied ${migrationsApplied} migration(s)`);
  }
}

/**
 * Get current schema version
 */
export function getCurrentVersion(): number {
  const appliedMigrations = getAppliedMigrations();

  if (appliedMigrations.length === 0) {
    return 0;
  }

  return Math.max(...appliedMigrations.map((m) => m.version));
}

/**
 * Get migration history
 */
export function getMigrationHistory(): MigrationRow[] {
  return getAppliedMigrations();
}
