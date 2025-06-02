import { supabase } from "@/lib/supabase";

// Enhanced interfaces for customizable views
export interface DashboardView {
  id: string;
  name: string;
  description?: string;
  layout: LayoutConfig[];
  isDefault?: boolean;
  isCustom?: boolean;
  userId?: string;
  organizationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  isPublic?: boolean;
  usageCount?: number;
}

export interface LayoutConfig {
  id: string;
  component: 'quality-trends' | 'error-distribution' | 'trend-analysis' | 'comparison' | 'summary-cards' | 'custom';
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number; w: number; h: number };
  props?: Record<string, any>;
  title?: string;
  isVisible?: boolean;
}

export interface ViewTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quality' | 'performance' | 'errors' | 'comparison' | 'custom';
  layout: LayoutConfig[];
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

export interface ViewSuggestion {
  template: ViewTemplate;
  relevanceScore: number;
  reasoning: string[];
  requiredComponents: string[];
  estimatedUsefulnessScore: number;
}

export interface ViewAnalytics {
  viewId: string;
  userId?: string;
  accessCount: number;
  lastAccessed: Date;
  averageTimeSpent: number;
  mostUsedComponents: string[];
  preferredTimeRange: string;
}

export interface ViewServiceOptions {
  userId?: string;
  organizationId?: string;
  includeDefaults?: boolean;
  includePublic?: boolean;
  sortBy?: 'name' | 'created' | 'usage' | 'relevance';
  filterBy?: {
    category?: string;
    tags?: string[];
    complexity?: string;
  };
}

class AnalyticsViewService {
  private readonly STORAGE_KEY = 'analytics_custom_views';
  private readonly TEMPLATES_KEY = 'analytics_view_templates';
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Default view templates that ship with the application
   */
  private readonly DEFAULT_TEMPLATES: ViewTemplate[] = [
    {
      id: 'overview',
      name: 'Quality Overview',
      description: 'Comprehensive quality metrics dashboard for general monitoring',
      category: 'quality',
      complexity: 'beginner',
      tags: ['quality', 'overview', 'monitoring'],
      layout: [
        {
          id: 'quality-trends-1',
          component: 'quality-trends',
          size: 'large',
          position: { x: 0, y: 0, w: 2, h: 2 },
          props: { metrics: ['mqm', 'overall', 'sessions'] },
          title: 'Quality Trends Over Time'
        },
        {
          id: 'error-dist-1',
          component: 'error-distribution',
          size: 'medium',
          position: { x: 2, y: 0, w: 1, h: 1 },
          props: { chartType: 'pie' },
          title: 'Error Distribution'
        },
        {
          id: 'trend-analysis-1',
          component: 'trend-analysis',
          size: 'medium',
          position: { x: 3, y: 0, w: 1, h: 1 },
          props: { analysisType: 'quality' },
          title: 'Trend Analysis'
        }
      ]
    },
    {
      id: 'error-deep-dive',
      name: 'Error Analysis Deep Dive',
      description: 'Detailed error pattern analysis for troubleshooting',
      category: 'errors',
      complexity: 'intermediate',
      tags: ['errors', 'analysis', 'troubleshooting'],
      layout: [
        {
          id: 'error-dist-main',
          component: 'error-distribution',
          size: 'large',
          position: { x: 0, y: 0, w: 2, h: 2 },
          props: { chartType: 'bar', showTrends: true, groupBy: 'severity' },
          title: 'Error Distribution by Severity'
        },
        {
          id: 'error-trends',
          component: 'trend-analysis',
          size: 'large',
          position: { x: 2, y: 0, w: 2, h: 2 },
          props: { analysisType: 'errors', showPrediction: true },
          title: 'Error Trend Forecasting'
        }
      ]
    },
    {
      id: 'performance-optimization',
      name: 'Performance Metrics',
      description: 'Processing efficiency and system performance monitoring',
      category: 'performance',
      complexity: 'intermediate',
      tags: ['performance', 'efficiency', 'system'],
      layout: [
        {
          id: 'perf-efficiency',
          component: 'trend-analysis',
          size: 'large',
          position: { x: 0, y: 0, w: 2, h: 1 },
          props: { analysisType: 'efficiency', showBenchmarks: true },
          title: 'Processing Efficiency'
        },
        {
          id: 'perf-engagement',
          component: 'trend-analysis',
          size: 'large',
          position: { x: 2, y: 0, w: 2, h: 1 },
          props: { analysisType: 'engagement', showUserSegments: true },
          title: 'User Engagement Metrics'
        }
      ]
    },
    {
      id: 'comparative-analysis',
      name: 'Comparative Analysis',
      description: 'Cross-dataset comparison and benchmark analysis',
      category: 'comparison',
      complexity: 'advanced',
      tags: ['comparison', 'benchmarks', 'analysis'],
      layout: [
        {
          id: 'comparison-main',
          component: 'comparison',
          size: 'full',
          position: { x: 0, y: 0, w: 4, h: 2 },
          props: { 
            chartType: 'bar', 
            showBenchmark: true, 
            enableDrilldown: true,
            comparisonTypes: ['week', 'month', 'quarter'] 
          },
          title: 'Multi-Period Comparison Analysis'
        }
      ]
    }
  ];

  /**
   * Get all available views for a user, including defaults and custom views
   */
  async getViews(options: ViewServiceOptions = {}): Promise<DashboardView[]> {
    const cacheKey = `views_${JSON.stringify(options)}`;
    
    if (this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const views: DashboardView[] = [];

      // Add default views if requested
      if (options.includeDefaults !== false) {
        const defaultViews = this.DEFAULT_TEMPLATES.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          layout: template.layout,
          isDefault: true,
          isCustom: false,
          tags: template.tags,
          createdAt: new Date('2024-01-01'), // Default creation date
          usageCount: 0
        }));
        views.push(...defaultViews);
      }

      // Load custom views from localStorage
      const customViews = this.loadCustomViewsFromStorage(options);
      views.push(...customViews);

      // Load shared/public views if requested
      if (options.includePublic && options.organizationId) {
        const publicViews = await this.loadPublicViews(options);
        views.push(...publicViews);
      }

      // Apply sorting
      const sortedViews = this.sortViews(views, options.sortBy || 'name');

      // Apply filtering
      const filteredViews = this.filterViews(sortedViews, options.filterBy);

      this.setCacheData(cacheKey, filteredViews);
      return filteredViews;

    } catch (error) {
      console.error('Error loading views:', error);
      // Return default views as fallback
      return this.DEFAULT_TEMPLATES.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        layout: template.layout,
        isDefault: true,
        isCustom: false,
        tags: template.tags,
        createdAt: new Date('2024-01-01'),
        usageCount: 0
      }));
    }
  }

  /**
   * Get a specific view by ID
   */
  async getViewById(viewId: string, options: ViewServiceOptions = {}): Promise<DashboardView | null> {
    const views = await this.getViews(options);
    return views.find(view => view.id === viewId) || null;
  }

  /**
   * Create a new custom view
   */
  async createView(viewData: Partial<DashboardView>, options: ViewServiceOptions = {}): Promise<DashboardView> {
    const view: DashboardView = {
      id: viewData.id || this.generateViewId(),
      name: viewData.name || 'Untitled View',
      description: viewData.description,
      layout: viewData.layout || [],
      isDefault: false,
      isCustom: true,
      userId: options.userId,
      organizationId: options.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: viewData.tags || [],
      isPublic: viewData.isPublic || false,
      usageCount: 0
    };

    // Validate layout configuration
    this.validateLayout(view.layout);

    // Save to localStorage for immediate use
    this.saveCustomViewToStorage(view);

    // If we have a valid database connection, also save to backend
    if (options.userId && supabase) {
      try {
        await this.saveViewToDatabase(view);
      } catch (error) {
        console.warn('Failed to save view to database, using local storage only:', error);
      }
    }

    // Clear cache to force refresh
    this.clearViewsCache();

    return view;
  }

  /**
   * Update an existing view
   */
  async updateView(viewId: string, updates: Partial<DashboardView>, options: ViewServiceOptions = {}): Promise<DashboardView> {
    const existingView = await this.getViewById(viewId, options);
    
    if (!existingView) {
      throw new Error(`View with ID ${viewId} not found`);
    }

    if (existingView.isDefault && !options.userId) {
      throw new Error('Cannot modify default views without user context');
    }

    const updatedView: DashboardView = {
      ...existingView,
      ...updates,
      id: viewId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    // Validate layout if it was updated
    if (updates.layout) {
      this.validateLayout(updatedView.layout);
    }

    // Save updates
    this.saveCustomViewToStorage(updatedView);

    if (options.userId && supabase) {
      try {
        await this.saveViewToDatabase(updatedView);
      } catch (error) {
        console.warn('Failed to update view in database:', error);
      }
    }

    this.clearViewsCache();
    return updatedView;
  }

  /**
   * Delete a custom view
   */
  async deleteView(viewId: string, options: ViewServiceOptions = {}): Promise<boolean> {
    const view = await this.getViewById(viewId, options);
    
    if (!view) {
      throw new Error(`View with ID ${viewId} not found`);
    }

    if (view.isDefault) {
      throw new Error('Cannot delete default views');
    }

    // Remove from localStorage
    this.removeViewFromStorage(viewId);

    // Remove from database if applicable
    if (options.userId && supabase) {
      try {
        await this.deleteViewFromDatabase(viewId, options.userId);
      } catch (error) {
        console.warn('Failed to delete view from database:', error);
      }
    }

    this.clearViewsCache();
    return true;
  }

  /**
   * Get view suggestions based on user data patterns and usage
   */
  async getViewSuggestions(options: ViewServiceOptions = {}): Promise<ViewSuggestion[]> {
    const cacheKey = `suggestions_${JSON.stringify(options)}`;
    
    if (this.getCachedData(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      // Get user's historical data patterns to inform suggestions
      const userPatterns = await this.analyzeUserDataPatterns(options);
      
      const suggestions: ViewSuggestion[] = [];

      // Analyze each template for relevance
      for (const template of this.DEFAULT_TEMPLATES) {
        const relevanceScore = this.calculateRelevanceScore(template, userPatterns);
        
        if (relevanceScore > 0.3) { // Only suggest if relevance > 30%
          const reasoning = this.generateSuggestionReasoning(template, userPatterns);
          const usefulnessScore = this.estimateUsefulnessScore(template, userPatterns);
          
          suggestions.push({
            template,
            relevanceScore,
            reasoning,
            requiredComponents: template.layout.map(l => l.component),
            estimatedUsefulnessScore: usefulnessScore
          });
        }
      }

      // Sort by relevance score
      suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

      this.setCacheData(cacheKey, suggestions, 30 * 60 * 1000); // Cache for 30 minutes
      return suggestions;

    } catch (error) {
      console.error('Error generating view suggestions:', error);
      return [];
    }
  }

  /**
   * Duplicate an existing view with modifications
   */
  async duplicateView(sourceViewId: string, newName: string, options: ViewServiceOptions = {}): Promise<DashboardView> {
    const sourceView = await this.getViewById(sourceViewId, options);
    
    if (!sourceView) {
      throw new Error(`Source view with ID ${sourceViewId} not found`);
    }

    return this.createView({
      name: newName,
      description: `Copy of ${sourceView.name}`,
      layout: JSON.parse(JSON.stringify(sourceView.layout)), // Deep copy
      tags: [...(sourceView.tags || []), 'duplicate'],
      isPublic: false
    }, options);
  }

  /**
   * Track view usage for analytics and suggestions
   */
  async trackViewUsage(viewId: string, options: ViewServiceOptions = {}): Promise<void> {
    try {
      const analytics = this.getViewAnalyticsFromStorage(viewId) || {
        viewId,
        userId: options.userId,
        accessCount: 0,
        lastAccessed: new Date(),
        averageTimeSpent: 0,
        mostUsedComponents: [],
        preferredTimeRange: 'daily'
      };

      analytics.accessCount++;
      analytics.lastAccessed = new Date();

      this.saveViewAnalyticsToStorage(analytics);

      // Also update usage count in the view itself
      const view = await this.getViewById(viewId, options);
      if (view && view.isCustom) {
        await this.updateView(viewId, {
          usageCount: (view.usageCount || 0) + 1
        }, options);
      }

    } catch (error) {
      console.error('Error tracking view usage:', error);
      // Non-critical error, don't throw
    }
  }

  // Private helper methods

  private loadCustomViewsFromStorage(options: ViewServiceOptions): DashboardView[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const allViews: DashboardView[] = JSON.parse(stored);
      
      // Filter by user/organization if specified
      return allViews.filter(view => {
        if (options.userId && view.userId !== options.userId) return false;
        if (options.organizationId && view.organizationId !== options.organizationId) return false;
        return true;
      });
    } catch (error) {
      console.error('Error loading custom views from storage:', error);
      return [];
    }
  }

  private saveCustomViewToStorage(view: DashboardView): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const allViews: DashboardView[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing view with same ID
      const filteredViews = allViews.filter(v => v.id !== view.id);
      filteredViews.push(view);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredViews));
    } catch (error) {
      console.error('Error saving view to storage:', error);
    }
  }

  private removeViewFromStorage(viewId: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const allViews: DashboardView[] = JSON.parse(stored);
      const filteredViews = allViews.filter(view => view.id !== viewId);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredViews));
    } catch (error) {
      console.error('Error removing view from storage:', error);
    }
  }

  private async loadPublicViews(options: ViewServiceOptions): Promise<DashboardView[]> {
    // This would load shared views from the database
    // For now, return empty array as this requires backend setup
    return [];
  }

  private async saveViewToDatabase(view: DashboardView): Promise<void> {
    // This would save to a 'custom_views' table in Supabase
    // Implementation depends on database schema
  }

  private async deleteViewFromDatabase(viewId: string, userId: string): Promise<void> {
    // This would delete from the database
  }

  private sortViews(views: DashboardView[], sortBy: string): DashboardView[] {
    switch (sortBy) {
      case 'created':
        return views.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      case 'usage':
        return views.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      case 'name':
      default:
        return views.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  private filterViews(views: DashboardView[], filterBy?: ViewServiceOptions['filterBy']): DashboardView[] {
    if (!filterBy) return views;

    return views.filter(view => {
      if (filterBy.tags && filterBy.tags.length > 0) {
        const hasMatchingTag = filterBy.tags.some(tag => 
          view.tags?.some(viewTag => viewTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }

  private validateLayout(layout: LayoutConfig[]): void {
    const errors: string[] = [];

    // Check for duplicate IDs
    const ids = layout.map(l => l.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate layout IDs found: ${duplicateIds.join(', ')}`);
    }

    // Validate positions don't overlap
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        if (this.layoutsOverlap(layout[i], layout[j])) {
          errors.push(`Layouts ${layout[i].id} and ${layout[j].id} overlap`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Layout validation failed: ${errors.join('; ')}`);
    }
  }

  private layoutsOverlap(layout1: LayoutConfig, layout2: LayoutConfig): boolean {
    const l1 = layout1.position;
    const l2 = layout2.position;
    
    return !(l1.x + l1.w <= l2.x || 
             l2.x + l2.w <= l1.x || 
             l1.y + l1.h <= l2.y || 
             l2.y + l2.h <= l1.y);
  }

  private async analyzeUserDataPatterns(options: ViewServiceOptions): Promise<any> {
    // This would analyze user's data patterns to inform suggestions
    // For now, return mock data
    return {
      primaryDataType: 'quality',
      errorFrequency: 'medium',
      timeRangePreference: 'weekly',
      mostUsedComponents: ['quality-trends', 'error-distribution']
    };
  }

  private calculateRelevanceScore(template: ViewTemplate, userPatterns: any): number {
    // Calculate how relevant this template is to the user's patterns
    let score = 0.5; // Base score
    
    if (template.category === userPatterns.primaryDataType) score += 0.3;
    if (template.complexity === 'beginner' && userPatterns.experienceLevel === 'new') score += 0.2;
    
    return Math.min(score, 1.0);
  }

  private generateSuggestionReasoning(template: ViewTemplate, userPatterns: any): string[] {
    const reasons = [];
    
    if (template.category === 'quality') {
      reasons.push('Matches your focus on quality metrics');
    }
    
    if (template.complexity === 'beginner') {
      reasons.push('Designed for users new to analytics dashboards');
    }
    
    return reasons;
  }

  private estimateUsefulnessScore(template: ViewTemplate, userPatterns: any): number {
    // Estimate how useful this template would be
    return Math.random() * 0.3 + 0.7; // Mock score between 0.7-1.0
  }

  private getViewAnalyticsFromStorage(viewId: string): ViewAnalytics | null {
    try {
      const stored = localStorage.getItem(`view_analytics_${viewId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveViewAnalyticsToStorage(analytics: ViewAnalytics): void {
    try {
      localStorage.setItem(`view_analytics_${analytics.viewId}`, JSON.stringify(analytics));
    } catch (error) {
      console.error('Error saving view analytics:', error);
    }
  }

  private generateViewId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  private setCacheData(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private clearViewsCache(): void {
    // Clear all cached view data
    for (const key of this.cache.keys()) {
      if (key.startsWith('views_') || key.startsWith('suggestions_')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Public method to clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const analyticsViewService = new AnalyticsViewService(); 