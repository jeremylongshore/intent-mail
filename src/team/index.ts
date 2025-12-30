/**
 * Team Collaboration Module
 *
 * Enables teams to collaborate on email management with shared inboxes,
 * assignments, comments, and analytics.
 *
 * E5: Team Collaboration Epic
 */

// Shared Inbox Channels (S5.1)
export {
  // Types
  type ChannelRole,
  type ChannelMember,
  type SharedChannel,
  type CreateChannelInput,
  // Functions
  createChannel,
  getChannel,
  getUserChannels,
  addChannelMember,
  removeChannelMember,
  updateMemberRole,
  updateChannelSettings,
  deleteChannel,
  getChannelMembers,
  hasChannelPermission,
  // Schema
  CreateChannelSchema,
} from './shared-inbox.js';

// Email Assignment (S5.2)
export {
  // Types
  type AssignmentStatus,
  type EmailAssignment,
  type AssignmentActivity,
  type CreateAssignmentInput,
  // Functions
  createAssignment,
  getAssignment,
  getEmailAssignment,
  getUserAssignments,
  getChannelAssignments,
  reassignEmail,
  updateAssignmentStatus,
  addAssignmentNote,
  updateAssignmentPriority,
  setAssignmentDueDate,
  getOverdueAssignments,
  getAssignmentWorkload,
  autoAssignRoundRobin,
  // Schema
  CreateAssignmentSchema,
} from './assignment.js';

// Thread Comments (S5.3)
export {
  // Types
  type CommentMention,
  type CommentReaction,
  type ThreadComment,
  type CreateCommentInput,
  // Functions
  createComment,
  getComment,
  getThreadComments,
  getCommentReplies,
  editComment,
  deleteComment,
  addReaction,
  removeReaction,
  getUserMentions,
  getResolutionNotes,
  markAsResolution,
  getThreadCommentCount,
  getChannelRecentComments,
  // Schema
  CreateCommentSchema,
} from './comments.js';

// Team Analytics (S5.4)
export {
  // Types
  type AnalyticsPeriod,
  type MemberMetrics,
  type ChannelMetrics,
  type TrendPoint,
  type AnalyticsDashboard,
  // Functions
  calculateMemberMetrics,
  calculateChannelMetrics,
  generateTrends,
  generateAlerts,
  generateAnalyticsDashboard,
  exportAnalyticsCSV,
} from './analytics.js';
