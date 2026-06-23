/**
 * Plain-language rules preamble (C7 L2).
 *
 * Loads a human-written `context/rules.md` of plain-language prioritization
 * guidance ("treat anything from my accountant as high priority", "newsletters
 * are low priority") and exposes it as a triage-prompt preamble. This is
 * ADDITIVE to the deterministic rules engine (src/rules/engine.ts): the engine
 * encodes exact conditions/actions; this preamble nudges the AI triage with
 * softer, natural-language preferences (Inbox Zero "prompt rules" pattern).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function contextDir(dir?: string): string {
  return dir || process.env.INTENTMAIL_CONTEXT_DIR || join(process.cwd(), 'context');
}

/**
 * Load the raw rules.md content, or '' if absent. Trimmed; the leading H1 and
 * HTML comments are stripped so only the guidance reaches the model.
 */
export function loadRulesMarkdown(dir?: string): string {
  const path = join(contextDir(dir), 'rules.md');
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '') // strip HTML comments
      .replace(/^#\s.*$/m, '') // strip a leading H1
      .trim();
  } catch {
    return '';
  }
}

/**
 * Build the triage preamble to prepend to the per-email triage prompt. Returns
 * '' when no rules.md exists, so triage is unchanged for users who do not use
 * the feature.
 */
export function loadRulesPreamble(dir?: string): string {
  const md = loadRulesMarkdown(dir);
  if (!md) return '';
  return [
    "The user has provided these plain-language prioritization preferences.",
    'Treat them as soft guidance that biases priority and action, not as hard',
    'overrides of obvious signals:',
    '',
    md,
    '',
  ].join('\n');
}
