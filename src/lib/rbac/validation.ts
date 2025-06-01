import { UserRole, UserProfile, UserStatus, Permission } from '../types/user';
import { RoleTemplate, RoleTemplateService } from './role-templates';

/**
 * RBAC validation rules and business logic
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface RoleAssignmentRequest {
  targetUserId: string;
  newRole: UserRole;
  assignedBy: string;
  templateId?: string;
  justification?: string;
  temporaryAssignment?: {
    expiresAt: Date;
    reviewRequired: boolean;
  };
}

export interface RoleValidationContext {
  assignerProfile: UserProfile;
  targetProfile: UserProfile;
  organizationContext?: {
    maxUsersPerRole?: Record<UserRole, number>;
    departmentRestrictions?: Record<string, UserRole[]>;
    complianceRequirements?: string[];
  };
}

/**
 * Core RBAC validation service
 */
export class RBACValidationService {
  
  /**
   * Comprehensive role assignment validation
   */
  static validateRoleAssignment(
    request: RoleAssignmentRequest,
    context: RoleValidationContext
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Run all validation checks
    this.validateHierarchyRules(request, context, result);
    this.validateBusinessRules(request, context, result);
    this.validateSecurityRules(request, context, result);
    this.validateComplianceRules(request, context, result);
    this.validateOrganizationalRules(request, context, result);

    // Set overall validity
    result.valid = result.errors.length === 0;

    return result;
  }

  /**
   * Validate role hierarchy rules
   */
  private static validateHierarchyRules(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { assignerProfile, targetProfile } = context;
    const assignerLevel = this.getRoleLevel(assignerProfile.role);
    const targetLevel = this.getRoleLevel(request.newRole);

    // Cannot assign role equal to or higher than assigner's role (except super admin)
    if (assignerProfile.role !== UserRole.SUPER_ADMIN && targetLevel >= assignerLevel) {
      result.errors.push('Cannot assign role equal to or higher than your own role');
    }

    // Cannot demote users to roles more than 2 levels below current (prevents accidental demotions)
    const currentLevel = this.getRoleLevel(targetProfile.role);
    if (targetLevel < currentLevel - 40) { // 40 = 2 levels
      result.warnings.push('This is a significant role demotion. Consider if this is intentional.');
    }

    // Super admin assignments require special handling
    if (request.newRole === UserRole.SUPER_ADMIN && assignerProfile.role !== UserRole.SUPER_ADMIN) {
      result.errors.push('Only super administrators can assign super admin roles');
    }

    // Guest role assignments should be temporary
    if (request.newRole === UserRole.GUEST && !request.temporaryAssignment) {
      result.warnings.push('Guest role assignments should typically be temporary');
      result.suggestions?.push('Consider setting an expiration date for this guest access');
    }
  }

  /**
   * Validate business rules
   */
  private static validateBusinessRules(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { targetProfile } = context;

    // User must be active to receive elevated roles
    if (targetProfile.status !== UserStatus.ACTIVE && 
        this.getRoleLevel(request.newRole) > this.getRoleLevel(UserRole.USER)) {
      result.errors.push('Cannot assign elevated roles to inactive users');
    }

    // Email verification required for admin roles
    if (!targetProfile.is_verified && 
        this.getRoleLevel(request.newRole) >= this.getRoleLevel(UserRole.ADMIN)) {
      result.errors.push('Email verification required for administrative roles');
    }

    // Template validation if provided
    if (request.templateId) {
      const template = RoleTemplateService.getTemplate(request.templateId);
      if (!template) {
        result.errors.push('Invalid role template specified');
      } else if (template.role !== request.newRole) {
        result.errors.push('Role does not match the specified template');
      } else {
        // Check template-specific requirements
        this.validateTemplateRequirements(template, context, result);
      }
    }

    // Justification required for significant role changes
    const currentLevel = this.getRoleLevel(targetProfile.role);
    const newLevel = this.getRoleLevel(request.newRole);
    if (Math.abs(newLevel - currentLevel) > 20 && !request.justification) {
      result.warnings.push('Justification recommended for significant role changes');
    }
  }

  /**
   * Validate security rules
   */
  private static validateSecurityRules(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { targetProfile } = context;

    // Check for security red flags
    if (targetProfile.failed_login_attempts > 5) {
      result.warnings.push('Target user has recent failed login attempts');
    }

    if (targetProfile.locked_until && new Date(targetProfile.locked_until) > new Date()) {
      result.errors.push('Cannot assign roles to currently locked users');
    }

    // Two-factor authentication required for admin roles
    if (!targetProfile.two_factor_enabled && 
        this.getRoleLevel(request.newRole) >= this.getRoleLevel(UserRole.ADMIN)) {
      result.warnings.push('Two-factor authentication recommended for administrative roles');
      result.suggestions?.push('Require 2FA setup before role activation');
    }

    // Recent password change for elevated roles
    if (targetProfile.password_changed_at) {
      const passwordAge = Date.now() - new Date(targetProfile.password_changed_at).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      if (passwordAge > thirtyDays && 
          this.getRoleLevel(request.newRole) >= this.getRoleLevel(UserRole.MANAGER)) {
        result.warnings.push('Password was changed more than 30 days ago');
        result.suggestions?.push('Consider requiring password update for elevated role');
      }
    }
  }

  /**
   * Validate compliance rules
   */
  private static validateComplianceRules(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { organizationContext } = context;

    if (organizationContext?.complianceRequirements) {
      // SOX compliance checks
      if (organizationContext.complianceRequirements.includes('SOX')) {
        if (request.newRole === UserRole.ADMIN && !request.justification) {
          result.errors.push('SOX compliance requires documented justification for admin role assignments');
        }
      }

      // GDPR compliance checks
      if (organizationContext.complianceRequirements.includes('GDPR')) {
        if (this.getRoleLevel(request.newRole) >= this.getRoleLevel(UserRole.QA_ANALYST)) {
          result.warnings.push('GDPR compliance: Document data access justification');
        }
      }

      // HIPAA compliance checks
      if (organizationContext.complianceRequirements.includes('HIPAA')) {
        if (!request.temporaryAssignment && 
            this.getRoleLevel(request.newRole) > this.getRoleLevel(UserRole.USER)) {
          result.warnings.push('HIPAA compliance: Consider temporary assignments for elevated access');
        }
      }
    }
  }

  /**
   * Validate organizational rules
   */
  private static validateOrganizationalRules(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { assignerProfile, targetProfile, organizationContext } = context;

    // Check department restrictions
    if (organizationContext?.departmentRestrictions && targetProfile.department) {
      const allowedRoles = organizationContext.departmentRestrictions[targetProfile.department];
      if (allowedRoles && !allowedRoles.includes(request.newRole)) {
        result.errors.push(`Role ${request.newRole} not allowed for ${targetProfile.department} department`);
      }
    }

    // Check max users per role
    if (organizationContext?.maxUsersPerRole) {
      const maxForRole = organizationContext.maxUsersPerRole[request.newRole];
      if (maxForRole !== undefined) {
        // Note: This would need actual user count from database
        result.warnings.push(`Check if role assignment exceeds organizational limits`);
      }
    }

    // Manager cannot assign roles to their own manager
    if (targetProfile.id === assignerProfile.manager_id) {
      result.warnings.push('Assigning role to your manager - ensure this is appropriate');
    }

    // Cross-department role assignments should be flagged
    if (assignerProfile.department && targetProfile.department && 
        assignerProfile.department !== targetProfile.department &&
        this.getRoleLevel(request.newRole) >= this.getRoleLevel(UserRole.MANAGER)) {
      result.warnings.push('Cross-department management role assignment');
      result.suggestions?.push('Verify departmental approval for cross-department role');
    }
  }

  /**
   * Validate template-specific requirements
   */
  private static validateTemplateRequirements(
    template: RoleTemplate,
    context: RoleValidationContext,
    result: ValidationResult
  ): void {
    const { targetProfile } = context;

    // Check department match if template specifies department
    if (template.department && targetProfile.department !== template.department) {
      result.warnings.push(`Template designed for ${template.department} department`);
    }

    // Check template restrictions
    if (template.restrictions) {
      template.restrictions.forEach(restriction => {
        result.warnings.push(`Template restriction: ${restriction}`);
      });
    }
  }

  /**
   * Get role level for hierarchy comparison
   */
  private static getRoleLevel(role: UserRole): number {
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
   * Generate role assignment recommendations
   */
  static generateRoleRecommendations(
    targetProfile: UserProfile,
    context: RoleValidationContext
  ): RoleTemplate[] {
    return RoleTemplateService.generateRecommendations(
      targetProfile.id,
      targetProfile.role,
      targetProfile.department,
      targetProfile.job_title
    ).filter(template => {
      // Filter based on validation rules
      const request: RoleAssignmentRequest = {
        targetUserId: targetProfile.id,
        newRole: template.role,
        assignedBy: context.assignerProfile.id,
        templateId: template.id
      };

      const validation = this.validateRoleAssignment(request, context);
      return validation.errors.length === 0; // Only include valid recommendations
    });
  }

  /**
   * Check if role assignment requires approval
   */
  static requiresApproval(
    request: RoleAssignmentRequest,
    context: RoleValidationContext
  ): boolean {
    const currentLevel = this.getRoleLevel(context.targetProfile.role);
    const newLevel = this.getRoleLevel(request.newRole);
    const assignerLevel = this.getRoleLevel(context.assignerProfile.role);

    // Always require approval for role elevations
    if (newLevel > currentLevel) return true;

    // Require approval for cross-department assignments
    if (context.assignerProfile.department !== context.targetProfile.department) return true;

    // Require approval for admin-level assignments
    if (newLevel >= this.getRoleLevel(UserRole.ADMIN)) return true;

    // Require approval if assigner doesn't have significantly higher role
    if (assignerLevel - newLevel < 20) return true; // Less than 1 level difference

    return false;
  }

  /**
   * Generate audit trail entry for role assignment
   */
  static generateAuditEntry(
    request: RoleAssignmentRequest,
    context: RoleValidationContext,
    result: ValidationResult
  ): object {
    return {
      timestamp: new Date().toISOString(),
      action: 'role_assignment_attempt',
      assignerId: context.assignerProfile.id,
      assignerRole: context.assignerProfile.role,
      targetUserId: request.targetUserId,
      currentRole: context.targetProfile.role,
      requestedRole: request.newRole,
      templateId: request.templateId,
      justification: request.justification,
      validation: {
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        errors: result.errors,
        warnings: result.warnings
      },
      metadata: {
        userAgent: context.assignerProfile.user_agent,
        ipAddress: context.assignerProfile.ip_address,
        requiresApproval: this.requiresApproval(request, context)
      }
    };
  }
} 