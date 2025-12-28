import Conf from 'conf';
import { getSecureCredential } from '../cli/commands/config.js';

/**
 * Email context for AI operations
 */
export interface EmailContext {
  to?: string;
  from?: string;
  subject?: string;
  body?: string;
  context?: string;
  tone?: 'formal' | 'casual' | 'friendly' | 'professional';
}

/**
 * Email data structure
 */
export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  threadId?: string;
}

/**
 * Email thread for reply suggestions
 */
export interface EmailThread {
  id: string;
  subject: string;
  messages: Email[];
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  email: Email;
  score: number;
  snippet: string;
}

/**
 * AI Provider interface - all providers must implement these methods
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Generate an email draft based on context
   */
  generateDraft(context: EmailContext): Promise<string>;

  /**
   * Summarize a list of emails
   */
  summarize(emails: Email[]): Promise<string>;

  /**
   * Semantic search across emails
   */
  search(query: string, emails: Email[]): Promise<SearchResult[]>;

  /**
   * Suggest a reply to an email thread
   */
  suggestReply(thread: EmailThread): Promise<string>;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): Promise<boolean>;
}

/**
 * Supported AI provider types
 *
 * Auto (recommended):
 * - auto: Multi-provider router with automatic fallback (Groq → Cerebras → Ollama)
 *
 * Free tier providers:
 * - groq: 14,400 req/day, fastest (280-1200 t/s)
 * - cerebras: 1M tokens/day, very fast (3000+ t/s)
 * - ollama: Unlimited local, offline capable
 *
 * Paid/API key required:
 * - vertex: Google Cloud (requires GCP project)
 * - openai: OpenAI API (requires API key)
 * - anthropic: Claude API (requires API key)
 */
export type ProviderType = 'auto' | 'vertex' | 'openai' | 'anthropic' | 'ollama' | 'groq' | 'cerebras' | 'none';

/**
 * Provider configuration from user settings
 */
export interface ProviderConfig {
  type: ProviderType;
  gcpProject?: string;
  gcpLocation?: string;
  ollamaHost?: string;
}

/**
 * Get the current provider configuration from user settings
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const conf = new Conf<{
    aiProvider: ProviderType;
    gcpProject?: string;
    gcpLocation?: string;
    ollamaHost?: string;
  }>({ projectName: 'intentmail' });

  return {
    type: conf.get('aiProvider') ?? 'none',
    gcpProject: conf.get('gcpProject'),
    gcpLocation: conf.get('gcpLocation') ?? 'us-central1',
    ollamaHost: conf.get('ollamaHost') ?? 'http://localhost:11434',
  };
}

/**
 * Create an AI provider instance based on configuration
 * Falls back to NoOpProvider if required configuration is missing
 */
export async function createProvider(config?: ProviderConfig): Promise<AIProvider> {
  const providerConfig = config ?? await getProviderConfig();
  const { NoOpProvider } = await import('./noop.js');

  switch (providerConfig.type) {
    case 'auto': {
      // Use MultiProviderRouter for automatic failover
      const { MultiProviderRouter } = await import('./router.js');
      return MultiProviderRouter.create();
    }

    case 'vertex': {
      if (!providerConfig.gcpProject) {
        console.error('Vertex AI requires gcpProject. Falling back to NoOpProvider.');
        return new NoOpProvider();
      }
      const { VertexAIProvider } = await import('./vertex.js');
      return new VertexAIProvider({
        project: providerConfig.gcpProject,
        location: providerConfig.gcpLocation ?? 'us-central1',
      });
    }

    case 'openai': {
      const apiKey = await getSecureCredential('openai-api-key');
      if (!apiKey) {
        console.error('OpenAI requires API key. Run `intentmail config`. Falling back to NoOpProvider.');
        return new NoOpProvider();
      }
      const { OpenAIProvider } = await import('./openai.js');
      return new OpenAIProvider({ apiKey });
    }

    case 'anthropic': {
      const apiKey = await getSecureCredential('anthropic-api-key');
      if (!apiKey) {
        console.error('Anthropic requires API key. Run `intentmail config`. Falling back to NoOpProvider.');
        return new NoOpProvider();
      }
      const { AnthropicProvider } = await import('./anthropic.js');
      return new AnthropicProvider({ apiKey });
    }

    case 'ollama': {
      const { OllamaProvider } = await import('./ollama.js');
      return new OllamaProvider({
        host: providerConfig.ollamaHost ?? 'http://localhost:11434',
      });
    }

    case 'groq': {
      const apiKey = await getSecureCredential('groq-api-key');
      if (!apiKey) {
        console.error('Groq requires API key. Run `intentmail config`. Falling back to NoOpProvider.');
        return new NoOpProvider();
      }
      const { GroqProvider } = await import('./groq.js');
      return new GroqProvider({ apiKey });
    }

    case 'cerebras': {
      const apiKey = await getSecureCredential('cerebras-api-key');
      if (!apiKey) {
        console.error('Cerebras requires API key. Run `intentmail config`. Falling back to NoOpProvider.');
        return new NoOpProvider();
      }
      const { CerebrasProvider } = await import('./cerebras.js');
      return new CerebrasProvider({ apiKey });
    }

    case 'none':
    default: {
      return new NoOpProvider();
    }
  }
}

/**
 * Get the current AI provider based on user configuration
 */
export async function getProvider(): Promise<AIProvider> {
  return createProvider();
}
