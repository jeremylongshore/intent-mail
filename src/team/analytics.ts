/**
 * Team Analytics
 *
 * Provides metrics and insights for team email performance.
 *
 * E5.S5.4: Team Analytics
 */

import { getChannelAssignments, getAssignmentWorkload } from './assignment.js';
import { getChannelRecentComments } from './comments.js';
import { getChannelMembers, type SharedChannel } from './shared-inbox.js';

// ============================================================
// Types
// ============================================================

/**
 * Time period for analytics
 */
export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Member performance metrics
 */
export interface MemberMetrics {
  userId: string;
  email: string;
  name?: string;
  /** Number of emails assigned */
  assignedCount: number;
  /** Number of emails completed */
  completedCount: number;
  /** Average response time in hours */
  avgResponseTime: number;
  /** Number of emails currently pending */
  pendingCount: number;
  /** Number of overdue emails */
  overdueCount: number;
  /** Number of comments made */
  commentsCount: number;
  /** Completion rate (0-100) */
  completionRate: number;
}

/**
 * Channel performance metrics
 */
export interface ChannelMetrics {
  channelId: string;
  channelName: string;
  /** Total emails received in period */
  emailsReceived: number;
  /** Total emails responded to */
  emailsResponded: number;
  /** Average first response time in hours */
  avgFirstResponseTime: number;
  /** Average resolution time in hours */
  avgResolutionTime: number;
  /** Response rate (0-100) */
  responseRate: number;
  /** SLA compliance rate (0-100) */
  slaComplianceRate: number;
  /** Active assignments count */
  activeAssignments: number;
  /** Total comments in period */
  totalComments: number;
  /** Member metrics */
  memberMetrics: MemberMetrics[];
}

/**
 * Trend data point
 */
export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Analytics dashboard data
 */
export interface AnalyticsDashboard {
  /** Overall metrics */
  summary: {
    totalChannels: number;
    totalMembers: number;
    totalActiveAssignments: number;
    totalOverdue: number;
    avgResponseTime: number;
    avgCompletionRate: number;
  };
  /** Per-channel metrics */
  channels: ChannelMetrics[];
  /** Trend data */
  trends: {
    emailsReceived: TrendPoint[];
    responseTime: TrendPoint[];
    completionRate: TrendPoint[];
  };
  /** Top performers */
  topPerformers: MemberMetrics[];
  /** Alerts/issues */
  alerts: {
    type: 'overdue' | 'sla_breach' | 'high_volume' | 'unassigned';
    message: string;
    severity: 'info' | 'warning' | 'critical';
    channelId?: string;
    userId?: string;
  }[];
}

// ============================================================
// Analytics Functions
// ============================================================

/**
 * Calculate member metrics
 */
export function calculateMemberMetrics(
  userId: string,
  channelId: string,
  _period: AnalyticsPeriod
): MemberMetrics {
  const workload = getAssignmentWorkload(userId);
  const assignments = getChannelAssignments(channelId);
  const userAssignments = assignments.filter((a) => a.assigneeId === userId);
  const completedAssignments = userAssignments.filter((a) => a.status === 'completed');

  // Calculate average response time (simplified - would use actual timestamps in production)
  let totalResponseTime = 0;
  let responseCount = 0;

  for (const assignment of completedAssignments) {
    // Calculate time from creation to first status change (simplified)
    const createdAt = assignment.createdAt.getTime();
    const firstActivity = assignment.history.find(
      (h) => h.action === 'status_changed' && h.details.includes('in_progress')
    );
    if (firstActivity) {
      const responseTime = firstActivity.timestamp.getTime() - createdAt;
      totalResponseTime += responseTime;
      responseCount++;
    }
  }

  const avgResponseTime = responseCount > 0
    ? totalResponseTime / responseCount / (1000 * 60 * 60) // Convert to hours
    : 0;

  const members = getChannelMembers(channelId);
  const member = members.find((m) => m.userId === userId);

  // Count comments (simplified)
  const recentComments = getChannelRecentComments(channelId, 100);
  const userComments = recentComments.filter((c) => c.authorId === userId);

  return {
    userId,
    email: member?.email ?? 'unknown',
    name: member?.name,
    assignedCount: userAssignments.length,
    completedCount: completedAssignments.length,
    avgResponseTime: Math.round(avgResponseTime * 100) / 100,
    pendingCount: workload.pending + workload.inProgress,
    overdueCount: workload.overdue,
    commentsCount: userComments.length,
    completionRate: userAssignments.length > 0
      ? Math.round((completedAssignments.length / userAssignments.length) * 100)
      : 0,
  };
}

/**
 * Calculate channel metrics
 */
export function calculateChannelMetrics(
  channel: SharedChannel,
  period: AnalyticsPeriod
): ChannelMetrics {
  const assignments = getChannelAssignments(channel.id);
  const recentComments = getChannelRecentComments(channel.id, 1000);

  // Calculate average response times
  let totalFirstResponseTime = 0;
  let totalResolutionTime = 0;
  let responseCount = 0;
  let resolutionCount = 0;
  let slaBreach = 0;

  for (const assignment of assignments) {
    const createdAt = assignment.createdAt.getTime();

    // First response time
    const firstActivity = assignment.history.find(
      (h) => h.action === 'status_changed' || h.action === 'note_added'
    );
    if (firstActivity) {
      const responseTime = firstActivity.timestamp.getTime() - createdAt;
      totalFirstResponseTime += responseTime;
      responseCount++;
    }

    // Resolution time
    if (assignment.status === 'completed') {
      const completedActivity = assignment.history.find((h) => h.action === 'completed');
      if (completedActivity) {
        const resolutionTime = completedActivity.timestamp.getTime() - createdAt;
        totalResolutionTime += resolutionTime;
        resolutionCount++;
      }
    }

    // SLA check
    if (assignment.sla?.breached) {
      slaBreach++;
    }
  }

  const avgFirstResponseTime = responseCount > 0
    ? totalFirstResponseTime / responseCount / (1000 * 60 * 60)
    : 0;

  const avgResolutionTime = resolutionCount > 0
    ? totalResolutionTime / resolutionCount / (1000 * 60 * 60)
    : 0;

  // Calculate member metrics
  const memberMetrics = channel.members.map((member) =>
    calculateMemberMetrics(member.userId, channel.id, period)
  );

  return {
    channelId: channel.id,
    channelName: channel.name,
    emailsReceived: assignments.length,
    emailsResponded: responseCount,
    avgFirstResponseTime: Math.round(avgFirstResponseTime * 100) / 100,
    avgResolutionTime: Math.round(avgResolutionTime * 100) / 100,
    responseRate: assignments.length > 0
      ? Math.round((responseCount / assignments.length) * 100)
      : 0,
    slaComplianceRate: assignments.length > 0
      ? Math.round(((assignments.length - slaBreach) / assignments.length) * 100)
      : 100,
    activeAssignments: assignments.filter((a) => a.status !== 'completed').length,
    totalComments: recentComments.length,
    memberMetrics,
  };
}

/**
 * Generate trend data
 */
export function generateTrends(
  _channelId: string,
  period: AnalyticsPeriod,
  metric: 'emailsReceived' | 'responseTime' | 'completionRate'
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const now = new Date();
  let daysBack: number;

  switch (period) {
    case 'day':
      daysBack = 24; // 24 hours
      break;
    case 'week':
      daysBack = 7;
      break;
    case 'month':
      daysBack = 30;
      break;
    case 'quarter':
      daysBack = 90;
      break;
    case 'year':
      daysBack = 365;
      break;
    default:
      daysBack = 7;
  }

  // Generate mock trend data (would be calculated from actual data in production)
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    let value: number;
    switch (metric) {
      case 'emailsReceived':
        value = Math.floor(Math.random() * 50) + 10;
        break;
      case 'responseTime':
        value = Math.random() * 4 + 1; // 1-5 hours
        break;
      case 'completionRate':
        value = Math.random() * 30 + 70; // 70-100%
        break;
      default:
        value = 0;
    }

    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
    });
  }

  return points;
}

/**
 * Generate alerts for issues
 */
export function generateAlerts(
  channels: SharedChannel[]
): AnalyticsDashboard['alerts'] {
  const alerts: AnalyticsDashboard['alerts'] = [];

  for (const channel of channels) {
    const assignments = getChannelAssignments(channel.id);
    const overdueAssignments = assignments.filter(
      (a) => a.dueDate && a.dueDate < new Date() && a.status !== 'completed'
    );

    // Overdue alerts
    if (overdueAssignments.length > 0) {
      alerts.push({
        type: 'overdue',
        message: `${overdueAssignments.length} overdue emails in ${channel.name}`,
        severity: overdueAssignments.length > 5 ? 'critical' : 'warning',
        channelId: channel.id,
      });
    }

    // SLA breach alerts
    const slaBreaches = assignments.filter((a) => a.sla?.breached);
    if (slaBreaches.length > 0) {
      alerts.push({
        type: 'sla_breach',
        message: `${slaBreaches.length} SLA breaches in ${channel.name}`,
        severity: 'critical',
        channelId: channel.id,
      });
    }

    // High volume alert
    const pendingCount = assignments.filter(
      (a) => a.status === 'pending' || a.status === 'in_progress'
    ).length;
    if (pendingCount > 20) {
      alerts.push({
        type: 'high_volume',
        message: `High email volume (${pendingCount} pending) in ${channel.name}`,
        severity: 'warning',
        channelId: channel.id,
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Generate full analytics dashboard
 */
export function generateAnalyticsDashboard(
  channels: SharedChannel[],
  period: AnalyticsPeriod = 'week'
): AnalyticsDashboard {
  // Calculate channel metrics
  const channelMetrics = channels.map((channel) =>
    calculateChannelMetrics(channel, period)
  );

  // Calculate summary
  let totalMembers = 0;
  let totalActiveAssignments = 0;
  let totalOverdue = 0;
  let totalResponseTime = 0;
  let totalCompletionRate = 0;
  let memberCount = 0;

  for (const channel of channels) {
    totalMembers += channel.members.length;
  }

  for (const metrics of channelMetrics) {
    totalActiveAssignments += metrics.activeAssignments;
    totalResponseTime += metrics.avgFirstResponseTime;

    for (const member of metrics.memberMetrics) {
      totalOverdue += member.overdueCount;
      totalCompletionRate += member.completionRate;
      memberCount++;
    }
  }

  // Get top performers
  const allMemberMetrics: MemberMetrics[] = [];
  for (const metrics of channelMetrics) {
    allMemberMetrics.push(...metrics.memberMetrics);
  }

  const topPerformers = allMemberMetrics
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  // Generate trends (using first channel for simplicity)
  const firstChannelId = channels[0]?.id ?? '';

  return {
    summary: {
      totalChannels: channels.length,
      totalMembers,
      totalActiveAssignments,
      totalOverdue,
      avgResponseTime: channelMetrics.length > 0
        ? Math.round((totalResponseTime / channelMetrics.length) * 100) / 100
        : 0,
      avgCompletionRate: memberCount > 0
        ? Math.round(totalCompletionRate / memberCount)
        : 0,
    },
    channels: channelMetrics,
    trends: {
      emailsReceived: generateTrends(firstChannelId, period, 'emailsReceived'),
      responseTime: generateTrends(firstChannelId, period, 'responseTime'),
      completionRate: generateTrends(firstChannelId, period, 'completionRate'),
    },
    topPerformers,
    alerts: generateAlerts(channels),
  };
}

/**
 * Export analytics data as CSV
 */
export function exportAnalyticsCSV(dashboard: AnalyticsDashboard): string {
  const lines: string[] = [];

  // Header
  lines.push('Channel,Member,Assigned,Completed,Pending,Overdue,Completion Rate,Avg Response Time');

  // Data rows
  for (const channel of dashboard.channels) {
    for (const member of channel.memberMetrics) {
      lines.push([
        channel.channelName,
        member.email,
        member.assignedCount.toString(),
        member.completedCount.toString(),
        member.pendingCount.toString(),
        member.overdueCount.toString(),
        `${member.completionRate}%`,
        `${member.avgResponseTime}h`,
      ].join(','));
    }
  }

  return lines.join('\n');
}
