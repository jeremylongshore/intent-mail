/**
 * Tests for C7 context injection: @-mention resolution (L1) and the
 * plain-language rules preamble (L2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveMentions,
  expandContext,
  listContextHandles,
  loadContexts,
  ContextStore,
} from './context-store.js';
import { loadRulesPreamble, loadRulesMarkdown } from './rules-prompt.js';

const STORE: ContextStore = {
  projects: { 'q3-launch': 'The Q3 launch.' },
  clients: { acme: 'Acme Corp — active client.', globex: 'Globex — prospect.' },
};

describe('resolveMentions (L1)', () => {
  it('resolves a client mention into an injected block', () => {
    const r = resolveMentions('reply to @client:acme about renewal', STORE);
    expect(r.used).toEqual(['client:acme']);
    expect(r.unresolved).toEqual([]);
    expect(r.injected).toContain('Acme Corp');
    expect(r.injected).toMatch(/^\n\nContext:/);
  });

  it('resolves project + client and is case-insensitive on the handle', () => {
    const r = resolveMentions('@project:Q3-Launch and @client:ACME', STORE);
    expect(r.used.sort()).toEqual(['client:acme', 'project:q3-launch']);
    expect(r.injected).toContain('The Q3 launch.');
    expect(r.injected).toContain('Acme Corp');
  });

  it('reports unresolved mentions without injecting them', () => {
    const r = resolveMentions('@client:ghost please', STORE);
    expect(r.used).toEqual([]);
    expect(r.unresolved).toEqual(['client:ghost']);
    expect(r.injected).toBe('');
  });

  it('dedupes repeated mentions', () => {
    const r = resolveMentions('@client:acme @client:acme', STORE);
    expect(r.used).toEqual(['client:acme']);
    expect(r.injected.match(/Acme Corp/g)).toHaveLength(1);
  });

  it('expandContext appends the block to the original text', () => {
    const out = expandContext('hi @client:acme', STORE);
    expect(out.startsWith('hi @client:acme')).toBe(true);
    expect(out).toContain('Acme Corp');
  });

  it('expandContext of empty/undefined is empty', () => {
    expect(expandContext(undefined, STORE)).toBe('');
    expect(expandContext('', STORE)).toBe('');
  });

  it('lists handles for autocomplete', () => {
    const handles = listContextHandles(STORE);
    expect(handles).toContainEqual({ kind: 'client', handle: 'acme' });
    expect(handles).toContainEqual({ kind: 'project', handle: 'q3-launch' });
  });
});

describe('file-backed loaders', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'intentmail-ctx-'));
    process.env.INTENTMAIL_CONTEXT_DIR = dir;
  });
  afterEach(() => {
    delete process.env.INTENTMAIL_CONTEXT_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('loadContexts returns an empty store when the file is absent', () => {
    expect(loadContexts()).toEqual({ projects: {}, clients: {} });
  });

  it('loadContexts reads contexts.json', () => {
    writeFileSync(join(dir, 'contexts.json'), JSON.stringify(STORE));
    const loaded = loadContexts();
    expect(loaded.clients.acme).toContain('Acme');
  });

  it('loadRulesPreamble is empty when rules.md is absent', () => {
    expect(loadRulesPreamble()).toBe('');
  });

  it('loadRulesPreamble wraps rules.md content and strips the H1/comments', () => {
    writeFileSync(
      join(dir, 'rules.md'),
      '# Triage rules\n<!-- note -->\n- Accountant mail is high priority.'
    );
    const md = loadRulesMarkdown();
    expect(md).not.toContain('# Triage rules');
    expect(md).not.toContain('<!--');
    expect(md).toContain('Accountant mail is high priority.');

    const preamble = loadRulesPreamble();
    expect(preamble).toContain('plain-language prioritization preferences');
    expect(preamble).toContain('Accountant mail is high priority.');
  });
});
