/**
 * Context store (C7 L1 — @-mention project/client context).
 *
 * Loads a small, human-maintained `context/contexts.json` mapping project and
 * client handles to plain-language descriptions, and resolves `@project:foo` /
 * `@client:bar` mentions in free text into an injected context block. The same
 * resolution feeds both drafting (mail_draft's `context` param) and triage, so
 * "reply to @client:acme about the renewal" carries Acme's context to the model.
 *
 * The web ContextMentionInput autocompletes these handles; this module is the
 * backend it (and the MCP tools) resolve against.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ContextStore {
  projects: Record<string, string>;
  clients: Record<string, string>;
}

const EMPTY: ContextStore = { projects: {}, clients: {} };

/** `@project:handle` / `@client:handle` (handle = alnum + - _). */
const MENTION_RE = /@(project|client):([a-z0-9][\w-]*)/gi;

/** Resolve the context directory (override with INTENTMAIL_CONTEXT_DIR). */
function contextDir(dir?: string): string {
  return dir || process.env.INTENTMAIL_CONTEXT_DIR || join(process.cwd(), 'context');
}

/**
 * Load contexts.json. Missing/invalid file yields an empty store (the feature
 * is opt-in; absence is not an error).
 */
export function loadContexts(dir?: string): ContextStore {
  const path = join(contextDir(dir), 'contexts.json');
  if (!existsSync(path)) return { ...EMPTY };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ContextStore>;
    return {
      projects: raw.projects ?? {},
      clients: raw.clients ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}

export interface ResolvedContext {
  /** The original text with mentions left in place (they read naturally). */
  text: string;
  /** The appended context block (empty string if nothing resolved). */
  injected: string;
  /** Mentions that resolved, e.g. ["client:acme"]. */
  used: string[];
  /** Mentions that did not resolve, e.g. ["project:ghost"]. */
  unresolved: string[];
}

/**
 * Resolve `@project:`/`@client:` mentions in `text` against the store, building
 * an injectable context block. Returns the original text plus the block so the
 * caller can pass `text + injected` to the model.
 */
export function resolveMentions(text: string, store?: ContextStore): ResolvedContext {
  const ctx = store ?? loadContexts();
  const used: string[] = [];
  const unresolved: string[] = [];
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(MENTION_RE)) {
    const kind = match[1].toLowerCase() as 'project' | 'client';
    const handle = match[2].toLowerCase();
    const key = `${kind}:${handle}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bucket = kind === 'project' ? ctx.projects : ctx.clients;
    // Case-insensitive handle lookup.
    const found = Object.entries(bucket).find(([k]) => k.toLowerCase() === handle);
    if (found) {
      used.push(key);
      lines.push(`- ${kind === 'project' ? 'Project' : 'Client'} "${found[0]}": ${found[1]}`);
    } else {
      unresolved.push(key);
    }
  }

  const injected = lines.length > 0 ? `\n\nContext:\n${lines.join('\n')}` : '';
  return { text, injected, used, unresolved };
}

/**
 * Convenience: expand mentions and return a single string suitable for the
 * mail_draft `context` param (original text + injected block).
 */
export function expandContext(text: string | undefined, store?: ContextStore): string {
  if (!text) return '';
  const { text: t, injected } = resolveMentions(text, store);
  return t + injected;
}

/** List available context handles (for autocomplete / discovery). */
export function listContextHandles(store?: ContextStore): Array<{ kind: 'project' | 'client'; handle: string }> {
  const ctx = store ?? loadContexts();
  return [
    ...Object.keys(ctx.projects).map((handle) => ({ kind: 'project' as const, handle })),
    ...Object.keys(ctx.clients).map((handle) => ({ kind: 'client' as const, handle })),
  ];
}
