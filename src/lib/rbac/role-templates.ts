import { UserRole, Permission } from '../types/user';

/**
 * Role templates for different organizational contexts and use cases
 */

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  role: UserRole;
  department?: string;
  context: string;
  requiredApprovals: string[];
  additionalPermissions?: Permission[];
  restrictions?: string[];
  reviewPeriod: 'quarterly' | 'semi-annual' | 'annual' | 'as-needed';
}

/**
 * Department-specific role templates
 */
export const ROLE_TEMPLATES: Record<string, RoleTemplate[]> = {
  engineering: [
    {
      id: 'eng-lead',
      name: 'Engineering Team Lead',
      description: 'Technical team leadership with QA oversight',
      role: UserRole.MANAGER,
      department: 'engineering',
      context: 'Technical leadership, code quality oversight, team coordination',
      requiredApprovals: ['department-head', 'admin'],
      additionalPermissions: [Permission.VIEW_SYSTEM_LOGS],
      restrictions: ['Cannot assign admin roles'],
      reviewPeriod: 'annual'
    },
    {
      id: 'senior-qa-eng',
      name: 'Senior QA Engineer',
      description: 'Senior QA professional with advanced analysis capabilities',
      role: UserRole.QA_ANALYST,
      department: 'engineering',
      context: 'Advanced testing, automation, quality metrics analysis',
      requiredApprovals: ['team-lead', 'manager'],
      additionalPermissions: [Permission.EXPORT_REPORTS],
      reviewPeriod: 'annual'
    },
    {
      id: 'qa-engineer',
      name: 'QA Engineer',
      description: 'Professional QA engineer with testing responsibilities',
      role: UserRole.QA_ANALYST,
      department: 'engineering',
      context: 'Test execution, bug tracking, quality analysis',
      requiredApprovals: ['team-lead'],
      reviewPeriod: 'semi-annual'
    },
    {
      id: 'developer',
      name: 'Software Developer',
      description: 'Standard development role with basic QA capabilities',
      role: UserRole.USER,
      department: 'engineering',
      context: 'Code development, basic quality checks, personal QA sessions',
      requiredApprovals: ['team-lead'],
      reviewPeriod: 'annual'
    }
  ],

  operations: [
    {
      id: 'ops-manager',
      name: 'Operations Manager',
      description: 'Operations team management with system oversight',
      role: UserRole.MANAGER,
      department: 'operations',
      context: 'System reliability, process optimization, team coordination',
      requiredApprovals: ['department-head', 'admin'],
      additionalPermissions: [Permission.VIEW_SYSTEM_LOGS, Permission.MANAGE_SYSTEM_CONFIG],
      reviewPeriod: 'annual'
    },
    {
      id: 'process-analyst',
      name: 'Process Quality Analyst',
      description: 'Operations process quality and optimization specialist',
      role: UserRole.QA_ANALYST,
      department: 'operations',
      context: 'Process analysis, compliance tracking, optimization recommendations',
      requiredApprovals: ['ops-manager'],
      additionalPermissions: [Permission.EXPORT_REPORTS],
      reviewPeriod: 'semi-annual'
    },
    {
      id: 'ops-specialist',
      name: 'Operations Specialist',
      description: 'Standard operations role with procedure validation',
      role: UserRole.USER,
      department: 'operations',
      context: 'Operational procedures, basic quality checks, process documentation',
      requiredApprovals: ['ops-manager'],
      reviewPeriod: 'annual'
    }
  ],

  'customer-support': [
    {
      id: 'support-manager',
      name: 'Customer Support Manager',
      description: 'Customer support team leadership with quality oversight',
      role: UserRole.MANAGER,
      department: 'customer-support',
      context: 'Support team management, customer feedback analysis, escalation handling',
      requiredApprovals: ['department-head', 'admin'],
      additionalPermissions: [Permission.VIEW_ALL_REPORTS, Permission.EXPORT_REPORTS],
      reviewPeriod: 'annual'
    },
    {
      id: 'qa-support-analyst',
      name: 'Support Quality Analyst',
      description: 'Support process quality and customer experience specialist',
      role: UserRole.QA_ANALYST,
      department: 'customer-support',
      context: 'Support quality analysis, response time tracking, process improvement',
      requiredApprovals: ['support-manager'],
      additionalPermissions: [Permission.EXPORT_REPORTS],
      reviewPeriod: 'semi-annual'
    },
    {
      id: 'support-agent',
      name: 'Customer Support Agent',
      description: 'Standard support role with case quality review',
      role: UserRole.USER,
      department: 'customer-support',
      context: 'Customer case handling, basic quality reviews, documentation',
      requiredApprovals: ['support-manager'],
      reviewPeriod: 'semi-annual'
    }
  ],

  administration: [
    {
      id: 'system-admin',
      name: 'System Administrator',
      description: 'Full system administration capabilities',
      role: UserRole.ADMIN,
      department: 'administration',
      context: 'System configuration, user management, security oversight',
      requiredApprovals: ['super-admin', 'department-head'],
      restrictions: ['Cannot create super admin accounts'],
      reviewPeriod: 'annual'
    },
    {
      id: 'security-admin',
      name: 'Security Administrator',
      description: 'Security-focused administration with audit capabilities',
      role: UserRole.ADMIN,
      department: 'administration',
      context: 'Security configuration, audit oversight, compliance management',
      requiredApprovals: ['super-admin', 'compliance-officer'],
      additionalPermissions: [Permission.VIEW_SYSTEM_LOGS],
      restrictions: ['Read-only access to user data', 'Cannot modify billing'],
      reviewPeriod: 'semi-annual'
    }
  ],

  external: [
    {
      id: 'external-consultant',
      name: 'External Consultant',
      description: 'Limited access for external consultants and contractors',
      role: UserRole.GUEST,
      department: 'external',
      context: 'Project-specific access, limited duration, supervised access',
      requiredApprovals: ['project-manager', 'admin'],
      restrictions: ['Project-specific access only', 'Time-limited access', 'No data export'],
      reviewPeriod: 'quarterly'
    },
    {
      id: 'client-reviewer',
      name: 'Client Reviewer',
      description: 'Client access for review and feedback on specific deliverables',
      role: UserRole.GUEST,
      department: 'external',
      context: 'Deliverable review, feedback provision, read-only access',
      requiredApprovals: ['account-manager', 'manager'],
      restrictions: ['Read-only access', 'Specific deliverables only', 'No system access'],
      reviewPeriod: 'quarterly'
    }
  ]
};

/**
 * Role assignment workflows and approval chains
 */
export interface ApprovalWorkflow {
  templateId: string;
  steps: ApprovalStep[];
  autoApprovalConditions?: string[];
  escalationRules?: EscalationRule[];
}

export interface ApprovalStep {
  stepId: string;
  approverRole: UserRole;
  approverTitle: string;
  required: boolean;
  timeoutDays: number;
  escalationAction: 'reject' | 'escalate' | 'auto-approve';
}

export interface EscalationRule {
  condition: string;
  action: string;
  escalateTo: UserRole;
  timeoutHours: number;
}

/**
 * Standard approval workflows for role assignments
 */
export const APPROVAL_WORKFLOWS: ApprovalWorkflow[] = [
  {
    templateId: 'standard-user',
    steps: [
      {
        stepId: 'manager-approval',
        approverRole: UserRole.MANAGER,
        approverTitle: 'Direct Manager',
        required: true,
        timeoutDays: 3,
        escalationAction: 'escalate'
      }
    ],
    autoApprovalConditions: ['Same department', 'Standard user role'],
    escalationRules: [
      {
        condition: 'Manager unavailable > 3 days',
        action: 'Escalate to department head',
        escalateTo: UserRole.ADMIN,
        timeoutHours: 72
      }
    ]
  },
  {
    templateId: 'analyst-role',
    steps: [
      {
        stepId: 'manager-approval',
        approverRole: UserRole.MANAGER,
        approverTitle: 'Direct Manager',
        required: true,
        timeoutDays: 5,
        escalationAction: 'escalate'
      },
      {
        stepId: 'competency-review',
        approverRole: UserRole.QA_ANALYST,
        approverTitle: 'Senior QA Analyst',
        required: true,
        timeoutDays: 7,
        escalationAction: 'reject'
      }
    ]
  },
  {
    templateId: 'management-role',
    steps: [
      {
        stepId: 'dept-head-approval',
        approverRole: UserRole.ADMIN,
        approverTitle: 'Department Head',
        required: true,
        timeoutDays: 7,
        escalationAction: 'escalate'
      },
      {
        stepId: 'admin-approval',
        approverRole: UserRole.ADMIN,
        approverTitle: 'System Administrator',
        required: true,
        timeoutDays: 5,
        escalationAction: 'reject'
      }
    ]
  },
  {
    templateId: 'admin-role',
    steps: [
      {
        stepId: 'super-admin-approval',
        approverRole: UserRole.SUPER_ADMIN,
        approverTitle: 'Super Administrator',
        required: true,
        timeoutDays: 10,
        escalationAction: 'reject'
      },
      {
        stepId: 'board-approval',
        approverRole: UserRole.SUPER_ADMIN,
        approverTitle: 'Board Representative',
        required: true,
        timeoutDays: 14,
        escalationAction: 'reject'
      }
    ]
  }
];

/**
 * Helper functions for role template management
 */
export class RoleTemplateService {
  /**
   * Get role templates for a specific department
   */
  static getTemplatesForDepartment(department: string): RoleTemplate[] {
    return ROLE_TEMPLATES[department] || [];
  }

  /**
   * Get a specific role template by ID
   */
  static getTemplate(templateId: string): RoleTemplate | undefined {
    for (const deptTemplates of Object.values(ROLE_TEMPLATES)) {
      const template = deptTemplates.find(t => t.id === templateId);
      if (template) return template;
    }
    return undefined;
  }

  /**
   * Get appropriate templates for a user based on their current role and department
   */
  static getEligibleTemplates(currentRole: UserRole, department?: string): RoleTemplate[] {
    const allTemplates = department ? 
      this.getTemplatesForDepartment(department) : 
      Object.values(ROLE_TEMPLATES).flat();

    // Filter templates that represent a logical progression
    return allTemplates.filter(template => {
      const templateRoleLevel = this.getRoleLevel(template.role);
      const currentRoleLevel = this.getRoleLevel(currentRole);
      
      // Allow same level (lateral moves) or one level up
      return templateRoleLevel >= currentRoleLevel && templateRoleLevel <= currentRoleLevel + 20;
    });
  }

  /**
   * Get the approval workflow for a role template
   */
  static getApprovalWorkflow(templateId: string): ApprovalWorkflow | undefined {
    const template = this.getTemplate(templateId);
    if (!template) return undefined;

    // Map template to appropriate workflow
    if (template.role === UserRole.USER) {
      return APPROVAL_WORKFLOWS.find(w => w.templateId === 'standard-user');
    } else if (template.role === UserRole.QA_ANALYST) {
      return APPROVAL_WORKFLOWS.find(w => w.templateId === 'analyst-role');
    } else if (template.role === UserRole.MANAGER) {
      return APPROVAL_WORKFLOWS.find(w => w.templateId === 'management-role');
    } else if (template.role === UserRole.ADMIN) {
      return APPROVAL_WORKFLOWS.find(w => w.templateId === 'admin-role');
    }

    return APPROVAL_WORKFLOWS.find(w => w.templateId === 'standard-user'); // Default
  }

  /**
   * Validate if a role assignment is appropriate
   */
  static validateRoleAssignment(
    assignerRole: UserRole,
    targetRole: UserRole,
    templateId?: string
  ): { valid: boolean; reason?: string } {
    const assignerLevel = this.getRoleLevel(assignerRole);
    const targetLevel = this.getRoleLevel(targetRole);

    // Cannot assign role equal to or higher than assigner's role (except super admin)
    if (assignerRole !== UserRole.SUPER_ADMIN && targetLevel >= assignerLevel) {
      return {
        valid: false,
        reason: 'Cannot assign role equal to or higher than your own role'
      };
    }

    // Check template-specific restrictions
    if (templateId) {
      const template = this.getTemplate(templateId);
      if (template?.restrictions) {
        // Add specific template validation logic here
        // For now, just validate basic role hierarchy
      }
    }

    return { valid: true };
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
  static generateRecommendations(
    userId: string,
    currentRole: UserRole,
    department?: string,
    jobTitle?: string
  ): RoleTemplate[] {
    const eligibleTemplates = this.getEligibleTemplates(currentRole, department);
    
    // Add logic to prioritize templates based on job title, experience, etc.
    return eligibleTemplates.sort((a, b) => {
      // Prioritize same department
      if (a.department === department && b.department !== department) return -1;
      if (b.department === department && a.department !== department) return 1;
      
      // Then by role progression
      const aLevel = this.getRoleLevel(a.role);
      const bLevel = this.getRoleLevel(b.role);
      return aLevel - bLevel;
    });
  }
} 