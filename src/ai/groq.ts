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
 * Groq API Configuration
 *
 * Groq provides ultra-fast inference (280-1200 tokens/sec)
 * Free tier: 14,400 requests/day (no credit card required)
 * API is OpenAI-compatible - just change base URL
 */
interface GroqConfig {
  apiKey: string;
  model?: string;
}

/**
 * Groq API provider implementation
 *
 * Recommended as PRIMARY provider due to:
 * - Speed: 280-1200 tokens/sec (5-18x faster than alternatives)
 * - Free tier: 14,400 requests/day
 * - Models: Llama 3.1/3.3, Mixtral, Gemma 2
 * - Latency: ~0.2 seconds
 *
 * Sign up: https://console.groq.com (no credit card)
 */
export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly model: string;
  private client: OpenAI;

  constructor(config: GroqConfig) {
    // Default to Llama 3.3 70B - best quality/speed balance on free tier
    this.model = config.model ?? 'llama-3.3-70b-versatile';
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
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
 * Available Groq models (as of Dec 2025)
 *
 * Production models (recommended):
 * - llama-3.3-70b-versatile: Best quality, 128K context
 * - llama-3.1-70b-versatile: Stable, well-tested
 * - mixtral-8x7b-32768: Fast, good for longer contexts
 *
 * Speed-optimized:
 * - llama-3.1-8b-instant: Very fast, smaller model
 * - gemma2-9b-it: Google's efficient model
 *
 * Preview/experimental:
 * - llama-3.2-90b-vision-preview: Multimodal
 */
export const GROQ_MODELS = {
  'llama-3.3-70b-versatile': { context: 128000, speed: '~300 t/s' },
  'llama-3.1-70b-versatile': { context: 131072, speed: '~280 t/s' },
  'llama-3.1-8b-instant': { context: 131072, speed: '~800 t/s' },
  'mixtral-8x7b-32768': { context: 32768, speed: '~430 t/s' },
  'gemma2-9b-it': { context: 8192, speed: '~800 t/s' },
} as const;
