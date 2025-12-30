/**
 * Shared Inbox Channels
 *
 * Enables teams to share email inboxes and collaborate on responses.
 *
 * E5.S5.1: Shared Inbox Channels
 */

import { z } from 'zod';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Channel member role
 */
export type ChannelRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Channel member
 */
export interface ChannelMember {
  userId: string;
  email: string;
  name?: string;
  role: ChannelRole;
  joinedAt: Date;
  notifications: {
    newEmails: boolean;
    mentions: boolean;
    assignments: boolean;
  };
}

/**
 * Shared inbox channel
 */
export interface SharedChannel {
  id: string;
  name: string;
  description?: string;
  /** Email address for the shared inbox */
  inboxEmail: string;
  /** Connected email account ID */
  accountId: number;
  /** Channel members */
  members: ChannelMember[];
  /** Labels/folders to sync */
  syncLabels: string[];
  /** Auto-assignment rules */
  autoAssignment: {
    enabled: boolean;
    strategy: 'round-robin' | 'load-balanced' | 'manual';
  };
  /** Channel settings */
  settings: {
    allowExternalReplies: boolean;
    requireApproval: boolean;
    signatureTemplate?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for channel creation
 */
export const CreateChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  inboxEmail: z.string().email(),
  accountId: z.number(),
  syncLabels: z.array(z.string()).default(['INBOX']),
  autoAssignment: z.object({
    enabled: z.boolean().default(false),
    strategy: z.enum(['round-robin', 'load-balanced', 'manual']).default('manual'),
  }).optional(),
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;

// ============================================================
// Channel Store (In-Memory)
// ============================================================

// In-memory channel storage (would be SQLite/database in production)
const channels = new Map<string, SharedChannel>();
let channelIdCounter = 1;

/**
 * Generate unique channel ID
 */
function generateChannelId(): string {
  return `channel-${channelIdCounter++}-${Date.now().toString(36)}`;
}

// ============================================================
// Channel Management
// ============================================================

/**
 * Create a new shared inbox channel
 */
export function createChannel(input: CreateChannelInput, ownerId: string, ownerEmail: string): SharedChannel {
  const validated = CreateChannelSchema.parse(input);
  const now = new Date();

  const channel: SharedChannel = {
    id: generateChannelId(),
    name: validated.name,
    description: validated.description,
    inboxEmail: validated.inboxEmail,
    accountId: validated.accountId,
    members: [
      {
        userId: ownerId,
        email: ownerEmail,
        role: 'owner',
        joinedAt: now,
        notifications: {
          newEmails: true,
          mentions: true,
          assignments: true,
        },
      },
    ],
    syncLabels: validated.syncLabels,
    autoAssignment: validated.autoAssignment ?? {
      enabled: false,
      strategy: 'manual',
    },
    settings: {
      allowExternalReplies: true,
      requireApproval: false,
    },
    createdAt: now,
    updatedAt: now,
  };

  channels.set(channel.id, channel);
  return channel;
}

/**
 * Get a channel by ID
 */
export function getChannel(channelId: string): SharedChannel | undefined {
  return channels.get(channelId);
}

/**
 * List all channels a user belongs to
 */
export function getUserChannels(userId: string): SharedChannel[] {
  const userChannels: SharedChannel[] = [];
  for (const channel of channels.values()) {
    if (channel.members.some((m) => m.userId === userId)) {
      userChannels.push(channel);
    }
  }
  return userChannels;
}

/**
 * Add a member to a channel
 */
export function addChannelMember(
  channelId: string,
  member: Omit<ChannelMember, 'joinedAt'>,
  requesterId: string
): ChannelMember | null {
  const channel = channels.get(channelId);
  if (!channel) return null;

  // Check requester permissions
  const requester = channel.members.find((m) => m.userId === requesterId);
  if (!requester || !['owner', 'admin'].includes(requester.role)) {
    throw new Error('Insufficient permissions to add members');
  }

  // Check if member already exists
  if (channel.members.some((m) => m.userId === member.userId)) {
    throw new Error('User is already a member of this channel');
  }

  const newMember: ChannelMember = {
    ...member,
    joinedAt: new Date(),
  };

  channel.members.push(newMember);
  channel.updatedAt = new Date();
  return newMember;
}

/**
 * Remove a member from a channel
 */
export function removeChannelMember(
  channelId: string,
  memberUserId: string,
  requesterId: string
): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;

  // Check requester permissions
  const requester = channel.members.find((m) => m.userId === requesterId);
  if (!requester || !['owner', 'admin'].includes(requester.role)) {
    throw new Error('Insufficient permissions to remove members');
  }

  // Cannot remove the owner
  const memberToRemove = channel.members.find((m) => m.userId === memberUserId);
  if (memberToRemove?.role === 'owner') {
    throw new Error('Cannot remove the channel owner');
  }

  const initialLength = channel.members.length;
  channel.members = channel.members.filter((m) => m.userId !== memberUserId);
  channel.updatedAt = new Date();

  return channel.members.length < initialLength;
}

/**
 * Update member role
 */
export function updateMemberRole(
  channelId: string,
  memberUserId: string,
  newRole: ChannelRole,
  requesterId: string
): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;

  // Only owner can change roles
  const requester = channel.members.find((m) => m.userId === requesterId);
  if (!requester || requester.role !== 'owner') {
    throw new Error('Only channel owner can change roles');
  }

  // Cannot change owner's role
  if (memberUserId === requesterId && newRole !== 'owner') {
    throw new Error('Cannot demote yourself from owner');
  }

  const member = channel.members.find((m) => m.userId === memberUserId);
  if (!member) return false;

  member.role = newRole;
  channel.updatedAt = new Date();
  return true;
}

/**
 * Update channel settings
 */
export function updateChannelSettings(
  channelId: string,
  updates: Partial<SharedChannel['settings']>,
  requesterId: string
): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;

  // Check requester permissions
  const requester = channel.members.find((m) => m.userId === requesterId);
  if (!requester || !['owner', 'admin'].includes(requester.role)) {
    throw new Error('Insufficient permissions to update settings');
  }

  channel.settings = { ...channel.settings, ...updates };
  channel.updatedAt = new Date();
  return true;
}

/**
 * Delete a channel
 */
export function deleteChannel(channelId: string, requesterId: string): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;

  // Only owner can delete
  const requester = channel.members.find((m) => m.userId === requesterId);
  if (!requester || requester.role !== 'owner') {
    throw new Error('Only channel owner can delete the channel');
  }

  return channels.delete(channelId);
}

/**
 * Get channel members
 */
export function getChannelMembers(channelId: string): ChannelMember[] {
  const channel = channels.get(channelId);
  return channel?.members ?? [];
}

/**
 * Check if user has permission in channel
 */
export function hasChannelPermission(
  channelId: string,
  userId: string,
  requiredRoles: ChannelRole[]
): boolean {
  const channel = channels.get(channelId);
  if (!channel) return false;

  const member = channel.members.find((m) => m.userId === userId);
  if (!member) return false;

  return requiredRoles.includes(member.role);
}
