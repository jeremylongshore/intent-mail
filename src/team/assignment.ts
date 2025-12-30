/**
 * Email Assignment System
 *
 * Enables assigning emails to team members and tracking ownership.
 *
 * E5.S5.2: Email Assignment
 */

import { z } from 'zod';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Assignment status
 */
export type AssignmentStatus = 'pending' | 'in_progress' | 'needs_review' | 'completed' | 'escalated';

/**
 * Email assignment
 */
export interface EmailAssignment {
  id: string;
  /** Email ID being assigned */
  emailId: string;
  /** Thread ID for the email */
  threadId?: string;
  /** Channel this assignment belongs to */
  channelId: string;
  /** User assigned to handle this email */
  assigneeId: string;
  /** User who made the assignment */
  assignerId: string;
  /** Current status */
  status: AssignmentStatus;
  /** Priority level (1-5, 1 being highest) */
  priority: number;
  /** Due date for response */
  dueDate?: Date;
  /** Notes about the assignment */
  notes?: string;
  /** Tags for categorization */
  tags: string[];
  /** SLA tracking */
  sla?: {
    responseRequired: boolean;
    responseDeadline: Date;
    breached: boolean;
  };
  /** Activity log */
  history: AssignmentActivity[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assignment activity log entry
 */
export interface AssignmentActivity {
  id: string;
  action: 'created' | 'reassigned' | 'status_changed' | 'note_added' | 'completed' | 'escalated';
  userId: string;
  details: string;
  timestamp: Date;
}

/**
 * Zod schema for creating assignment
 */
export const CreateAssignmentSchema = z.object({
  emailId: z.string(),
  threadId: z.string().optional(),
  channelId: z.string(),
  assigneeId: z.string(),
  priority: z.number().min(1).max(5).default(3),
  dueDate: z.date().optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

// ============================================================
// Assignment Store (In-Memory)
// ============================================================

const assignments = new Map<string, EmailAssignment>();
const emailAssignments = new Map<string, string>(); // emailId -> assignmentId
let assignmentIdCounter = 1;

function generateAssignmentId(): string {
  return `assign-${assignmentIdCounter++}-${Date.now().toString(36)}`;
}

function generateActivityId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Assignment Management
// ============================================================

/**
 * Create a new email assignment
 */
export function createAssignment(input: CreateAssignmentInput, assignerId: string): EmailAssignment {
  const validated = CreateAssignmentSchema.parse(input);
  const now = new Date();

  // Check if email is already assigned
  if (emailAssignments.has(validated.emailId)) {
    throw new Error('Email is already assigned. Use reassign to change assignee.');
  }

  const assignment: EmailAssignment = {
    id: generateAssignmentId(),
    emailId: validated.emailId,
    threadId: validated.threadId,
    channelId: validated.channelId,
    assigneeId: validated.assigneeId,
    assignerId,
    status: 'pending',
    priority: validated.priority,
    dueDate: validated.dueDate,
    notes: validated.notes,
    tags: validated.tags,
    history: [
      {
        id: generateActivityId(),
        action: 'created',
        userId: assignerId,
        details: `Assigned to user ${validated.assigneeId}`,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  assignments.set(assignment.id, assignment);
  emailAssignments.set(validated.emailId, assignment.id);
  return assignment;
}

/**
 * Get assignment by ID
 */
export function getAssignment(assignmentId: string): EmailAssignment | undefined {
  return assignments.get(assignmentId);
}

/**
 * Get assignment for an email
 */
export function getEmailAssignment(emailId: string): EmailAssignment | undefined {
  const assignmentId = emailAssignments.get(emailId);
  if (!assignmentId) return undefined;
  return assignments.get(assignmentId);
}

/**
 * Get all assignments for a user
 */
export function getUserAssignments(userId: string, status?: AssignmentStatus): EmailAssignment[] {
  const userAssignments: EmailAssignment[] = [];
  for (const assignment of assignments.values()) {
    if (assignment.assigneeId === userId) {
      if (!status || assignment.status === status) {
        userAssignments.push(assignment);
      }
    }
  }
  return userAssignments.sort((a, b) => a.priority - b.priority);
}

/**
 * Get all assignments for a channel
 */
export function getChannelAssignments(channelId: string, status?: AssignmentStatus): EmailAssignment[] {
  const channelAssignments: EmailAssignment[] = [];
  for (const assignment of assignments.values()) {
    if (assignment.channelId === channelId) {
      if (!status || assignment.status === status) {
        channelAssignments.push(assignment);
      }
    }
  }
  return channelAssignments.sort((a, b) => a.priority - b.priority);
}

/**
 * Reassign email to another user
 */
export function reassignEmail(
  assignmentId: string,
  newAssigneeId: string,
  reassignerId: string,
  reason?: string
): boolean {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return false;

  const oldAssigneeId = assignment.assigneeId;
  assignment.assigneeId = newAssigneeId;
  assignment.updatedAt = new Date();

  assignment.history.push({
    id: generateActivityId(),
    action: 'reassigned',
    userId: reassignerId,
    details: `Reassigned from ${oldAssigneeId} to ${newAssigneeId}${reason ? `: ${reason}` : ''}`,
    timestamp: new Date(),
  });

  return true;
}

/**
 * Update assignment status
 */
export function updateAssignmentStatus(
  assignmentId: string,
  newStatus: AssignmentStatus,
  userId: string,
  notes?: string
): boolean {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return false;

  const oldStatus = assignment.status;
  assignment.status = newStatus;
  assignment.updatedAt = new Date();

  assignment.history.push({
    id: generateActivityId(),
    action: newStatus === 'completed' ? 'completed' : newStatus === 'escalated' ? 'escalated' : 'status_changed',
    userId,
    details: `Status changed from ${oldStatus} to ${newStatus}${notes ? `: ${notes}` : ''}`,
    timestamp: new Date(),
  });

  return true;
}

/**
 * Add note to assignment
 */
export function addAssignmentNote(
  assignmentId: string,
  note: string,
  userId: string
): boolean {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return false;

  assignment.notes = assignment.notes ? `${assignment.notes}\n\n${note}` : note;
  assignment.updatedAt = new Date();

  assignment.history.push({
    id: generateActivityId(),
    action: 'note_added',
    userId,
    details: note.length > 100 ? note.slice(0, 100) + '...' : note,
    timestamp: new Date(),
  });

  return true;
}

/**
 * Update assignment priority
 */
export function updateAssignmentPriority(
  assignmentId: string,
  priority: number,
  userId: string
): boolean {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return false;

  if (priority < 1 || priority > 5) {
    throw new Error('Priority must be between 1 and 5');
  }

  const oldPriority = assignment.priority;
  assignment.priority = priority;
  assignment.updatedAt = new Date();

  assignment.history.push({
    id: generateActivityId(),
    action: 'status_changed',
    userId,
    details: `Priority changed from ${oldPriority} to ${priority}`,
    timestamp: new Date(),
  });

  return true;
}

/**
 * Set assignment due date
 */
export function setAssignmentDueDate(
  assignmentId: string,
  dueDate: Date | undefined,
  userId: string
): boolean {
  const assignment = assignments.get(assignmentId);
  if (!assignment) return false;

  assignment.dueDate = dueDate;
  assignment.updatedAt = new Date();

  assignment.history.push({
    id: generateActivityId(),
    action: 'status_changed',
    userId,
    details: dueDate ? `Due date set to ${dueDate.toISOString()}` : 'Due date removed',
    timestamp: new Date(),
  });

  return true;
}

/**
 * Get overdue assignments
 */
export function getOverdueAssignments(channelId?: string): EmailAssignment[] {
  const now = new Date();
  const overdue: EmailAssignment[] = [];

  for (const assignment of assignments.values()) {
    if (channelId && assignment.channelId !== channelId) continue;
    if (assignment.status === 'completed') continue;
    if (assignment.dueDate && assignment.dueDate < now) {
      overdue.push(assignment);
    }
  }

  return overdue.sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
}

/**
 * Get assignment workload for a user
 */
export function getAssignmentWorkload(userId: string): {
  total: number;
  pending: number;
  inProgress: number;
  needsReview: number;
  overdue: number;
} {
  const now = new Date();
  let total = 0;
  let pending = 0;
  let inProgress = 0;
  let needsReview = 0;
  let overdue = 0;

  for (const assignment of assignments.values()) {
    if (assignment.assigneeId !== userId) continue;
    if (assignment.status === 'completed') continue;

    total++;
    if (assignment.status === 'pending') pending++;
    if (assignment.status === 'in_progress') inProgress++;
    if (assignment.status === 'needs_review') needsReview++;
    if (assignment.dueDate && assignment.dueDate < now) overdue++;
  }

  return { total, pending, inProgress, needsReview, overdue };
}

/**
 * Auto-assign email using round-robin
 */
export function autoAssignRoundRobin(
  emailId: string,
  channelId: string,
  eligibleUsers: string[],
  assignerId: string
): EmailAssignment | null {
  if (eligibleUsers.length === 0) return null;

  // Get workload for each user
  const workloads = eligibleUsers.map((userId) => ({
    userId,
    workload: getAssignmentWorkload(userId).total,
  }));

  // Sort by workload (least first)
  workloads.sort((a, b) => a.workload - b.workload);

  // Assign to user with least workload
  return createAssignment(
    {
      emailId,
      channelId,
      assigneeId: workloads[0].userId,
      priority: 3,
      tags: ['auto-assigned'],
    },
    assignerId
  );
}
