/**
 * Template Manager Component
 * 
 * Main interface for managing scoring model templates including:
 * - Template browsing and search
 * - Template creation from existing models
 * - Template editing and deletion
 * - Template versioning and sharing
 * - Integration with TemplateManager utility
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Plus,
  Save,
  Share2,
  Copy,
  Edit,
  Trash2,
  Star,
  StarOff,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  Upload,
  Tag,
  Clock,
  User,
  Eye,
  EyeOff,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

import type { 
  ScoringModelTemplate, 
  CustomScoringModel,
  ScoringModelConfig 
} from '@/lib/types/scoring-models';
import { AssessmentFramework } from '@/lib/types/assessment';
import { 
  TemplateManager as TM, 
  type TemplateSearchOptions, 
  type TemplateCreateData,
  type TemplateUpdateData,
  type TemplateStats
} from '@/lib/utils/template-manager';

interface TemplateManagerProps {
  /** Current scoring model for template creation */
  currentModel?: CustomScoringModel;
  /** Called when template is loaded into model */
  onTemplateLoad?: (model: CustomScoringModel) => void;
  /** Called when template management state changes */
  onStateChange?: (state: TemplateManagerState) => void;
  /** Whether to show only public templates */
  publicOnly?: boolean;
  /** Current user ID for permissions */
  userId?: string;
  /** Organization ID for scoped templates */
  organizationId?: string;
}

interface TemplateManagerState {
  selectedTemplate: ScoringModelTemplate | null;
  isCreating: boolean;
  isEditing: boolean;
  searchQuery: string;
  selectedCategory: string;
  sortBy: string;
  showStats: boolean;
}

interface CreateTemplateFormData {
  name: string;
  description: string;
  category: 'translation' | 'content' | 'technical' | 'general';
  framework: AssessmentFramework;
  isPublic: boolean;
  tags: string[];
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  currentModel,
  onTemplateLoad,
  onStateChange,
  publicOnly = false,
  userId,
  organizationId
}) => {
  // Template manager instance
  const templateManager = useMemo(() => TM.getInstance(), []);

  // Component state
  const [state, setState] = useState<TemplateManagerState>({
    selectedTemplate: null,
    isCreating: false,
    isEditing: false,
    searchQuery: '',
    selectedCategory: 'all',
    sortBy: 'usageCount',
    showStats: false
  });

  // Template data
  const [templates, setTemplates] = useState<ScoringModelTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating/editing templates
  const [formData, setFormData] = useState<CreateTemplateFormData>({
    name: '',
    description: '',
    category: 'general',
    framework: AssessmentFramework.CUSTOM,
    isPublic: false,
    tags: []
  });

  // Tag input state
  const [newTag, setNewTag] = useState('');

  // Update parent state when local state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Load templates on mount and when search options change
  useEffect(() => {
    loadTemplates();
  }, [state.searchQuery, state.selectedCategory, state.sortBy, publicOnly]);

  const updateState = useCallback((updates: Partial<TemplateManagerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchOptions: TemplateSearchOptions = {
        query: state.searchQuery || undefined,
        category: state.selectedCategory === 'all' ? undefined : state.selectedCategory as any,
        isPublic: publicOnly ? true : undefined,
        organizationId: publicOnly ? undefined : organizationId,
        sortBy: state.sortBy as any,
        sortOrder: 'desc'
      };

      const result = await templateManager.searchTemplates(searchOptions);
      setTemplates(result.templates);
      setStats(result.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [templateManager, state.searchQuery, state.selectedCategory, state.sortBy, publicOnly, organizationId]);

  const handleCreateTemplate = useCallback(async () => {
    if (!currentModel) {
      setError('No current model to create template from');
      return;
    }

    try {
      setLoading(true);
      const templateData: TemplateCreateData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        config: currentModel.config,
        framework: formData.framework,
        isPublic: formData.isPublic,
        tags: formData.tags,
        organizationId,
        userId
      };

      const newTemplate = await templateManager.createTemplate(templateData);
      await loadTemplates();
      
      // Reset form and close dialog
      setFormData({
        name: '',
        description: '',
        category: 'general',
        framework: AssessmentFramework.CUSTOM,
        isPublic: false,
        tags: []
      });
      updateState({ isCreating: false, selectedTemplate: newTemplate });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  }, [currentModel, formData, templateManager, organizationId, userId, loadTemplates, updateState]);

  const handleLoadTemplate = useCallback(async (template: ScoringModelTemplate) => {
    try {
      const model = await templateManager.cloneTemplate(template.id, userId);
      onTemplateLoad?.(model);
      updateState({ selectedTemplate: template });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    }
  }, [templateManager, userId, onTemplateLoad, updateState]);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await templateManager.deleteTemplate(templateId, userId);
      await loadTemplates();
      if (state.selectedTemplate?.id === templateId) {
        updateState({ selectedTemplate: null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }, [templateManager, userId, loadTemplates, state.selectedTemplate, updateState]);

  const handleRateTemplate = useCallback(async (templateId: string, rating: number) => {
    try {
      await templateManager.rateTemplate(templateId, rating, userId);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rate template');
    }
  }, [templateManager, userId, loadTemplates]);

  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  }, [newTag, formData.tags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }, []);

  const canEdit = useCallback((template: ScoringModelTemplate) => {
    return template.createdBy === userId;
  }, [userId]);

  const renderTemplateCard = useCallback((template: ScoringModelTemplate) => (
    <Card 
      key={template.id} 
      className={`cursor-pointer transition-all hover:shadow-md ${
        state.selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => updateState({ selectedTemplate: template })}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {template.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 ml-3">
            {template.isPublic ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Category and Framework */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {template.category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {template.framework}
            </Badge>
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{template.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {template.usageCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {template.rating || 0}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(template.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadTemplate(template);
              }}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-1" />
              Load
            </Button>
            
            {canEdit(template) && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  updateState({ isEditing: true, selectedTemplate: template });
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            {canEdit(template) && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this template?')) {
                    handleDeleteTemplate(template.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  ), [state.selectedTemplate, updateState, handleLoadTemplate, canEdit, handleDeleteTemplate]);

  const renderCreateDialog = () => (
    <Dialog open={state.isCreating} onOpenChange={(open) => updateState({ isCreating: open })}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
          <DialogDescription>
            Save your current scoring model as a reusable template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            
            <div>
              <Label htmlFor="template-description">Description *</Label>
              <Textarea
                id="template-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this template is for"
                rows={3}
              />
            </div>
          </div>

          {/* Category and Framework */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template-category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="translation">Translation</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="template-framework">Assessment Framework</Label>
              <Select 
                value={formData.framework} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, framework: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AssessmentFramework.MQM}>MQM</SelectItem>
                  <SelectItem value={AssessmentFramework.DQF}>DQF</SelectItem>
                  <SelectItem value={AssessmentFramework.CUSTOM}>Custom</SelectItem>
                  <SelectItem value={AssessmentFramework.LISA_QA}>LISA QA</SelectItem>
                  <SelectItem value={AssessmentFramework.SAE_J2450}>SAE J2450</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <Button size="sm" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="cursor-pointer">
                  {tag}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={() => removeTag(tag)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="template-public"
              checked={formData.isPublic}
              onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
            />
            <Label htmlFor="template-public">Make this template public</Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => updateState({ isCreating: false })}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={loading || !formData.name || !formData.description}
            >
              {loading ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Manager</h2>
          <p className="text-muted-foreground">
            Manage and share your scoring model templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentModel && (
            <Button onClick={() => updateState({ isCreating: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => updateState({ showStats: !state.showStats })}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Panel */}
      {state.showStats && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalTemplates}</div>
                <div className="text-sm text-muted-foreground">Total Templates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.publicTemplates}</div>
                <div className="text-sm text-muted-foreground">Public Templates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Average Rating</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.topTags.length}</div>
                <div className="text-sm text-muted-foreground">Unique Tags</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={state.searchQuery}
                onChange={(e) => updateState({ searchQuery: e.target.value })}
                className="pl-9"
              />
            </div>
            
            <Select value={state.selectedCategory} onValueChange={(value) => updateState({ selectedCategory: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="translation">Translation</SelectItem>
                <SelectItem value="content">Content</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={state.sortBy} onValueChange={(value) => updateState({ sortBy: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usageCount">Most Used</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="createdAt">Newest</SelectItem>
                <SelectItem value="updatedAt">Recently Updated</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={loadTemplates} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(renderTemplateCard)}
      </div>

      {/* Empty State */}
      {templates.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                No templates found matching your criteria
              </div>
              {currentModel && (
                <Button onClick={() => updateState({ isCreating: true })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Template Dialog */}
      {renderCreateDialog()}
    </div>
  );
};

export default TemplateManager; 