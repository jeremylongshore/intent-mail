/**
 * Multi-Surface Adapters
 *
 * Platform-agnostic rendering for IntentMail.
 * Supports Terminal (Ink), Discord (Reacord), and Web (React DOM).
 *
 * E1: Multi-Surface Architecture
 *
 * Usage:
 * ```typescript
 * import { initializeAdapters, detectBestTarget } from './adapters';
 *
 * const registry = await initializeAdapters();
 * const target = detectBestTarget();
 * registry.setActive(target);
 *
 * const adapter = registry.active();
 * await adapter.initialize();
 * adapter.render(emailConnector);
 * ```
 */

// Types
export type {
  RenderTarget,
  PlatformCapabilities,
  PlatformAdapter,
  AdapterRegistry,
  EmailListProps,
  EmailDetailProps,
  ComposeProps,
  SearchProps,
  NotificationProps,
  AppEvent,
  EventHandler,
  AppState,
  StateSubscriber,
  StateManager,
} from './types.js';

// Registry
export {
  getAdapterRegistry,
  initializeAdapters,
  detectBestTarget,
} from './registry.js';

// Platform-specific adapters (loaded dynamically when their platform is detected)
// These are excluded from the main build to reduce dependencies:
// - ink-adapter.ts: Terminal rendering (requires: ink, react)
// - reacord-adapter.ts: Discord rendering (requires: discord.js, reacord)
// - dom-adapter.ts: Web rendering (built separately via Vite)
//
// Use getAdapterRegistry() to access adapters at runtime.
