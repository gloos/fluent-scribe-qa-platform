/**
 * Template Manager Utilities
 * 
 * Comprehensive template management system for scoring models including:
 * - CRUD operations for templates
 * - Versioning and change tracking
 * - Search and categorization
 * - Permission controls and sharing
 * - Usage analytics and ratings
 */

import type { 
  ScoringModelTemplate, 
  CustomScoringModel, 
  ScoringModelConfig
} from '@/lib/types/scoring-models';
import { AssessmentFramework, ErrorSeverity } from '@/lib/types/assessment';

export interface TemplateSearchOptions {
  query?: string;
  category?: 'translation' | 'content' | 'technical' | 'general' | 'all';
  framework?: AssessmentFramework | 'all';
  isPublic?: boolean;
  organizationId?: string;
  tags?: string[];
  sortBy?: 'name' | 'usageCount' | 'rating' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TemplateCreateData {
  name: string;
  description: string;
  category: 'translation' | 'content' | 'technical' | 'general';
  config: ScoringModelConfig;
  framework?: AssessmentFramework;
  isPublic?: boolean;
  tags?: string[];
  organizationId?: string;
  userId?: string;
}

export interface TemplateUpdateData extends Partial<TemplateCreateData> {
  id: string;
  version?: string;
  usageCount?: number;
}

export interface TemplateVersion {
  version: string;
  changes: string[];
  createdAt: string;
  createdBy?: string;
  config: ScoringModelConfig;
}

export interface TemplateStats {
  totalTemplates: number;
  publicTemplates: number;
  privateTemplates: number;
  categoryCounts: Record<string, number>;
  frameworkCounts: Record<string, number>;
  averageRating: number;
  topTags: Array<{ tag: string; count: number }>;
}

/**
 * Template Manager Class
 * Central hub for all template operations
 */
export class TemplateManager {
  private static instance: TemplateManager;
  private templates: Map<string, ScoringModelTemplate> = new Map();
  private templateVersions: Map<string, TemplateVersion[]> = new Map();

  private constructor() {
    this.loadDefaultTemplates();
  }

  public static getInstance(): TemplateManager {
    if (!TemplateManager.instance) {
      TemplateManager.instance = new TemplateManager();
    }
    return TemplateManager.instance;
  }

  /**
   * Create a new template from a scoring model
   */
  async createTemplate(data: TemplateCreateData): Promise<ScoringModelTemplate> {
    const templateId = this.generateTemplateId();
    const timestamp = new Date().toISOString();

    const template: ScoringModelTemplate = {
      id: templateId,
      name: data.name,
      description: data.description,
      category: data.category,
      framework: data.framework || AssessmentFramework.CUSTOM,
      isPublic: data.isPublic || false,
      usageCount: 0,
      rating: 0,
      config: data.config,
      tags: data.tags || [],
      createdBy: data.userId,
      createdAt: timestamp
    };

    // Validate template before creation
    const validation = await this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    this.templates.set(templateId, template);
    
    // Create initial version
    const initialVersion: TemplateVersion = {
      version: '1.0.0',
      changes: ['Initial template creation'],
      createdAt: timestamp,
      createdBy: data.userId,
      config: data.config
    };
    this.templateVersions.set(templateId, [initialVersion]);

    // Simulate API call
    await this.saveToStorage(template);

    return template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(data: TemplateUpdateData): Promise<ScoringModelTemplate> {
    const existingTemplate = this.templates.get(data.id);
    if (!existingTemplate) {
      throw new Error(`Template with ID ${data.id} not found`);
    }

    const updatedTemplate: ScoringModelTemplate = {
      ...existingTemplate,
      ...data,
      id: existingTemplate.id, // Preserve ID
      createdAt: existingTemplate.createdAt, // Preserve creation date
    };

    // Validate updated template
    const validation = await this.validateTemplate(updatedTemplate);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    this.templates.set(data.id, updatedTemplate);

    // Create new version if config changed
    if (data.config) {
      await this.createNewVersion(data.id, data.config, data.userId);
    }

    await this.saveToStorage(updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, userId?: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Check permissions
    if (template.createdBy && template.createdBy !== userId) {
      throw new Error('Insufficient permissions to delete this template');
    }

    this.templates.delete(templateId);
    this.templateVersions.delete(templateId);

    // Simulate API call
    await this.removeFromStorage(templateId);
    return true;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<ScoringModelTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Search templates with filtering and sorting
   */
  async searchTemplates(options: TemplateSearchOptions = {}): Promise<{
    templates: ScoringModelTemplate[];
    total: number;
    stats: TemplateStats;
  }> {
    let filteredTemplates = Array.from(this.templates.values());

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase();
      filteredTemplates = filteredTemplates.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (options.category && options.category !== 'all') {
      filteredTemplates = filteredTemplates.filter(template =>
        template.category === options.category
      );
    }

    if (options.framework && options.framework !== 'all') {
      filteredTemplates = filteredTemplates.filter(template =>
        template.framework === options.framework
      );
    }

    if (options.isPublic !== undefined) {
      filteredTemplates = filteredTemplates.filter(template =>
        template.isPublic === options.isPublic
      );
    }

    if (options.organizationId) {
      filteredTemplates = filteredTemplates.filter(template =>
        template.isPublic || 
        (template as any).organizationId === options.organizationId
      );
    }

    if (options.tags && options.tags.length > 0) {
      filteredTemplates = filteredTemplates.filter(template =>
        options.tags!.some(tag => template.tags.includes(tag))
      );
    }

    // Apply sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    
    filteredTemplates.sort((a, b) => {
      let aValue: any = a[sortBy as keyof ScoringModelTemplate];
      let bValue: any = b[sortBy as keyof ScoringModelTemplate];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const total = filteredTemplates.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

    // Generate stats
    const stats = this.generateStats(Array.from(this.templates.values()));

    return {
      templates: paginatedTemplates,
      total,
      stats
    };
  }

  /**
   * Clone a template to create a new model
   */
  async cloneTemplate(templateId: string, userId?: string): Promise<CustomScoringModel> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Increment usage count
    template.usageCount++;
    await this.updateTemplate({ id: templateId, usageCount: template.usageCount });

    const timestamp = new Date().toISOString();
    const modelId = this.generateModelId();

    // Convert template to scoring model
    const scoringModel: CustomScoringModel = {
      id: modelId,
      name: `${template.name} (Copy)`,
      description: template.description,
      framework: template.framework,
      version: '1.0',
      organizationId: userId ? undefined : undefined, // Set based on user context
      projectId: undefined,
      isGlobal: false,
      isActive: true,
      maxScore: 100, // Default, will be set by config
      passingThreshold: 85, // Default, will be set by config
      config: { ...template.config }, // Deep copy config
      tags: [...template.tags], // Copy tags
      metadata: {
        sourceTemplateId: templateId,
        sourceTemplateName: template.name,
        clonedAt: timestamp
      },
      createdBy: userId,
      updatedBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return scoringModel;
  }

  /**
   * Convert scoring model to template
   */
  async modelToTemplate(
    model: CustomScoringModel, 
    templateData: Omit<TemplateCreateData, 'config'>
  ): Promise<ScoringModelTemplate> {
    const createData: TemplateCreateData = {
      ...templateData,
      config: model.config
    };

    return await this.createTemplate(createData);
  }

  /**
   * Rate a template
   */
  async rateTemplate(templateId: string, rating: number, userId?: string): Promise<boolean> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Simple rating calculation (in real app, would track individual ratings)
    const currentRating = template.rating || 0;
    const newRating = currentRating === 0 ? rating : (currentRating + rating) / 2;
    
    template.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal
    await this.saveToStorage(template);

    return true;
  }

  /**
   * Get template versions
   */
  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.templateVersions.get(templateId) || [];
  }

  /**
   * Validate template structure and content
   */
  private async validateTemplate(template: ScoringModelTemplate): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.description || template.description.trim().length === 0) {
      warnings.push('Template description is recommended');
    }

    if (!template.config) {
      errors.push('Template configuration is required');
    } else {
      // Validate config structure
      if (!template.config.dimensions || template.config.dimensions.length === 0) {
        warnings.push('Template should have at least one dimension');
      }

      if (!template.config.errorTypes || template.config.errorTypes.length === 0) {
        warnings.push('Template should have at least one error type');
      }

      // Validate weights
      const totalDimensionWeight = template.config.dimensions?.reduce(
        (sum, dim) => sum + (dim.weight || 0), 0
      ) || 0;

      if (totalDimensionWeight !== 100 && template.config.dimensions?.length > 0) {
        errors.push('Dimension weights must sum to 100%');
      }
    }

    // Check for duplicate names (excluding same template)
    const existingTemplate = Array.from(this.templates.values()).find(
      t => t.name === template.name && t.id !== template.id
    );
    if (existingTemplate) {
      errors.push('Template name already exists');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create new version for template
   */
  private async createNewVersion(
    templateId: string, 
    newConfig: ScoringModelConfig, 
    userId?: string
  ): Promise<void> {
    const versions = this.templateVersions.get(templateId) || [];
    const currentVersion = versions[versions.length - 1]?.version || '1.0.0';
    const nextVersion = this.incrementVersion(currentVersion);

    const newVersion: TemplateVersion = {
      version: nextVersion,
      changes: this.detectChanges(versions[versions.length - 1]?.config, newConfig),
      createdAt: new Date().toISOString(),
      createdBy: userId,
      config: newConfig
    };

    versions.push(newVersion);
    this.templateVersions.set(templateId, versions);
  }

  /**
   * Generate template statistics
   */
  private generateStats(templates: ScoringModelTemplate[]): TemplateStats {
    const publicTemplates = templates.filter(t => t.isPublic);
    const privateTemplates = templates.filter(t => !t.isPublic);

    const categoryCounts = templates.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const frameworkCounts = templates.reduce((acc, template) => {
      acc[template.framework] = (acc[template.framework] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageRating = templates.reduce((sum, template) => 
      sum + (template.rating || 0), 0
    ) / templates.length || 0;

    const tagCounts = templates.reduce((acc, template) => {
      template.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalTemplates: templates.length,
      publicTemplates: publicTemplates.length,
      privateTemplates: privateTemplates.length,
      categoryCounts,
      frameworkCounts,
      averageRating: Math.round(averageRating * 10) / 10,
      topTags
    };
  }

  /**
   * Utility functions
   */
  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch version
    return parts.join('.');
  }

  private detectChanges(oldConfig?: ScoringModelConfig, newConfig?: ScoringModelConfig): string[] {
    if (!oldConfig || !newConfig) return ['Configuration updated'];

    const changes: string[] = [];

    // Compare dimensions
    if (oldConfig.dimensions?.length !== newConfig.dimensions?.length) {
      changes.push('Dimensions count changed');
    }

    // Compare error types
    if (oldConfig.errorTypes?.length !== newConfig.errorTypes?.length) {
      changes.push('Error types count changed');
    }

    // Add more specific change detection as needed
    if (changes.length === 0) {
      changes.push('Configuration updated');
    }

    return changes;
  }

  /**
   * Storage simulation (replace with actual API calls)
   */
  private async saveToStorage(template: ScoringModelTemplate): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, this would be an API call
    console.log('Template saved:', template.id);
  }

  private async removeFromStorage(templateId: string): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, this would be an API call
    console.log('Template removed:', templateId);
  }

  /**
   * Load default templates for demo purposes
   */
  private loadDefaultTemplates(): void {
    const defaultTemplates: ScoringModelTemplate[] = [
      {
        id: 'template_default_translation',
        name: 'Standard Translation Quality',
        description: 'Comprehensive template for translation quality assessment',
        category: 'translation',
        framework: AssessmentFramework.MQM,
        isPublic: true,
        usageCount: 156,
        rating: 4.7,
        config: {
          scoringUnit: 'words',
          unitCount: 100,
          wordCountBased: true,
          segmentLevelScoring: false,
          dimensions: [
            {
              id: 'accuracy',
              name: 'Accuracy',
              weight: 50,
              description: 'Semantic and syntactic correctness',
              subcriteria: []
            },
            {
              id: 'fluency',
              name: 'Fluency',
              weight: 30,
              description: 'Language quality and readability',
              subcriteria: []
            },
            {
              id: 'style',
              name: 'Style',
              weight: 20,
              description: 'Adherence to style guidelines',
              subcriteria: []
            }
          ],
          errorTypes: [
            {
              id: 'terminology',
              type: 'Terminology',
              severity: ErrorSeverity.MAJOR,
              weight: 25,
              description: 'Incorrect terminology usage'
            },
            {
              id: 'grammar',
              type: 'Grammar',
              severity: ErrorSeverity.MAJOR,
              weight: 25,
              description: 'Grammatical errors'
            },
            {
              id: 'spelling',
              type: 'Spelling',
              severity: ErrorSeverity.MINOR,
              weight: 15,
              description: 'Spelling mistakes'
            },
            {
              id: 'omission',
              type: 'Omission',
              severity: ErrorSeverity.CRITICAL,
              weight: 35,
              description: 'Content omissions'
            }
          ]
        },
        tags: ['translation', 'quality', 'standard', 'mqm'],
        createdBy: 'system',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'template_default_content',
        name: 'Content Quality Assessment',
        description: 'Template for evaluating content quality and clarity',
        category: 'content',
        framework: AssessmentFramework.CUSTOM,
        isPublic: true,
        usageCount: 89,
        rating: 4.3,
        config: {
          scoringUnit: 'segments',
          unitCount: 50,
          wordCountBased: false,
          segmentLevelScoring: true,
          dimensions: [
            {
              id: 'clarity',
              name: 'Clarity',
              weight: 40,
              description: 'Content clarity and understandability',
              subcriteria: []
            },
            {
              id: 'relevance',
              name: 'Relevance',
              weight: 35,
              description: 'Content relevance to topic',
              subcriteria: []
            },
            {
              id: 'completeness',
              name: 'Completeness',
              weight: 25,
              description: 'Content completeness and coverage',
              subcriteria: []
            }
          ],
          errorTypes: [
            {
              id: 'unclear',
              type: 'Unclear Content',
              severity: ErrorSeverity.MAJOR,
              weight: 30,
              description: 'Content is unclear or confusing'
            },
            {
              id: 'irrelevant',
              type: 'Irrelevant Content',
              severity: ErrorSeverity.MAJOR,
              weight: 25,
              description: 'Content is not relevant to topic'
            },
            {
              id: 'incomplete',
              type: 'Incomplete',
              severity: ErrorSeverity.MINOR,
              weight: 20,
              description: 'Content is incomplete'
            },
            {
              id: 'inconsistent',
              type: 'Inconsistency',
              severity: ErrorSeverity.MINOR,
              weight: 25,
              description: 'Content inconsistencies'
            }
          ]
        },
        tags: ['content', 'quality', 'clarity', 'assessment'],
        createdBy: 'system',
        createdAt: '2024-01-15T00:00:00.000Z'
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
      
      // Add default version
      const version: TemplateVersion = {
        version: '1.0.0',
        changes: ['Initial template creation'],
        createdAt: template.createdAt,
        createdBy: template.createdBy,
        config: template.config
      };
      this.templateVersions.set(template.id, [version]);
    });
  }
}

/**
 * Convenience functions for common operations
 */
export const templateManager = TemplateManager.getInstance();

export const TemplateUtils = {
  async searchPublicTemplates(query?: string, category?: string) {
    return await templateManager.searchTemplates({
      query,
      category: category as any,
      isPublic: true,
      sortBy: 'usageCount',
      sortOrder: 'desc'
    });
  },

  async getMostPopularTemplates(limit: number = 10) {
    return await templateManager.searchTemplates({
      isPublic: true,
      sortBy: 'usageCount',
      sortOrder: 'desc',
      limit
    });
  },

  async getTemplatesByCategory(category: 'translation' | 'content' | 'technical' | 'general') {
    return await templateManager.searchTemplates({
      category,
      isPublic: true,
      sortBy: 'rating',
      sortOrder: 'desc'
    });
  },

  async createFromModel(model: CustomScoringModel, templateData: {
    name: string;
    description: string;
    category: 'translation' | 'content' | 'technical' | 'general';
    isPublic?: boolean;
    tags?: string[];
  }) {
    return await templateManager.modelToTemplate(model, templateData);
  }
}; 