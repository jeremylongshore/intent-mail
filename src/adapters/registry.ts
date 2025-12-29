/**
 * Adapter Registry
 *
 * Manages platform adapters for multi-surface rendering.
 * Provides discovery, selection, and lifecycle management.
 *
 * E1.S1.1: Adapter Pattern Foundation
 */

import type {
  PlatformAdapter,
  AdapterRegistry,
  RenderTarget,
} from './types.js';

/**
 * Default adapter registry implementation
 */
class DefaultAdapterRegistry implements AdapterRegistry {
  private adapters = new Map<RenderTarget, PlatformAdapter>();
  private activeTarget: RenderTarget | null = null;

  register(adapter: PlatformAdapter): void {
    if (this.adapters.has(adapter.target)) {
      console.warn(`Adapter for ${adapter.target} already registered, replacing`);
    }
    this.adapters.set(adapter.target, adapter);
  }

  get(target: RenderTarget): PlatformAdapter | undefined {
    return this.adapters.get(target);
  }

  all(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  active(): PlatformAdapter | undefined {
    if (!this.activeTarget) return undefined;
    return this.adapters.get(this.activeTarget);
  }

  setActive(target: RenderTarget): void {
    if (!this.adapters.has(target)) {
      throw new Error(`No adapter registered for target: ${target}`);
    }
    this.activeTarget = target;
  }
}

// Singleton registry instance
let registryInstance: AdapterRegistry | null = null;

/**
 * Get the global adapter registry
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!registryInstance) {
    registryInstance = new DefaultAdapterRegistry();
  }
  return registryInstance;
}

/**
 * Initialize all available adapters
 * Registers adapters based on environment capabilities
 */
export async function initializeAdapters(): Promise<AdapterRegistry> {
  const registry = getAdapterRegistry();

  // Always register terminal adapter (primary)
  const { createInkAdapter } = await import('./ink-adapter.js');
  registry.register(createInkAdapter());

  // Discord adapter (when token available)
  try {
    const { createReacordAdapter, isDiscordAvailable } = await import('./reacord-adapter.js');
    if (isDiscordAvailable()) {
      registry.register(createReacordAdapter());
    }
  } catch {
    // Discord dependencies not installed
  }

  // Web adapter (browser only)
  try {
    const { createDomAdapter, isWebAvailable } = await import('./dom-adapter.js');
    if (isWebAvailable()) {
      registry.register(createDomAdapter());
    }
  } catch {
    // Web dependencies not available in Node
  }

  return registry;
}

/**
 * Detect the best adapter for the current environment
 */
export function detectBestTarget(): RenderTarget {
  // Browser environment → web
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    return 'web';
  }

  // Discord bot context → discord
  if (process.env.DISCORD_BOT_TOKEN && process.env.INTENT_MAIL_DISCORD_MODE) {
    return 'discord';
  }

  // Default → terminal
  return 'terminal';
}
