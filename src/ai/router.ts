import type {
  AIProvider,
  EmailContext,
  Email,
  EmailThread,
  SearchResult,
} from './provider.js';

/**
 * Provider health status
 */
interface ProviderHealth {
  healthy: boolean;
  lastCheck: number;
  failureCount: number;
  lastError?: string;
}

/**
 * Router statistics
 */
export interface RouterStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  providerUsage: Record<string, number>;
  averageLatency: number;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Health check interval in ms (default: 5 minutes) */
  healthCheckInterval?: number;
  /** Max consecutive failures before marking unhealthy (default: 3) */
  maxFailures?: number;
  /** Recovery time before retrying unhealthy provider in ms (default: 1 minute) */
  recoveryTime?: number;
  /** Request timeout in ms (default: 30 seconds) */
  requestTimeout?: number;
}

const DEFAULT_CONFIG: Required<RouterConfig> = {
  healthCheckInterval: 5 * 60 * 1000, // 5 minutes
  maxFailures: 3,
  recoveryTime: 60 * 1000, // 1 minute
  requestTimeout: 30 * 1000, // 30 seconds
};

/**
 * MultiProviderRouter - Intelligent AI provider fallback chain
 *
 * Implements AIProvider interface with automatic failover:
 * 1. Groq (primary) - 14,400 req/day, fastest
 * 2. Cerebras (secondary) - 1M tokens/day, very fast
 * 3. Ollama (offline) - unlimited, always available
 *
 * Features:
 * - Automatic failover on provider errors
 * - Health tracking with circuit breaker pattern
 * - Statistics and usage tracking
 * - Zero-cost operation using free tiers
 *
 * @example
 * ```typescript
 * const router = await MultiProviderRouter.create();
 * const draft = await router.generateDraft({ to: 'user@example.com', context: 'Meeting follow-up' });
 * console.log(router.getStats()); // See provider usage
 * ```
 */
export class MultiProviderRouter implements AIProvider {
  readonly name = 'router';
  readonly model = 'auto';

  private providers: AIProvider[] = [];
  private health: Map<string, ProviderHealth> = new Map();
  private config: Required<RouterConfig>;
  private stats: RouterStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    providerUsage: {},
    averageLatency: 0,
  };
  private latencySum = 0;

  private constructor(config: RouterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Safely get credential - returns null if keytar not available
   */
  private async safeGetCredential(key: string): Promise<string | null> {
    try {
      const { getSecureCredential } = await import('../cli/commands/config.js');
      return await getSecureCredential(key);
    } catch {
      // keytar not available (libsecret missing)
      return null;
    }
  }

  /**
   * Create a new MultiProviderRouter with available providers
   *
   * Checks which providers are configured and adds them to the chain
   */
  static async create(config: RouterConfig = {}): Promise<MultiProviderRouter> {
    const router = new MultiProviderRouter(config);
    await router.initializeProviders();
    return router;
  }

  /**
   * Initialize providers based on available API keys/config
   */
  private async initializeProviders(): Promise<void> {
    // Priority order: Vertex AI (GCP) → Groq (fast + free) → Cerebras (most tokens) → Ollama (offline)

    // 1. Try Vertex AI (uses ADC - Application Default Credentials)
    // Works with: gcloud auth application-default login, WIF, service accounts
    const gcpProject = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    if (gcpProject) {
      try {
        const { VertexAIProvider } = await import('./vertex.js');
        const provider = new VertexAIProvider({
          project: gcpProject,
          location: process.env.GCP_LOCATION || process.env.GOOGLE_CLOUD_REGION || 'us-central1',
        });
        this.addProvider(provider);
        console.error(`[router] Vertex AI enabled for project: ${gcpProject}`);
      } catch (error) {
        console.error('[router] Vertex AI not available:', (error as Error).message);
      }
    }

    // 2. Try Groq (env var or keytar)
    const groqKey = process.env.GROQ_API_KEY || await this.safeGetCredential('groq-api-key');
    if (groqKey) {
      const { GroqProvider } = await import('./groq.js');
      const provider = new GroqProvider({ apiKey: groqKey });
      this.addProvider(provider);
    }

    // 3. Try Cerebras (env var or keytar)
    const cerebrasKey = process.env.CEREBRAS_API_KEY || await this.safeGetCredential('cerebras-api-key');
    if (cerebrasKey) {
      const { CerebrasProvider } = await import('./cerebras.js');
      const provider = new CerebrasProvider({ apiKey: cerebrasKey });
      this.addProvider(provider);
    }

    // Verify at least one provider is available
    if (this.providers.length === 0) {
      const { NoOpProvider } = await import('./noop.js');
      this.addProvider(new NoOpProvider());
      console.warn('[router] No providers configured. Using NoOpProvider.');
    }

    console.error(`[router] Initialized with ${this.providers.length} providers: ${this.providers.map(p => p.name).join(' → ')}`);
  }

  /**
   * Add a provider to the chain
   */
  private addProvider(provider: AIProvider): void {
    this.providers.push(provider);
    this.health.set(provider.name, {
      healthy: true,
      lastCheck: Date.now(),
      failureCount: 0,
    });
    this.stats.providerUsage[provider.name] = 0;
  }

  /**
   * Check if a provider is healthy and should be tried
   */
  private isProviderHealthy(providerName: string): boolean {
    const health = this.health.get(providerName);
    if (!health) return false;

    // If healthy, use it
    if (health.healthy) return true;

    // If unhealthy, check if recovery time has passed
    const timeSinceFailure = Date.now() - health.lastCheck;
    if (timeSinceFailure >= this.config.recoveryTime) {
      // Reset for retry
      health.healthy = true;
      health.failureCount = 0;
      console.error(`[router] ${providerName} recovery period ended, retrying`);
      return true;
    }

    return false;
  }

  /**
   * Mark a provider as failed
   */
  private markProviderFailed(providerName: string, error: Error): void {
    const health = this.health.get(providerName);
    if (!health) return;

    health.failureCount++;
    health.lastCheck = Date.now();
    health.lastError = error.message;

    if (health.failureCount >= this.config.maxFailures) {
      health.healthy = false;
      console.error(`[router] ${providerName} marked unhealthy after ${health.failureCount} failures: ${error.message}`);
    }
  }

  /**
   * Mark a provider as successful
   */
  private markProviderSuccess(providerName: string): void {
    const health = this.health.get(providerName);
    if (!health) return;

    health.healthy = true;
    health.failureCount = 0;
    health.lastCheck = Date.now();
    delete health.lastError;
  }

  /**
   * Execute an operation with automatic fallback
   */
  private async executeWithFallback<T>(
    operation: (provider: AIProvider) => Promise<T>,
    operationName: string
  ): Promise<T> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    for (const provider of this.providers) {
      if (!this.isProviderHealthy(provider.name)) {
        continue;
      }

      try {
        const result = await operation(provider);

        // Success - update stats
        this.markProviderSuccess(provider.name);
        this.stats.successfulRequests++;
        this.stats.providerUsage[provider.name]++;

        const latency = Date.now() - startTime;
        this.latencySum += latency;
        this.stats.averageLatency = this.latencySum / this.stats.successfulRequests;

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[router] ${provider.name}.${operationName} failed:`, err.message);
        this.markProviderFailed(provider.name, err);
        // Continue to next provider
      }
    }

    // All providers failed
    this.stats.failedRequests++;
    throw new Error(`All providers failed for ${operationName}. Check provider configuration.`);
  }

  // ============================================================
  // AIProvider interface implementation
  // ============================================================

  async generateDraft(context: EmailContext): Promise<string> {
    return this.executeWithFallback(
      (provider) => provider.generateDraft(context),
      'generateDraft'
    );
  }

  async summarize(emails: Email[]): Promise<string> {
    if (emails.length === 0) {
      return 'No emails to summarize.';
    }
    return this.executeWithFallback(
      (provider) => provider.summarize(emails),
      'summarize'
    );
  }

  async search(query: string, emails: Email[]): Promise<SearchResult[]> {
    if (emails.length === 0) {
      return [];
    }
    return this.executeWithFallback(
      (provider) => provider.search(query, emails),
      'search'
    );
  }

  async suggestReply(thread: EmailThread): Promise<string> {
    if (thread.messages.length === 0) {
      return '';
    }
    return this.executeWithFallback(
      (provider) => provider.suggestReply(thread),
      'suggestReply'
    );
  }

  async isConfigured(): Promise<boolean> {
    // Router is configured if at least one provider works
    for (const provider of this.providers) {
      if (await provider.isConfigured()) {
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // Router-specific methods
  // ============================================================

  /**
   * Get router statistics
   */
  getStats(): RouterStats {
    return { ...this.stats };
  }

  /**
   * Get health status of all providers
   */
  getHealth(): Record<string, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};
    for (const [name, health] of this.health) {
      result[name] = { ...health };
    }
    return result;
  }

  /**
   * Get list of provider names in priority order
   */
  getProviders(): string[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Force a health check on all providers
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.providers) {
      try {
        const isHealthy = await provider.isConfigured();
        results[provider.name] = isHealthy;

        if (isHealthy) {
          this.markProviderSuccess(provider.name);
        } else {
          this.markProviderFailed(provider.name, new Error('isConfigured returned false'));
        }
      } catch (error) {
        results[provider.name] = false;
        const err = error instanceof Error ? error : new Error(String(error));
        this.markProviderFailed(provider.name, err);
      }
    }

    return results;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      providerUsage: Object.fromEntries(this.providers.map((p) => [p.name, 0])),
      averageLatency: 0,
    };
    this.latencySum = 0;
  }
}
