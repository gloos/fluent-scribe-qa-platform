import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { UserRole, UserProfile, UserStatus, Permission } from '../types/user';
import { RoleTemplate, RoleTemplateService } from './role-templates';
import { 
  RBACValidationService, 
  RoleAssignmentRequest, 
  RoleValidationContext, 
  ValidationResult 
} from './validation';
import { auditLogger } from '../security/AuditLogger';

// Re-export types for convenience
export { UserRole, UserStatus, Permission } from '../types/user';
export type { RoleTemplate } from './role-templates';
export { RoleTemplateService } from './role-templates';
export type { 
  RoleAssignmentRequest, 
  RoleValidationContext, 
  ValidationResult 
} from './validation';
export { RBACValidationService } from './validation';

/**
 * Enhanced RBAC Service with template support and comprehensive validation
 * Extends the existing RBAC functionality with:
 * - Role templates for standardized assignments
 * - Comprehensive validation rules
 * - Approval workflows
 * - Enhanced audit capabilities
 */
export class EnhancedRBACService {
  private userProfileCache: Map<string, UserProfile> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Assign role using template and validation
   */
  async assignRoleWithTemplate(
    adminUserId: string,
    request: RoleAssignmentRequest
  ): Promise<{ success: boolean; error?: string; warnings?: string[]; requiresApproval?: boolean }> {
    try {
      // Get profiles for validation
      const [adminProfile, targetProfile] = await Promise.all([
        this.getUserProfile(adminUserId),
        this.getUserProfile(request.targetUserId)
      ]);

      if (!adminProfile || !targetProfile) {
        return { success: false, error: 'Unable to load user profiles' };
      }

      // Create validation context
      const context: RoleValidationContext = {
        assignerProfile: adminProfile,
        targetProfile: targetProfile,
        organizationContext: await this.getOrganizationContext(adminProfile.organization_id)
      };

      // Validate the role assignment
      const validation = RBACValidationService.validateRoleAssignment(request, context);

      if (!validation.valid) {
        return { 
          success: false, 
          error: validation.errors.join('; '),
          warnings: validation.warnings
        };
      }

      // Check if approval is required
      const requiresApproval = RBACValidationService.requiresApproval(request, context);

      if (requiresApproval) {
        // Create approval request (this would integrate with an approval workflow system)
        await this.createApprovalRequest(request, context, validation);
        return { 
          success: true, 
          requiresApproval: true,
          warnings: validation.warnings
        };
      }

      // Perform the role assignment
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: request.newRole, 
          updated_at: new Date().toISOString(),
          updated_by: adminUserId
        })
        .eq('id', request.targetUserId);

      if (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: 'Failed to update user role' };
      }

      // Clear cache for updated user
      this.userProfileCache.delete(request.targetUserId);
      this.cacheExpiry.delete(request.targetUserId);

      // Log the successful assignment
      await this.logRoleAssignment(request, context, validation, 'completed');

      return { 
        success: true,
        warnings: validation.warnings
      };

    } catch (error) {
      console.error('Unexpected error in role assignment:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get role recommendations for a user
   */
  async getRoleRecommendations(
    adminUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean; recommendations?: RoleTemplate[]; error?: string }> {
    try {
      const [adminProfile, targetProfile] = await Promise.all([
        this.getUserProfile(adminUserId),
        this.getUserProfile(targetUserId)
      ]);

      if (!adminProfile || !targetProfile) {
        return { success: false, error: 'Unable to load user profiles' };
      }

      const context: RoleValidationContext = {
        assignerProfile: adminProfile,
        targetProfile: targetProfile,
        organizationContext: await this.getOrganizationContext(adminProfile.organization_id)
      };

      const recommendations = RBACValidationService.generateRoleRecommendations(targetProfile, context);

      return { success: true, recommendations };

    } catch (error) {
      console.error('Error generating role recommendations:', error);
      return { success: false, error: 'Failed to generate recommendations' };
    }
  }

  /**
   * Get role templates for a department
   */
  getTemplatesForDepartment(department: string): RoleTemplate[] {
    return RoleTemplateService.getTemplatesForDepartment(department);
  }

  /**
   * Validate a potential role assignment without executing it
   */
  async validateRoleAssignment(
    adminUserId: string,
    request: RoleAssignmentRequest
  ): Promise<{ success: boolean; validation?: ValidationResult; error?: string }> {
    try {
      const [adminProfile, targetProfile] = await Promise.all([
        this.getUserProfile(adminUserId),
        this.getUserProfile(request.targetUserId)
      ]);

      if (!adminProfile || !targetProfile) {
        return { success: false, error: 'Unable to load user profiles' };
      }

      const context: RoleValidationContext = {
        assignerProfile: adminProfile,
        targetProfile: targetProfile,
        organizationContext: await this.getOrganizationContext(adminProfile.organization_id)
      };

      const validation = RBACValidationService.validateRoleAssignment(request, context);

      return { success: true, validation };

    } catch (error) {
      console.error('Error validating role assignment:', error);
      return { success: false, error: 'Validation failed' };
    }
  }

  /**
   * Get user profile with role information (reusing existing logic)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    const cached = this.userProfileCache.get(userId);
    const expiry = this.cacheExpiry.get(userId);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Fetch from database with all required fields
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, full_name, first_name, last_name, display_name, avatar_url, phone, bio,
        role, organization_id, department, job_title, manager_id,
        status, is_verified, email_verified_at, last_login_at, last_activity_at, login_count,
        password_changed_at, two_factor_enabled, backup_codes_generated_at, 
        failed_login_attempts, locked_until,
        timezone, locale, date_format, time_format,
        user_agent, ip_address, signup_source, referral_code, marketing_consent,
        created_at, updated_at, created_by, updated_by
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    const profile: UserProfile = {
      id: data.id,
      email: data.email,
      full_name: data.full_name || undefined,
      first_name: data.first_name || undefined,
      last_name: data.last_name || undefined,
      display_name: data.display_name || undefined,
      avatar_url: data.avatar_url || undefined,
      phone: data.phone || undefined,
      bio: data.bio || undefined,
      
      // Role and permissions
      role: (data.role as UserRole) || UserRole.USER,
      
      // Organization and team structure
      organization_id: data.organization_id || undefined,
      department: data.department || undefined,
      job_title: data.job_title || undefined,
      manager_id: data.manager_id || undefined,
      
      // User status and activity
      status: (data.status as UserStatus) || UserStatus.ACTIVE,
      is_verified: data.is_verified || false,
      email_verified_at: data.email_verified_at || undefined,
      last_login_at: data.last_login_at || undefined,
      last_activity_at: data.last_activity_at || undefined,
      login_count: data.login_count || 0,
      
      // Security fields
      password_changed_at: data.password_changed_at || undefined,
      two_factor_enabled: data.two_factor_enabled || false,
      backup_codes_generated_at: data.backup_codes_generated_at || undefined,
      failed_login_attempts: data.failed_login_attempts || 0,
      locked_until: data.locked_until || undefined,
      
      // User preferences
      timezone: data.timezone || 'UTC',
      locale: data.locale || 'en-US',
      date_format: data.date_format || 'yyyy-MM-dd',
      time_format: data.time_format || '24h',
      
      // Metadata
      user_agent: data.user_agent || undefined,
      ip_address: data.ip_address || undefined,
      signup_source: data.signup_source || undefined,
      referral_code: data.referral_code || undefined,
      marketing_consent: data.marketing_consent || false,
      
      // Audit fields
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: data.created_by || undefined,
      updated_by: data.updated_by || undefined
    };

    // Cache the result
    this.userProfileCache.set(userId, profile);
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_DURATION);

    return profile;
  }

  /**
   * Get organization context for validation
   */
  private async getOrganizationContext(organizationId?: string): Promise<any> {
    if (!organizationId) return undefined;

    // This would fetch organization-specific rules and limits
    // For now, return a default context
    return {
      maxUsersPerRole: {
        [UserRole.SUPER_ADMIN]: 2,
        [UserRole.ADMIN]: 5,
        [UserRole.MANAGER]: 20
      },
      departmentRestrictions: {
        'security': [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER],
        'finance': [UserRole.MANAGER, UserRole.USER, UserRole.GUEST]
      },
      complianceRequirements: ['SOX', 'GDPR'] // Example compliance requirements
    };
  }

  /**
   * Create approval request for role assignments that require approval
   */
  private async createApprovalRequest(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    validation: ValidationResult
  ): Promise<void> {
    // This would integrate with an approval workflow system
    // For now, log the approval request
    console.log('Approval request created:', {
      request,
      validation,
      workflow: request.templateId ? 
        RoleTemplateService.getTemplate(request.templateId) : 
        'standard'
    });

    // In a real implementation, this would:
    // 1. Create an approval record in the database
    // 2. Send notifications to appropriate approvers
    // 3. Set up workflow tracking
  }

  /**
   * Log role assignment for audit trail
   */
  private async logRoleAssignment(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    validation: ValidationResult,
    status: 'pending' | 'completed' | 'rejected'
  ): Promise<void> {
    try {
      // Determine the result based on status and validation
      let result: 'SUCCESS' | 'FAILURE' | 'WARNING';
      if (status === 'completed' && validation.valid) {
        result = 'SUCCESS';
      } else if (status === 'rejected' || !validation.valid) {
        result = 'FAILURE';
      } else {
        result = 'WARNING';
      }

      // Log using the new audit logger
      await auditLogger.logRoleAssignment(
        context.assignerProfile.id,
        request.targetUserId,
        {
          from: context.targetProfile.role,
          to: request.newRole
        },
        result,
        {
          actor_email: context.assignerProfile.email,
          affected_email: context.targetProfile.email,
          justification: request.justification,
          ip_address: context.assignerProfile.ip_address,
          user_agent: context.assignerProfile.user_agent,
          session_id: context.assignerProfile.id // Using user ID as session identifier for now
        }
      );

      // Also log the validation details for compliance
      if (!validation.valid || validation.warnings.length > 0) {
        await auditLogger.logEvent({
          event_type: 'ROLE_ASSIGNED',
          user_id: context.assignerProfile.id,
          affected_user_id: request.targetUserId,
          result: validation.valid ? 'WARNING' : 'FAILURE',
          reason: `Validation issues: ${validation.errors.concat(validation.warnings).join(', ')}`,
          metadata: {
            validation_details: {
              errors: validation.errors,
              warnings: validation.warnings,
              requires_approval: RBACValidationService.requiresApproval(request, context)
            },
            template_used: request.templateId,
            status
          }
        });
      }
    } catch (error) {
      console.error('Failed to log role assignment audit:', error);
      // Fallback to original console logging
      const auditEntry = {
        ...RBACValidationService.generateAuditEntry(request, context, validation),
        status
      };
      console.log('Role assignment audit (fallback):', auditEntry);
    }
  }

  /**
   * Clear user cache
   */
  clearUserCache(userId?: string): void {
    if (userId) {
      this.userProfileCache.delete(userId);
      this.cacheExpiry.delete(userId);
    } else {
      this.userProfileCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get role hierarchy level for a role
   */
  getRoleLevel(role: UserRole): number {
    const hierarchy = {
      [UserRole.GUEST]: 10,
      [UserRole.USER]: 20,
      [UserRole.QA_ANALYST]: 40,
      [UserRole.MANAGER]: 60,
      [UserRole.ADMIN]: 80,
      [UserRole.SUPER_ADMIN]: 100
    };
    return hierarchy[role] || 0;
  }

  /**
   * Get display name for a role
   */
  getRoleDisplayName(role: UserRole): string {
    const displayNames = {
      [UserRole.SUPER_ADMIN]: 'Super Administrator',
      [UserRole.ADMIN]: 'Administrator',
      [UserRole.MANAGER]: 'Manager',
      [UserRole.QA_ANALYST]: 'QA Analyst',
      [UserRole.USER]: 'User',
      [UserRole.GUEST]: 'Guest'
    };
    return displayNames[role] || role;
  }

  /**
   * Get all role templates
   */
  getAllRoleTemplates(): Record<string, RoleTemplate[]> {
    return RoleTemplateService['ROLE_TEMPLATES'];
  }

  /**
   * Get specific role template
   */
  getRoleTemplate(templateId: string): RoleTemplate | undefined {
    return RoleTemplateService.getTemplate(templateId);
  }
}

// Export a singleton instance
export const enhancedRbac = new EnhancedRBACService(); 