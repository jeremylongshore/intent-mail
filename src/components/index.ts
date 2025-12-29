/**
 * Shared Component Layer
 *
 * Platform-agnostic components that transform data into render-ready format.
 * These components contain business logic but no platform-specific code.
 *
 * E1.S1.2: Multi-Surface Adapter Pattern
 */

// EmailList exports
export {
  useEmailList,
  type EmailListItem,
  type EmailListRenderData,
  type EmailListActions,
} from './EmailList.js';

// EmailDetail exports
export {
  useEmailDetail,
  type EmailDetailRenderData,
  type EmailDetailActions,
  type FormattedAddress,
  type FormattedAttachment,
} from './EmailDetail.js';

// ComposeForm exports
export {
  useComposeForm,
  getNextField,
  type ComposeField,
  type ComposeFormRenderData,
  type ComposeFormActions,
  type ValidationResult,
} from './ComposeForm.js';

// SearchPanel exports
export {
  useSearchPanel,
  validateSearchQuery,
  type SearchPanelRenderData,
  type SearchPanelActions,
  type SearchResultItem,
} from './SearchPanel.js';
