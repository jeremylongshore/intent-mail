import OpenAI from 'openai';
import type {
  AIProvider,
  EmailContext,
  Email,
  EmailThread,
  SearchResult,
} from './provider.js';
import {
  buildDraftPrompt,
  buildSummarizePrompt,
  buildSearchPrompt,
  buildReplyPrompt,
  parseSearchRankings,
  keywordSearch,
} from './prompts.js';

/**
 * Cerebras API Configuration
 *
 * Cerebras provides the fastest inference available (3000+ tokens/sec)
 * Free tier: 1,000,000 tokens/day (no credit card required)
 * API is OpenAI-compatible - just change base URL
 */
interface CerebrasConfig {
  apiKey: string;
  model?: string;
}

/**
 * Cerebras API provider implementation
 *
 * Recommended as SECONDARY fallback provider due to:
 * - Speed: 3000+ tokens/sec (fastest available)
 * - Free tier: 1,000,000 tokens/day
 * - Models: Llama 3.1/3.3 70B, Llama 4 Scout
 * - Latency: ~574ms for 100 tokens (best-in-class)
 *
 * Sign up: https://inference.cerebras.ai (no credit card)
 */
export class CerebrasProvider implements AIProvider {
  readonly name = 'cerebras';
  readonly model: string;
  private client: OpenAI;

  constructor(config: CerebrasConfig) {
    // Default to Llama 3.3 70B - excellent quality, blazing fast
    this.model = config.model ?? 'llama-3.3-70b';
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.cerebras.ai/v1',
    });
  }

  async generateDraft(context: EmailContext): Promise<string> {
    const prompt = buildDraftPrompt(context);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error(`[${this.name}] Error in generateDraft:`, error);
      throw error; // Propagate for fallback handling
    }
  }

  async summarize(emails: Email[]): Promise<string> {
    if (emails.length === 0) {
      return 'No emails to summarize.';
    }

    const prompt = buildSummarizePrompt(emails);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error(`[${this.name}] Error in summarize:`, error);
      throw error;
    }
  }

  async search(query: string, emails: Email[]): Promise<SearchResult[]> {
    if (emails.length === 0) {
      return [];
    }

    const prompt = buildSearchPrompt(query, emails);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1, // Low temp for consistent ranking
      });
      const text = response.choices[0]?.message?.content ?? '[]';

      const rankings = parseSearchRankings(text);

      return rankings
        .filter((r) => r.index >= 0 && r.index < emails.length)
        .sort((a, b) => b.score - a.score)
        .map((r) => ({
          email: emails[r.index],
          score: r.score / 100,
          snippet: r.reason,
        }));
    } catch (error) {
      console.error(`[${this.name}] Error in search, falling back to keyword search:`, error);
      return keywordSearch(query, emails);
    }
  }

  async suggestReply(thread: EmailThread): Promise<string> {
    if (thread.messages.length === 0) {
      return '';
    }

    const prompt = buildReplyPrompt(thread);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      console.error(`[${this.name}] Error in suggestReply:`, error);
      throw error;
    }
  }

  async isConfigured(): Promise<boolean> {
    try {
      // Use a minimal request to verify API key works
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      });
      return !!response.choices[0]?.message?.content;
    } catch {
      return false;
    }
  }
}

/**
 * Available Cerebras models (as of Dec 2025)
 *
 * Production models:
 * - llama-3.3-70b: Latest Llama, excellent quality
 * - llama-3.1-70b: Stable, well-tested
 * - llama-3.1-8b: Faster, smaller model
 *
 * Speed benchmarks (100 tokens):
 * - llama-3.1-70b: 574ms (fastest 70B anywhere)
 * - llama-3.1-8b: ~200ms
 */
export const CEREBRAS_MODELS = {
  'llama-3.3-70b': { context: 128000, speed: '~3000 t/s' },
  'llama-3.1-70b': { context: 128000, speed: '~3000 t/s' },
  'llama-3.1-8b': { context: 128000, speed: '~5000 t/s' },
} as const;
