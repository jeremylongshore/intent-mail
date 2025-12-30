/**
 * Thread Comments System
 *
 * Enables team members to add internal comments to email threads.
 *
 * E5.S5.3: Thread Comments
 */

import { z } from 'zod';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Comment mention
 */
export interface CommentMention {
  userId: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Comment reaction
 */
export interface CommentReaction {
  emoji: string;
  userIds: string[];
}

/**
 * Thread comment
 */
export interface ThreadComment {
  id: string;
  /** Thread ID this comment belongs to */
  threadId: string;
  /** Channel ID for the shared inbox */
  channelId: string;
  /** User who created the comment */
  authorId: string;
  /** Comment content (markdown supported) */
  content: string;
  /** Mentioned users in the comment */
  mentions: CommentMention[];
  /** Reactions to the comment */
  reactions: CommentReaction[];
  /** Parent comment ID for replies */
  parentId?: string;
  /** Whether this is a resolution note */
  isResolution: boolean;
  /** Attached files */
  attachments: {
    filename: string;
    url: string;
    size: number;
    mimeType: string;
  }[];
  /** Edit history */
  edits: {
    editedAt: Date;
    previousContent: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for creating comment
 */
export const CreateCommentSchema = z.object({
  threadId: z.string(),
  channelId: z.string(),
  content: z.string().min(1).max(10000),
  parentId: z.string().optional(),
  isResolution: z.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

// ============================================================
// Comment Store (In-Memory)
// ============================================================

const comments = new Map<string, ThreadComment>();
const threadComments = new Map<string, string[]>(); // threadId -> commentIds
let commentIdCounter = 1;

function generateCommentId(): string {
  return `comment-${commentIdCounter++}-${Date.now().toString(36)}`;
}

/**
 * Extract mentions from comment content
 */
function extractMentions(content: string): CommentMention[] {
  const mentions: CommentMention[] = [];
  const mentionRegex = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      userId: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

// ============================================================
// Comment Management
// ============================================================

/**
 * Create a new comment
 */
export function createComment(input: CreateCommentInput, authorId: string): ThreadComment {
  const validated = CreateCommentSchema.parse(input);
  const now = new Date();

  const comment: ThreadComment = {
    id: generateCommentId(),
    threadId: validated.threadId,
    channelId: validated.channelId,
    authorId,
    content: validated.content,
    mentions: extractMentions(validated.content),
    reactions: [],
    parentId: validated.parentId,
    isResolution: validated.isResolution,
    attachments: [],
    edits: [],
    createdAt: now,
    updatedAt: now,
  };

  comments.set(comment.id, comment);

  // Add to thread index
  const threadCommentIds = threadComments.get(validated.threadId) ?? [];
  threadCommentIds.push(comment.id);
  threadComments.set(validated.threadId, threadCommentIds);

  return comment;
}

/**
 * Get a comment by ID
 */
export function getComment(commentId: string): ThreadComment | undefined {
  return comments.get(commentId);
}

/**
 * Get all comments for a thread
 */
export function getThreadComments(threadId: string): ThreadComment[] {
  const commentIds = threadComments.get(threadId) ?? [];
  const threadCommentsArray: ThreadComment[] = [];

  for (const id of commentIds) {
    const comment = comments.get(id);
    if (comment) {
      threadCommentsArray.push(comment);
    }
  }

  // Sort by creation time, with top-level comments first
  return threadCommentsArray.sort((a, b) => {
    // Top-level comments first
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    // Then by creation time
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Get replies to a comment
 */
export function getCommentReplies(commentId: string): ThreadComment[] {
  const replies: ThreadComment[] = [];

  for (const comment of comments.values()) {
    if (comment.parentId === commentId) {
      replies.push(comment);
    }
  }

  return replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Edit a comment
 */
export function editComment(
  commentId: string,
  newContent: string,
  editorId: string
): boolean {
  const comment = comments.get(commentId);
  if (!comment) return false;

  // Only author can edit
  if (comment.authorId !== editorId) {
    throw new Error('Only the author can edit this comment');
  }

  // Save edit history
  comment.edits.push({
    editedAt: new Date(),
    previousContent: comment.content,
  });

  comment.content = newContent;
  comment.mentions = extractMentions(newContent);
  comment.updatedAt = new Date();

  return true;
}

/**
 * Delete a comment
 */
export function deleteComment(commentId: string, deleterId: string): boolean {
  const comment = comments.get(commentId);
  if (!comment) return false;

  // Only author can delete
  if (comment.authorId !== deleterId) {
    throw new Error('Only the author can delete this comment');
  }

  // Remove from thread index
  const threadCommentIds = threadComments.get(comment.threadId);
  if (threadCommentIds) {
    const index = threadCommentIds.indexOf(commentId);
    if (index > -1) {
      threadCommentIds.splice(index, 1);
    }
  }

  // Delete replies
  for (const reply of getCommentReplies(commentId)) {
    comments.delete(reply.id);
  }

  return comments.delete(commentId);
}

/**
 * Add reaction to comment
 */
export function addReaction(
  commentId: string,
  emoji: string,
  userId: string
): boolean {
  const comment = comments.get(commentId);
  if (!comment) return false;

  // Find existing reaction for this emoji
  let reaction = comment.reactions.find((r) => r.emoji === emoji);

  if (reaction) {
    // Add user if not already reacted
    if (!reaction.userIds.includes(userId)) {
      reaction.userIds.push(userId);
    }
  } else {
    // Create new reaction
    comment.reactions.push({
      emoji,
      userIds: [userId],
    });
  }

  comment.updatedAt = new Date();
  return true;
}

/**
 * Remove reaction from comment
 */
export function removeReaction(
  commentId: string,
  emoji: string,
  userId: string
): boolean {
  const comment = comments.get(commentId);
  if (!comment) return false;

  const reaction = comment.reactions.find((r) => r.emoji === emoji);
  if (!reaction) return false;

  const index = reaction.userIds.indexOf(userId);
  if (index > -1) {
    reaction.userIds.splice(index, 1);

    // Remove reaction if no users left
    if (reaction.userIds.length === 0) {
      comment.reactions = comment.reactions.filter((r) => r.emoji !== emoji);
    }
  }

  comment.updatedAt = new Date();
  return true;
}

/**
 * Get unread mentions for a user
 */
export function getUserMentions(
  userId: string,
  channelId?: string,
  since?: Date
): ThreadComment[] {
  const mentions: ThreadComment[] = [];

  for (const comment of comments.values()) {
    if (channelId && comment.channelId !== channelId) continue;
    if (since && comment.createdAt <= since) continue;

    if (comment.mentions.some((m) => m.userId === userId)) {
      mentions.push(comment);
    }
  }

  return mentions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get resolution notes for a thread
 */
export function getResolutionNotes(threadId: string): ThreadComment[] {
  const threadCommentList = getThreadComments(threadId);
  return threadCommentList.filter((c) => c.isResolution);
}

/**
 * Mark comment as resolution
 */
export function markAsResolution(commentId: string, userId: string): boolean {
  const comment = comments.get(commentId);
  if (!comment) return false;

  // Only author or admins should be able to mark as resolution
  // For now, allow the author
  if (comment.authorId !== userId) {
    throw new Error('Only the author can mark this as a resolution');
  }

  comment.isResolution = true;
  comment.updatedAt = new Date();
  return true;
}

/**
 * Get comment count for a thread
 */
export function getThreadCommentCount(threadId: string): number {
  return threadComments.get(threadId)?.length ?? 0;
}

/**
 * Get recent activity for a channel
 */
export function getChannelRecentComments(
  channelId: string,
  limit: number = 20
): ThreadComment[] {
  const channelComments: ThreadComment[] = [];

  for (const comment of comments.values()) {
    if (comment.channelId === channelId) {
      channelComments.push(comment);
    }
  }

  return channelComments
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
