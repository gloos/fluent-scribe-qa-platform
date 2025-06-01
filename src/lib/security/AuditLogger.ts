import { createClient } from '@supabase/supabase-js';
import { SecurityEvent, SecurityEventType } from './types';

// Extended audit event types for RBAC and comprehensive logging
export type AuditEventType = SecurityEventType | 
  'PERMISSION_CHECK' |
  'ROLE_ASSIGNED' |
  'ROLE_REMOVED' |
  'ACCESS_GRANTED' |
  'ACCESS_DENIED' |
  'LOGOUT' |
  'PASSWORD_CHANGE' |
  'ACCOUNT_UNLOCKED' |
  'SESSION_EXPIRED';

export type AuditResult = 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR' | 'WARNING';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditLogEntry {
  id?: string;
  created_at?: string;
  
  // Event identification
  event_type: AuditEventType;
  
  // Core audit information
  user_id?: string;
  affected_user_id?: string;
  actor_email?: string;
  affected_email?: string;
  
  // Permission/role context
  permission_checked?: string;
  role_from?: string;
  role_to?: string;
  current_user_role?: string;
  
  // Resource context
  resource_type?: string;
  resource_id?: string;
  organization_id?: string;
  project_id?: string;
  
  // Request details
  request_path?: string;
  request_method?: string;
  request_body?: Record<string, any>;
  
  // Results and metadata
  result: AuditResult;
  reason?: string;
  metadata?: Record<string, any>;
  
  // Security context
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
  geo_location?: Record<string, any>;
  
  // Risk assessment
  risk_level?: RiskLevel;
  confidence_score?: number;
  
  // Compliance tracking
  requires_review?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  
  // Data retention
  archived?: boolean;
  expires_at?: string;
}

export interface AuditQueryOptions {
  user_id?: string;
  event_type?: AuditEventType;
  result?: AuditResult;
  risk_level?: RiskLevel;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
  requires_review?: boolean;
  organization_id?: string;
  resource_type?: string;
}

export interface AuditStats {
  total_events: number;
  success_rate: number;
  failure_rate: number;
  high_risk_events: number;
  pending_reviews: number;
  recent_events: AuditLogEntry[];
  event_type_breakdown: Record<AuditEventType, number>;
  risk_level_breakdown: Record<RiskLevel, number>;
}

export class AuditLogger {
  private supabase: any;
  private static instance: AuditLogger;

  constructor() {
    // Initialize Supabase client for database operations
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log an audit event to the database
   */
  public async logEvent(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
    try {
      // Set default values
      const auditEntry: AuditLogEntry = {
        ...entry,
        risk_level: entry.risk_level || this.calculateRiskLevel(entry),
        confidence_score: entry.confidence_score || this.calculateConfidenceScore(entry),
        requires_review: entry.requires_review || this.shouldRequireReview(entry),
        metadata: {
          ...entry.metadata,
          logged_at: new Date().toISOString(),
          logger_version: '1.0.0'
        }
      };

      // Insert into database
      const { error } = await this.supabase
        .from('audit_logs')
        .insert([auditEntry]);

      if (error) {
        console.error('Failed to log audit event:', error);
        // Fallback to console logging if database fails
        this.fallbackLog(auditEntry);
      }

      // Trigger real-time alerts for critical events
      if (auditEntry.risk_level === 'CRITICAL' || auditEntry.risk_level === 'HIGH') {
        await this.triggerSecurityAlert(auditEntry);
      }

    } catch (error) {
      console.error('Audit logging error:', error);
      this.fallbackLog(entry);
    }
  }

  /**
   * Log permission check events
   */
  public async logPermissionCheck(
    userId: string,
    permission: string,
    resource: { type: string; id: string },
    result: 'GRANTED' | 'DENIED',
    context: {
      user_role?: string;
      ip_address?: string;
      user_agent?: string;
      session_id?: string;
      request_path?: string;
      reason?: string;
    }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'PERMISSION_CHECK',
      user_id: userId,
      permission_checked: permission,
      current_user_role: context.user_role,
      resource_type: resource.type,
      resource_id: resource.id,
      result: result === 'GRANTED' ? 'SUCCESS' : 'DENIED',
      reason: context.reason,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      session_id: context.session_id,
      request_path: context.request_path,
      metadata: {
        permission_context: {
          resource,
          user_role: context.user_role
        }
      }
    });
  }

  /**
   * Log role assignment events
   */
  public async logRoleAssignment(
    actorId: string,
    targetUserId: string,
    roleChange: { from: string; to: string },
    result: AuditResult,
    context: {
      actor_email?: string;
      affected_email?: string;
      justification?: string;
      ip_address?: string;
      user_agent?: string;
      session_id?: string;
    }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'ROLE_ASSIGNED',
      user_id: actorId,
      affected_user_id: targetUserId,
      actor_email: context.actor_email,
      affected_email: context.affected_email,
      role_from: roleChange.from,
      role_to: roleChange.to,
      result,
      reason: context.justification,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      session_id: context.session_id,
      metadata: {
        role_change: roleChange,
        justification: context.justification
      }
    });
  }

  /**
   * Log access events (login, logout, etc.)
   */
  public async logAccessEvent(
    eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'SESSION_EXPIRED',
    userId: string | null,
    context: {
      email?: string;
      ip_address?: string;
      user_agent?: string;
      device_fingerprint?: string;
      session_id?: string;
      reason?: string;
      geo_location?: Record<string, any>;
    }
  ): Promise<void> {
    await this.logEvent({
      event_type: eventType,
      user_id: userId || undefined,
      actor_email: context.email,
      result: eventType.includes('SUCCESS') ? 'SUCCESS' : 'FAILURE',
      reason: context.reason,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      device_fingerprint: context.device_fingerprint,
      session_id: context.session_id,
      geo_location: context.geo_location,
      metadata: {
        access_context: {
          event_type: eventType,
          device_info: {
            fingerprint: context.device_fingerprint,
            user_agent: context.user_agent
          }
        }
      }
    });
  }

  /**
   * Query audit logs with filtering options
   */
  public async queryLogs(options: AuditQueryOptions = {}): Promise<AuditLogEntry[]> {
    try {
      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (options.user_id) {
        query = query.eq('user_id', options.user_id);
      }
      if (options.event_type) {
        query = query.eq('event_type', options.event_type);
      }
      if (options.result) {
        query = query.eq('result', options.result);
      }
      if (options.risk_level) {
        query = query.eq('risk_level', options.risk_level);
      }
      if (options.requires_review !== undefined) {
        query = query.eq('requires_review', options.requires_review);
      }
      if (options.organization_id) {
        query = query.eq('organization_id', options.organization_id);
      }
      if (options.resource_type) {
        query = query.eq('resource_type', options.resource_type);
      }
      if (options.start_date) {
        query = query.gte('created_at', options.start_date.toISOString());
      }
      if (options.end_date) {
        query = query.lte('created_at', options.end_date.toISOString());
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to query audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Audit query error:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  public async getAuditStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<AuditStats> {
    try {
      const startDate = new Date();
      switch (timeframe) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      const logs = await this.queryLogs({
        start_date: startDate,
        limit: 1000
      });

      const total_events = logs.length;
      const success_events = logs.filter(log => log.result === 'SUCCESS').length;
      const failure_events = logs.filter(log => log.result === 'FAILURE').length;
      const high_risk_events = logs.filter(log => 
        log.risk_level === 'HIGH' || log.risk_level === 'CRITICAL'
      ).length;
      const pending_reviews = logs.filter(log => 
        log.requires_review && !log.reviewed_at
      ).length;

      // Calculate breakdowns
      const event_type_breakdown: Record<string, number> = {};
      const risk_level_breakdown: Record<string, number> = {};

      logs.forEach(log => {
        event_type_breakdown[log.event_type] = (event_type_breakdown[log.event_type] || 0) + 1;
        if (log.risk_level) {
          risk_level_breakdown[log.risk_level] = (risk_level_breakdown[log.risk_level] || 0) + 1;
        }
      });

      return {
        total_events,
        success_rate: total_events > 0 ? (success_events / total_events) * 100 : 0,
        failure_rate: total_events > 0 ? (failure_events / total_events) * 100 : 0,
        high_risk_events,
        pending_reviews,
        recent_events: logs.slice(0, 10),
        event_type_breakdown: event_type_breakdown as Record<AuditEventType, number>,
        risk_level_breakdown: risk_level_breakdown as Record<RiskLevel, number>
      };
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        total_events: 0,
        success_rate: 0,
        failure_rate: 0,
        high_risk_events: 0,
        pending_reviews: 0,
        recent_events: [],
        event_type_breakdown: {} as Record<AuditEventType, number>,
        risk_level_breakdown: {} as Record<RiskLevel, number>
      };
    }
  }

  /**
   * Mark audit log as reviewed
   */
  public async markAsReviewed(
    logId: string,
    reviewerId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .update({
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          requires_review: false
        })
        .eq('id', logId);

      if (error) {
        console.error('Failed to mark audit log as reviewed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Review marking error:', error);
      return false;
    }
  }

  /**
   * Calculate risk level based on event characteristics
   */
  private calculateRiskLevel(entry: Partial<AuditLogEntry>): RiskLevel {
    let riskScore = 0;

    // Event type risk scoring
    const highRiskEvents = ['ROLE_ASSIGNED', 'ROLE_REMOVED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED'];
    const mediumRiskEvents = ['PERMISSION_CHECK', 'ACCESS_DENIED', 'LOGIN_FAILURE'];
    
    if (highRiskEvents.includes(entry.event_type!)) riskScore += 3;
    else if (mediumRiskEvents.includes(entry.event_type!)) riskScore += 2;
    else riskScore += 1;

    // Result risk scoring
    if (entry.result === 'FAILURE' || entry.result === 'ERROR') riskScore += 2;
    else if (entry.result === 'DENIED') riskScore += 1;

    // Role change risk scoring
    if (entry.role_to === 'admin' || entry.role_to === 'super_admin') riskScore += 2;

    // Convert score to risk level
    if (riskScore >= 6) return 'CRITICAL';
    if (riskScore >= 4) return 'HIGH';
    if (riskScore >= 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate confidence score for the audit entry
   */
  private calculateConfidenceScore(entry: Partial<AuditLogEntry>): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available context
    if (entry.user_id) confidence += 0.1;
    if (entry.ip_address) confidence += 0.1;
    if (entry.session_id) confidence += 0.1;
    if (entry.device_fingerprint) confidence += 0.1;
    if (entry.request_path) confidence += 0.1;
    if (entry.metadata && Object.keys(entry.metadata).length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Determine if an audit entry should require review
   */
  private shouldRequireReview(entry: Partial<AuditLogEntry>): boolean {
    // Always require review for critical events
    if (entry.risk_level === 'CRITICAL') return true;
    
    // Require review for high-risk events
    if (entry.risk_level === 'HIGH') return true;
    
    // Require review for role changes
    if (entry.event_type === 'ROLE_ASSIGNED' || entry.event_type === 'ROLE_REMOVED') return true;
    
    // Require review for access failures
    if (entry.result === 'FAILURE' || entry.result === 'ERROR') return true;
    
    return false;
  }

  /**
   * Fallback logging when database is unavailable
   */
  private fallbackLog(entry: Partial<AuditLogEntry>): void {
    console.log('🔍 Audit Event (Fallback):', {
      timestamp: new Date().toISOString(),
      event_type: entry.event_type,
      user_id: entry.user_id,
      result: entry.result,
      risk_level: entry.risk_level,
      metadata: entry.metadata
    });
  }

  /**
   * Trigger security alerts for critical events
   */
  private async triggerSecurityAlert(entry: AuditLogEntry): Promise<void> {
    // In production, this would integrate with alerting systems
    console.warn('🚨 Security Alert:', {
      event_type: entry.event_type,
      risk_level: entry.risk_level,
      user_id: entry.user_id,
      ip_address: entry.ip_address,
      timestamp: entry.created_at || new Date().toISOString(),
      reason: entry.reason
    });

    // Could integrate with:
    // - Email notifications
    // - Slack/Teams webhooks
    // - PagerDuty
    // - Security Information and Event Management (SIEM) systems
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance(); 