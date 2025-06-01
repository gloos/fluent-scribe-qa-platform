// Enhanced RBAC Framework Entry Point
// Provides a comprehensive role-based access control system with:
// - Template-based role assignments
// - Comprehensive validation rules
// - Department-specific configurations
// - Approval workflows
// - Enhanced audit capabilities

// Export the enhanced RBAC service as the main interface
export { 
  EnhancedRBACService, 
  enhancedRbac 
} from './enhanced-rbac';

// Export core types and enums
export { 
  UserRole, 
  UserStatus, 
  Permission 
} from '../types/user';

// Export template-related types and services
export type { RoleTemplate } from './role-templates';
export { 
  RoleTemplateService,
  ROLE_TEMPLATES,
  APPROVAL_WORKFLOWS
} from './role-templates';

// Export validation types and services
export type {
  ValidationResult,
  RoleAssignmentRequest,
  RoleValidationContext
} from './validation';
export { RBACValidationService } from './validation';

// Export existing RBAC for backward compatibility
export { rbacService } from '../rbac';

/**
 * Quick Start Guide:
 * 
 * // Basic role assignment with validation
 * import { enhancedRbac } from '@/lib/rbac';
 * 
 * const result = await enhancedRbac.assignRoleWithTemplate(adminId, {
 *   targetUserId: userId,
 *   newRole: UserRole.QA_ANALYST,
 *   assignedBy: adminId,
 *   templateId: 'qa-engineer',
 *   justification: 'Promotion based on performance review'
 * });
 * 
 * // Get role recommendations
 * const recommendations = await enhancedRbac.getRoleRecommendations(adminId, userId);
 * 
 * // Validate role assignment before executing
 * const validation = await enhancedRbac.validateRoleAssignment(adminId, request);
 * 
 * // Get department-specific templates
 * const templates = enhancedRbac.getTemplatesForDepartment('engineering');
 */ 