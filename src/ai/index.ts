/**
 * AI Provider Layer
 *
 * Pluggable AI provider abstraction supporting:
 * - Vertex AI (Gemini)
 * - OpenAI (GPT)
 * - Anthropic (Claude)
 * - Ollama (Local LLMs)
 */

export {
  type AIProvider,
  type EmailContext,
  type Email,
  type EmailThread,
  type SearchResult,
  type ProviderType,
  type ProviderConfig,
  createProvider,
  getProvider,
  getProviderConfig,
} from './provider.js';

export { VertexAIProvider } from './vertex.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OllamaProvider } from './ollama.js';
export { GroqProvider, GROQ_MODELS } from './groq.js';
export { CerebrasProvider, CEREBRAS_MODELS } from './cerebras.js';
export { MultiProviderRouter, type RouterConfig, type RouterStats } from './router.js';
export { NoOpProvider } from './noop.js';

// Summarizer
export {
  summarizeEmail,
  summarizeThread,
  batchSummarize,
  type EmailSummary,
  type EmailSentiment,
  type EmailCategory,
} from './summarizer.js';

// Draft Generator
export {
  generateDraft,
  generateQuickReply,
  suggestReply,
  improveDraft,
  generateDraftVariations,
  type DraftTone,
  type DraftIntent,
  type DraftOptions,
  type GeneratedDraft,
} from './draft-generator.js';
