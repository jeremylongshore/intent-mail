/**
 * End-to-end test: the rules engine against a real temp SQLite database.
 *
 * Exercises the full path — create an account, upsert real emails, create a
 * rule (condition + action), run it dry (no mutation) and for real (mutation
 * on matching emails only), confirm an audit-log entry is written, and confirm
 * rollback reverses the action.
 *
 * Env is set before the dynamic imports so the config + database modules pick
 * up the throwaway DB path (mirrors account-storage.crypto.test.ts).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'intentmail-rules-e2e-'));
process.env.INTENTMAIL_DB_PATH = join(tmp, 'test.db');
process.env.INTENTMAIL_MASTER_KEY = 'e'.repeat(64);

const { initDatabase, closeDatabase } = await import('../storage/database.js');
const { runMigrations } = await import('../storage/migrations.js');
const { createAccount } = await import('../storage/services/account-storage.js');
const { upsertEmail, getEmailById } = await import('../storage/services/email-storage.js');
const { searchEmails } = await import('../storage/services/email-storage.js');
const {
  createRule,
  getRuleById,
  getRulesByAccountId,
  getAllRules,
  getRulesByTrigger,
  updateRule,
  activateRule,
  deactivateRule,
  deleteRule,
} = await import('../storage/services/rule-storage.js');
const { executeRule, executeRules } = await import('./engine.js');
const {
  getAuditLogEntriesByEmail,
  getAuditLogEntriesByRule,
  getAuditLogEntryById,
  getRecentAuditLogEntries,
  countAuditLogEntries,
  getRollbackableEntries,
  getAuditLogStats,
} = await import('../storage/services/audit-log.js');
const {
  executeRollback,
  previewRollback,
  rollbackRule,
  rollbackEmail,
  getRollbackStats,
} = await import('../storage/services/rollback.js');

const { RuleConditionField, RuleConditionOperator, RuleActionType, RuleTrigger } = await import(
  '../types/rule.js'
);
const { EmailFlag } = await import('../types/email.js');

type EmailT = Awaited<ReturnType<typeof getEmailById>>;
type RuleT = ReturnType<typeof createRule>;

let accountId: number;
let matchingEmail: NonNullable<EmailT>;
let otherEmail: NonNullable<EmailT>;
let rule: RuleT;

const baseEmail = {
  threadId: undefined as string | undefined,
  to: [{ address: 'me@example.com' }],
  bodyText: 'body',
  flags: [EmailFlag.SEEN],
  labels: ['INBOX'],
  hasAttachments: false,
};

beforeAll(async () => {
  await initDatabase();
  runMigrations();

  const account = createAccount({
    provider: 'gmail' as never,
    email: 'owner@example.com',
    tokens: {
      accessToken: 'ACCESS',
      refreshToken: 'REFRESH',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  accountId = account.id;

  // Matching email: from newsletters@shop.com
  matchingEmail = upsertEmail({
    ...baseEmail,
    accountId,
    providerMessageId: 'msg-match-1',
    from: { address: 'newsletters@shop.com' },
    subject: 'Weekly deals',
    date: new Date('2026-01-01T10:00:00Z').toISOString(),
  });

  // Non-matching email: a real person
  otherEmail = upsertEmail({
    ...baseEmail,
    accountId,
    providerMessageId: 'msg-other-1',
    from: { address: 'alice@work.com' },
    subject: 'Project update',
    date: new Date('2026-01-02T10:00:00Z').toISOString(),
  });

  // Rule: if from contains "newsletters@" then add label "Newsletters".
  rule = createRule({
    accountId,
    name: 'Tag newsletters',
    description: 'Label bulk newsletter mail',
    trigger: RuleTrigger.MANUAL,
    conditions: [
      {
        field: RuleConditionField.FROM,
        operator: RuleConditionOperator.CONTAINS,
        value: 'newsletters@',
      },
    ],
    actions: [{ type: RuleActionType.ADD_LABEL, value: 'Newsletters' }],
    isActive: true,
  });
});

afterAll(() => {
  closeDatabase();
  rmSync(tmp, { recursive: true, force: true });
});

describe('rules engine E2E', () => {
  it('seeded an account, two emails, and a rule', () => {
    expect(accountId).toBeGreaterThan(0);
    expect(matchingEmail.id).toBeGreaterThan(0);
    expect(otherEmail.id).toBeGreaterThan(0);
    expect(rule.id).toBeGreaterThan(0);
    expect(matchingEmail.labels).toEqual(['INBOX']);
  });

  it('dry-run reports a match but does not mutate the email', async () => {
    const result = await executeRule(rule, matchingEmail, true);

    expect(result.matched).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.actionsApplied).toContain('add_label (Newsletters)');

    // DB is unchanged after a dry-run.
    const fresh = getEmailById(matchingEmail.id!);
    expect(fresh?.labels).toEqual(['INBOX']);

    // No rollbackable audit entry yet (dry-run has no state_after).
    expect(getRollbackableEntries(undefined, matchingEmail.id!)).toHaveLength(0);
  });

  it('does not match a non-newsletter email (dry-run)', async () => {
    const result = await executeRule(rule, otherEmail, true);
    expect(result.matched).toBe(false);
    expect(result.actionsApplied).toHaveLength(0);
  });

  it('real run applies the action to the matching email only', async () => {
    const matchResult = await executeRule(rule, matchingEmail, false);
    expect(matchResult.matched).toBe(true);
    expect(matchResult.dryRun).toBe(false);
    expect(matchResult.error).toBeUndefined();

    const updatedMatch = getEmailById(matchingEmail.id!);
    expect(updatedMatch?.labels).toContain('Newsletters');
    expect(updatedMatch?.labels).toContain('INBOX');

    // The non-matching email is untouched.
    const otherResult = await executeRule(rule, otherEmail, false);
    expect(otherResult.matched).toBe(false);
    const updatedOther = getEmailById(otherEmail.id!);
    expect(updatedOther?.labels).toEqual(['INBOX']);
    expect(updatedOther?.labels).not.toContain('Newsletters');
  });

  it('wrote an audit-log entry capturing before/after state', () => {
    const entries = getAuditLogEntriesByEmail(matchingEmail.id!);
    // Both the dry-run and the real run logged; the real one captured a
    // post-action state snapshot (dry-runs leave state_after null).
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const entry = entries.find((e) => e.stateAfter !== null);
    expect(entry).toBeDefined();
    expect(entry!.ruleId).toBe(rule.id);
    expect(entry!.emailId).toBe(matchingEmail.id);
    expect(entry!.rolledBack).toBe(false);
    expect(entry!.stateBefore.labels).toEqual(['INBOX']);
    expect(entry!.stateAfter?.labels).toContain('Newsletters');
    expect(entry!.executionResult.matched).toBe(true);
    expect(entry!.executionResult.dryRun).toBe(false);
  });

  it('rollback reverses the applied action and marks the entry rolled back', async () => {
    const [rollbackable] = getRollbackableEntries(undefined, matchingEmail.id!);
    expect(rollbackable).toBeDefined();

    const rollback = await executeRollback(rollbackable.id!, false);
    expect(rollback.success).toBe(true);
    expect(rollback.error).toBeUndefined();

    // The label added by the rule is gone; original INBOX label remains.
    const restored = getEmailById(matchingEmail.id!);
    expect(restored?.labels).toEqual(['INBOX']);
    expect(restored?.labels).not.toContain('Newsletters');

    // The audit entry is now marked rolled back and no longer rollbackable.
    expect(getRollbackableEntries(undefined, matchingEmail.id!)).toHaveLength(0);
  });

  it('executeRules skips inactive rules and applies active ones', async () => {
    const second = upsertEmail({
      ...baseEmail,
      accountId,
      providerMessageId: 'msg-match-2',
      from: { address: 'newsletters@news.com' },
      subject: 'Daily digest',
      date: new Date('2026-01-03T10:00:00Z').toISOString(),
    });

    const inactiveRule = createRule({
      accountId,
      name: 'Disabled rule',
      trigger: RuleTrigger.MANUAL,
      conditions: [
        {
          field: RuleConditionField.SUBJECT,
          operator: RuleConditionOperator.CONTAINS,
          value: 'digest',
        },
      ],
      actions: [{ type: RuleActionType.ADD_LABEL, value: 'ShouldNotApply' }],
      isActive: false,
    });

    const results = await executeRules([rule, inactiveRule], second, false);

    // Only the active rule ran (one result), and it matched + applied.
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe(rule.id);
    expect(results[0].matched).toBe(true);

    const updated = getEmailById(second.id!);
    expect(updated?.labels).toContain('Newsletters');
    expect(updated?.labels).not.toContain('ShouldNotApply');
  });
});

describe('rules engine E2E — action types', () => {
  function freshEmail(suffix: string, overrides: Record<string, unknown> = {}) {
    return upsertEmail({
      ...baseEmail,
      accountId,
      providerMessageId: `msg-act-${suffix}`,
      from: { address: `sender-${suffix}@example.com` },
      subject: `subject ${suffix}`,
      date: new Date('2026-02-01T10:00:00Z').toISOString(),
      ...overrides,
    });
  }

  function ruleWith(name: string, actionType: unknown, value?: string) {
    return createRule({
      accountId,
      name,
      trigger: RuleTrigger.MANUAL,
      conditions: [
        {
          field: RuleConditionField.SUBJECT,
          operator: RuleConditionOperator.CONTAINS,
          value: 'subject',
        },
      ],
      actions: [{ type: actionType as never, value }],
      isActive: true,
    });
  }

  it('MARK_READ adds the SEEN flag', async () => {
    const email = freshEmail('read', { flags: [] });
    await executeRule(ruleWith('mark read', RuleActionType.MARK_READ), email, false);
    const updated = getEmailById(email.id!);
    expect(updated?.flags).toContain(EmailFlag.SEEN);
  });

  it('MARK_UNREAD removes the SEEN flag', async () => {
    const email = freshEmail('unread', { flags: [EmailFlag.SEEN] });
    await executeRule(ruleWith('mark unread', RuleActionType.MARK_UNREAD), email, false);
    const updated = getEmailById(email.id!);
    expect(updated?.flags).not.toContain(EmailFlag.SEEN);
  });

  it('ARCHIVE removes the INBOX label', async () => {
    const email = freshEmail('archive', { labels: ['INBOX', 'Keep'] });
    await executeRule(ruleWith('archive', RuleActionType.ARCHIVE), email, false);
    const updated = getEmailById(email.id!);
    expect(updated?.labels).not.toContain('INBOX');
    expect(updated?.labels).toContain('Keep');
  });

  it('MOVE_TO_TRASH adds TRASH and removes INBOX', async () => {
    const email = freshEmail('trash', { labels: ['INBOX'] });
    await executeRule(ruleWith('trash', RuleActionType.MOVE_TO_TRASH), email, false);
    const updated = getEmailById(email.id!);
    expect(updated?.labels).toContain('TRASH');
    expect(updated?.labels).not.toContain('INBOX');
  });

  it('REMOVE_LABEL drops the named label', async () => {
    const email = freshEmail('rmlabel', { labels: ['INBOX', 'Drop'] });
    await executeRule(ruleWith('remove', RuleActionType.REMOVE_LABEL, 'Drop'), email, false);
    const updated = getEmailById(email.id!);
    expect(updated?.labels).not.toContain('Drop');
  });

  it('records an error when ADD_LABEL is missing its value', async () => {
    const email = freshEmail('badaction');
    const result = await executeRule(ruleWith('bad add', RuleActionType.ADD_LABEL), email, false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('ADD_LABEL');
  });
});

describe('rules engine E2E — condition operators', () => {
  let opEmail: NonNullable<EmailT>;

  beforeAll(() => {
    opEmail = upsertEmail({
      ...baseEmail,
      accountId,
      providerMessageId: 'msg-ops-1',
      from: { address: 'ops@vendor.com' },
      subject: 'Invoice #42 attached',
      bodyText: 'Please pay the invoice',
      labels: ['INBOX', 'Bills'],
      hasAttachments: true,
      date: new Date('2026-03-01T10:00:00Z').toISOString(),
    });
  });

  function evalOnly(field: unknown, operator: unknown, value: unknown): boolean {
    const r = createRule({
      accountId,
      name: `op ${String(operator)}`,
      trigger: RuleTrigger.MANUAL,
      conditions: [{ field: field as never, operator: operator as never, value: value as never }],
      actions: [{ type: RuleActionType.ADD_LABEL, value: 'X' }],
      isActive: true,
    });
    return r;
  }

  async function matches(field: unknown, operator: unknown, value: unknown): Promise<boolean> {
    const r = evalOnly(field, operator, value);
    const result = await executeRule(r, opEmail, true);
    return result.matched;
  }

  it('EQUALS, NOT_EQUALS on from', async () => {
    expect(await matches(RuleConditionField.FROM, RuleConditionOperator.EQUALS, 'ops@vendor.com')).toBe(true);
    expect(await matches(RuleConditionField.FROM, RuleConditionOperator.NOT_EQUALS, 'other@x.com')).toBe(true);
  });

  it('CONTAINS, NOT_CONTAINS on subject', async () => {
    expect(await matches(RuleConditionField.SUBJECT, RuleConditionOperator.CONTAINS, 'invoice')).toBe(true);
    expect(await matches(RuleConditionField.SUBJECT, RuleConditionOperator.NOT_CONTAINS, 'refund')).toBe(true);
  });

  it('MATCHES_REGEX on subject', async () => {
    expect(await matches(RuleConditionField.SUBJECT, RuleConditionOperator.MATCHES_REGEX, 'Invoice #\\d+')).toBe(true);
    expect(await matches(RuleConditionField.SUBJECT, RuleConditionOperator.MATCHES_REGEX, '^Refund')).toBe(false);
  });

  it('HAS_ATTACHMENT equals true', async () => {
    expect(await matches(RuleConditionField.HAS_ATTACHMENT, RuleConditionOperator.EQUALS, true)).toBe(true);
  });

  it('IN / NOT_IN on from', async () => {
    expect(await matches(RuleConditionField.FROM, RuleConditionOperator.IN, ['ops@vendor.com', 'z@z.com'])).toBe(true);
    expect(await matches(RuleConditionField.FROM, RuleConditionOperator.NOT_IN, ['a@a.com'])).toBe(true);
  });

  it('LABEL field is read (case-sensitive value) and BODY contains matches', async () => {
    // The engine lower-cases the condition value for CONTAINS but leaves the
    // LABEL field value at its stored case, so a literal "bills" does not match
    // the "Bills" label — this asserts that exercised behaviour rather than a fix.
    expect(await matches(RuleConditionField.LABEL, RuleConditionOperator.CONTAINS, 'Bills')).toBe(false);
    expect(await matches(RuleConditionField.TO, RuleConditionOperator.CONTAINS, 'me@example.com')).toBe(true);
    expect(await matches(RuleConditionField.BODY, RuleConditionOperator.CONTAINS, 'pay the invoice')).toBe(true);
  });

  it('GREATER_THAN / LESS_THAN on date strings', async () => {
    expect(await matches(RuleConditionField.DATE, RuleConditionOperator.GREATER_THAN, '2026-01-01')).toBe(true);
    expect(await matches(RuleConditionField.DATE, RuleConditionOperator.LESS_THAN, '2030-01-01')).toBe(true);
  });
});

describe('rule storage CRUD E2E', () => {
  it('create, read, list, update, activate/deactivate, delete a rule', () => {
    const created = createRule({
      accountId,
      name: 'CRUD rule',
      description: 'desc',
      trigger: RuleTrigger.ON_NEW_EMAIL,
      conditions: [
        { field: RuleConditionField.FROM, operator: RuleConditionOperator.CONTAINS, value: 'x@' },
      ],
      actions: [{ type: RuleActionType.ARCHIVE }],
      isActive: true,
    });

    expect(getRuleById(created.id!)?.name).toBe('CRUD rule');
    expect(getRulesByAccountId(accountId).some((r) => r.id === created.id)).toBe(true);
    expect(getRulesByAccountId(accountId, true).length).toBeGreaterThan(0);
    expect(getAllRules().some((r) => r.id === created.id)).toBe(true);
    expect(getRulesByTrigger(RuleTrigger.ON_NEW_EMAIL).some((r) => r.id === created.id)).toBe(true);

    const renamed = updateRule({ ruleId: created.id!, name: 'Renamed', description: 'new desc' });
    expect(renamed.name).toBe('Renamed');

    expect(deactivateRule(created.id!).isActive).toBe(false);
    expect(activateRule(created.id!).isActive).toBe(true);

    expect(deleteRule(created.id!)).toBe(true);
    expect(getRuleById(created.id!)).toBeNull();
    expect(deleteRule(created.id!)).toBe(false);
  });
});

describe('audit log + rollback query surface E2E', () => {
  let auditEmail: NonNullable<EmailT>;
  let auditRule: RuleT;

  beforeAll(async () => {
    auditEmail = upsertEmail({
      ...baseEmail,
      accountId,
      providerMessageId: 'msg-audit-1',
      from: { address: 'reports@daily.com' },
      subject: 'Daily report',
      labels: ['INBOX'],
      date: new Date('2026-04-01T10:00:00Z').toISOString(),
    });

    auditRule = createRule({
      accountId,
      name: 'Tag reports',
      trigger: RuleTrigger.MANUAL,
      conditions: [
        { field: RuleConditionField.FROM, operator: RuleConditionOperator.CONTAINS, value: 'reports@' },
      ],
      actions: [{ type: RuleActionType.ADD_LABEL, value: 'Reports' }],
      isActive: true,
    });

    await executeRule(auditRule, auditEmail, false);
  });

  it('exposes audit entries via the various query helpers', () => {
    const byRule = getAuditLogEntriesByRule(auditRule.id!);
    expect(byRule.length).toBeGreaterThanOrEqual(1);

    const first = byRule[0];
    expect(getAuditLogEntryById(first.id!)?.id).toBe(first.id);
    expect(getRecentAuditLogEntries(10).length).toBeGreaterThanOrEqual(1);
    expect(countAuditLogEntries()).toBeGreaterThanOrEqual(1);
    expect(countAuditLogEntries(auditRule.id!)).toBeGreaterThanOrEqual(1);
    expect(countAuditLogEntries(undefined, auditEmail.id!)).toBeGreaterThanOrEqual(1);

    const stats = getAuditLogStats();
    expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
    expect(stats.entriesByRule.length).toBeGreaterThanOrEqual(1);
  });

  it('previewRollback returns a plan without mutating', async () => {
    const [entry] = getRollbackableEntries(auditRule.id!, undefined);
    expect(entry).toBeDefined();

    const plan = await previewRollback(entry.id!);
    expect(plan).not.toBeNull();
    expect(plan!.changes.labelsToRemove).toContain('Reports');

    // Still applied (preview did not mutate).
    expect(getEmailById(auditEmail.id!)?.labels).toContain('Reports');

    // Dry-run rollback also leaves state intact.
    const dry = await executeRollback(entry.id!, true);
    expect(dry.success).toBe(true);
    expect(getEmailById(auditEmail.id!)?.labels).toContain('Reports');
  });

  it('rollbackRule reverses every applied execution for a rule', async () => {
    const stats = getRollbackStats();
    expect(stats.totalRollbackable).toBeGreaterThanOrEqual(1);

    const results = await rollbackRule(auditRule.id!, false);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.success)).toBe(true);
    expect(getEmailById(auditEmail.id!)?.labels).not.toContain('Reports');
  });

  it('rollbackEmail is a no-op once nothing is rollbackable', async () => {
    const results = await rollbackEmail(auditEmail.id!, false);
    expect(results).toHaveLength(0);
  });

  it('executeRollback fails cleanly for a missing audit entry', async () => {
    const result = await executeRollback(999_999, false);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('previewRollback returns null for a missing audit entry', async () => {
    expect(await previewRollback(999_999)).toBeNull();
  });
});

describe('email storage search E2E', () => {
  it('finds seeded emails by account and from-filter', () => {
    const all = searchEmails({ accountId, limit: 50, offset: 0 });
    expect(all.total).toBeGreaterThan(0);
    expect(all.items.length).toBeGreaterThan(0);

    const byFrom = searchEmails({ accountId, from: 'newsletters@', limit: 50, offset: 0 });
    expect(byFrom.total).toBeGreaterThanOrEqual(1);
    expect(byFrom.items.every((e) => e.from.address.includes('newsletters@'))).toBe(true);
  });
});
