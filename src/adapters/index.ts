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

// Adapters
export { InkAdapter, createInkAdapter } from './ink-adapter.js';
export { ReacordAdapter, createReacordAdapter, isDiscordAvailable } from './reacord-adapter.js';
export { DomAdapter, createDomAdapter, isWebAvailable } from './dom-adapter.js';
