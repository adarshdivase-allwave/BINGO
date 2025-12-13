import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ActivityAction, ActivityLog } from '../types';

const client = generateClient<Schema>();

/**
 * Activity Logging Service
 * Tracks all user activities in the application for audit purposes
 */

interface LogActivityParams {
  userId: string;
  userEmail: string;
  action: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, any>;
}

/**
 * Log user activity to the database
 */
export const logActivity = async (params: LogActivityParams): Promise<void> => {
  try {
    const { userId, userEmail, action, resourceType, resourceId, resourceName, details } = params;

    const timestamp = new Date().toISOString();
    const ipAddress = await getClientIpAddress();
    const userAgent = navigator.userAgent;

    await client.models.ActivityLog.create({
      userId,
      userEmail,
      action,
      timestamp,
      resourceType,
      resourceId,
      resourceName,
      details: details || {},
      ipAddress,
      userAgent,
    });

    console.log(`Activity logged: ${action} by ${userEmail}`);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw error - logging failures shouldn't break the app
  }
};

/**
 * Get client's IP address
 */
const getClientIpAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * Fetch activity logs with optional filtering
 */
export const fetchActivityLogs = async (filters?: {
  userId?: string;
  userEmail?: string;
  action?: ActivityAction;
  startDate?: string;
  endDate?: string;
}): Promise<ActivityLog[]> => {
  try {
    const { data: logs } = await client.models.ActivityLog.list();

    if (!logs) return [];

    let filtered = logs;

    if (filters?.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }

    if (filters?.userEmail) {
      filtered = filtered.filter(log => log.userEmail === filters.userEmail);
    }

    if (filters?.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
    }

    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
    }

    // Map action strings to the narrower ActivityAction type and sort by timestamp
    const mapped: ActivityLog[] = filtered.map((log: any) => ({
      ...log,
      action: log.action as ActivityAction,
    }));

    return mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Failed to fetch activity logs:', error);
    return [];
  }
};

/**
 * Get activity summary for a user
 */
export const getUserActivitySummary = async (userId: string): Promise<{
  totalLogins: number;
  totalActions: number;
  lastLogin: string | null;
  lastAction: string | null;
}> => {
  try {
    const logs = await fetchActivityLogs({ userId });

    const logins = logs.filter(log => log.action === 'LOGIN');
    const lastLoginLog = logins[0];
    const lastActionLog = logs[0];

    return {
      totalLogins: logins.length,
      totalActions: logs.length,
      lastLogin: lastLoginLog?.timestamp || null,
      lastAction: lastActionLog?.timestamp || null,
    };
  } catch (error) {
    console.error('Failed to get user activity summary:', error);
    return {
      totalLogins: 0,
      totalActions: 0,
      lastLogin: null,
      lastAction: null,
    };
  }
};

/**
 * Export activity logs as CSV
 */
export const exportActivityLogsAsCSV = (logs: ActivityLog[]): void => {
  const headers = [
    'Timestamp',
    'User Email',
    'Action',
    'Resource Type',
    'Resource Name',
    'IP Address',
    'Details',
  ];

  const csvContent = [
    headers.join(','),
    ...logs.map(log =>
      [
        log.timestamp,
        log.userEmail,
        log.action,
        log.resourceType || '',
        log.resourceName || '',
        log.ipAddress || '',
        log.details ? JSON.stringify(log.details) : '',
      ]
        .map(field => `"${field}"`)
        .join(',')
    ),
  ].join('\n');

  const element = document.createElement('a');
  element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
  element.setAttribute('download', `activity-logs-${new Date().toISOString()}.csv`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};
