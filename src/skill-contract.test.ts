import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { SERVER_VERSION } from './config.js';

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  'allowed-tools': string;
  model: string;
  effort: string;
}

const root = process.cwd();
const skillNames = [
  'email-checkin',
  'email-project-context',
  'email-triage-actions',
] as const;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;
}

function readSkill(name: (typeof skillNames)[number]): {
  metadata: SkillMetadata;
  body: string;
} {
  const text = readFileSync(join(root, 'skills', name, 'SKILL.md'), 'utf8');
  const [, frontmatter, body] = text.split('---', 3);
  return { metadata: load(frontmatter) as SkillMetadata, body };
}

describe('published Agent Skill contract', () => {
  it('keeps package, server, plugin, MCP, and skill versions aligned', () => {
    const packageJson = readJson('package.json');
    const plugin = readJson('.claude-plugin/plugin.json');
    const mcp = readJson('.mcp.json');
    const expected = packageJson.version;

    expect(SERVER_VERSION).toBe(expected);
    expect(plugin.version).toBe(expected);
    expect((plugin.mcpServers as Record<string, { version: string }>).intentmail.version).toBe(expected);
    expect((mcp.mcpServers as Record<string, { version: string }>).intentmail.version).toBe(expected);

    for (const name of skillNames) {
      expect(readSkill(name).metadata.version).toBe(expected);
    }
  });

  it('ships complete marketplace metadata and resolving references', () => {
    for (const name of skillNames) {
      const { metadata, body } = readSkill(name);
      expect(metadata.name).toBe(name);
      expect(metadata.description).toContain('Use when');
      expect(metadata.description).toContain('trigger with');
      expect(metadata['allowed-tools']).toBeTruthy();
      expect(metadata.model).toBe('inherit');
      expect(['medium', 'high']).toContain(metadata.effort);

      const references = [...body.matchAll(/\]\((references\/[^)]+)\)/g)];
      expect(references.length).toBeGreaterThan(0);
      for (const [, reference] of references) {
        expect(() => readFileSync(join(root, 'skills', name, reference), 'utf8')).not.toThrow();
      }
    }
  });

  it('keeps provider writes and unsupported operations out of the check-in skill', () => {
    const { metadata, body } = readSkill('email-checkin');
    expect(metadata['allowed-tools']).not.toMatch(/mail_(?:action|send|move|flag|stage_delete)/);
    expect(body).toContain('never changes provider message state');
  });

  it('does not overstate draft, deletion, audit, rollback, or privacy guarantees', () => {
    const triage = readSkill('email-triage-actions');
    const publicDocs = [
      triage.metadata.description,
      triage.body,
      readFileSync(join(root, 'README.md'), 'utf8'),
      readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'),
    ].join('\n');

    expect(triage.metadata['allowed-tools']).not.toContain('mail_send');
    expect(triage.metadata['allowed-tools']).not.toContain('mail_commit_deletions');
    expect(publicDocs).not.toContain('mailbox never leaves your machine');
    expect(publicDocs).not.toContain('all audited + reversible');
    expect(triage.body).toContain('does not create a Gmail/Outlook draft');
    expect(triage.body).toContain('Permanent provider deletion is not implemented');
    expect(triage.body).toContain('direct actions do not produce');
  });

  it('states the local-only rule execution boundary', () => {
    const projectContext = readSkill('email-project-context');
    expect(projectContext.body).toContain('does not propagate those rule');
    expect(projectContext.body).toContain('`set_priority` is');
    expect(projectContext.body).toContain('`dryRun: true`');
  });
});
