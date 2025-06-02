import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  DashboardView, 
  LayoutConfig, 
  ViewTemplate 
} from "@/lib/services/analytics-view-service";
import { 
  Plus, 
  Trash2, 
  Copy, 
  Move, 
  Settings, 
  Eye, 
  EyeOff, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  GitCompare,
  Layers,
  Grid,
  Palette,
  Save,
  X
} from "lucide-react";

interface ViewEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (view: DashboardView) => Promise<void>;
  view?: DashboardView | null;
  templates?: ViewTemplate[];
  userId?: string;
  organizationId?: string;
}

interface ComponentOption {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  defaultSize: 'small' | 'medium' | 'large' | 'full';
  configurable: boolean;
}

const COMPONENT_OPTIONS: ComponentOption[] = [
  {
    id: 'quality-trends',
    name: 'Quality Trends',
    icon: TrendingUp,
    description: 'Display quality metrics over time',
    defaultSize: 'large',
    configurable: true
  },
  {
    id: 'error-distribution',
    name: 'Error Distribution',
    icon: PieChart,
    description: 'Show error distribution and patterns',
    defaultSize: 'medium',
    configurable: true
  },
  {
    id: 'trend-analysis',
    name: 'Trend Analysis',
    icon: BarChart3,
    description: 'Advanced trend analysis and forecasting',
    defaultSize: 'large',
    configurable: true
  },
  {
    id: 'comparison',
    name: 'Comparison Chart',
    icon: GitCompare,
    description: 'Compare datasets and benchmarks',
    defaultSize: 'full',
    configurable: true
  }
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small (1x1)', dimensions: '1x1' },
  { value: 'medium', label: 'Medium (2x1)', dimensions: '2x1' },
  { value: 'large', label: 'Large (2x2)', dimensions: '2x2' },
  { value: 'full', label: 'Full Width (4x2)', dimensions: '4x2' }
];

export function ViewEditor({ 
  isOpen, 
  onClose, 
  onSave, 
  view, 
  templates = [], 
  userId, 
  organizationId 
}: ViewEditorProps) {
  const [formData, setFormData] = useState<Partial<DashboardView>>({
    name: '',
    description: '',
    layout: [],
    tags: [],
    isPublic: false
  });
  
  const [layoutComponents, setLayoutComponents] = useState<LayoutConfig[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<LayoutConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('basic');
  const [previewMode, setPreviewMode] = useState(false);

  // Initialize form when view changes
  useEffect(() => {
    if (view) {
      setFormData({
        name: view.name,
        description: view.description || '',
        layout: view.layout || [],
        tags: view.tags || [],
        isPublic: view.isPublic || false
      });
      setLayoutComponents(view.layout || []);
    } else {
      setFormData({
        name: '',
        description: '',
        layout: [],
        tags: [],
        isPublic: false
      });
      setLayoutComponents([]);
    }
    setSelectedComponent(null);
  }, [view]);

  const handleBasicInfoChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    setFormData(prev => ({
      ...prev,
      tags
    }));
  };

  const addComponent = (componentType: string) => {
    const componentOption = COMPONENT_OPTIONS.find(opt => opt.id === componentType);
    if (!componentOption) return;

    const newComponent: LayoutConfig = {
      id: `${componentType}-${Date.now()}`,
      component: componentType as any,
      size: componentOption.defaultSize,
      position: findAvailablePosition(componentOption.defaultSize),
      title: componentOption.name,
      isVisible: true,
      props: getDefaultProps(componentType)
    };

    setLayoutComponents(prev => [...prev, newComponent]);
    setSelectedComponent(newComponent);
  };

  const updateComponent = (componentId: string, updates: Partial<LayoutConfig>) => {
    setLayoutComponents(prev => 
      prev.map(comp => 
        comp.id === componentId ? { ...comp, ...updates } : comp
      )
    );
    
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const removeComponent = (componentId: string) => {
    setLayoutComponents(prev => prev.filter(comp => comp.id !== componentId));
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
    }
  };

  const duplicateComponent = (componentId: string) => {
    const component = layoutComponents.find(comp => comp.id === componentId);
    if (!component) return;

    const duplicatedComponent: LayoutConfig = {
      ...component,
      id: `${component.component}-${Date.now()}`,
      title: `${component.title} (Copy)`,
      position: findAvailablePosition(component.size)
    };

    setLayoutComponents(prev => [...prev, duplicatedComponent]);
  };

  const findAvailablePosition = (size: string): { x: number; y: number; w: number; h: number } => {
    const sizeMap = {
      small: { w: 1, h: 1 },
      medium: { w: 2, h: 1 },
      large: { w: 2, h: 2 },
      full: { w: 4, h: 2 }
    };

    const dimensions = sizeMap[size] || sizeMap.medium;
    
    // Simple positioning logic - place components in a grid
    const usedPositions = layoutComponents.map(comp => comp.position);
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 4; x++) {
        const position = { x, y, ...dimensions };
        
        // Check if this position conflicts with existing components
        const hasConflict = usedPositions.some(used => 
          !(position.x + position.w <= used.x || 
            used.x + used.w <= position.x || 
            position.y + position.h <= used.y || 
            used.y + used.h <= position.y)
        );
        
        if (!hasConflict) {
          return position;
        }
      }
    }
    
    // Fallback: place at the end
    return { x: 0, y: layoutComponents.length * 2, ...dimensions };
  };

  const getDefaultProps = (componentType: string): Record<string, any> => {
    switch (componentType) {
      case 'quality-trends':
        return { metrics: ['mqm', 'overall'], showTrends: true };
      case 'error-distribution':
        return { chartType: 'pie', showLegend: true };
      case 'trend-analysis':
        return { analysisType: 'quality', showForecast: false };
      case 'comparison':
        return { chartType: 'bar', showBenchmark: true };
      default:
        return {};
    }
  };

  const applyTemplate = (template: ViewTemplate) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      tags: template.tags
    }));
    setLayoutComponents(template.layout);
    setCurrentTab('layout');
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      const viewToSave: DashboardView = {
        id: view?.id || `custom_${Date.now()}`,
        name: formData.name || 'Untitled View',
        description: formData.description,
        layout: layoutComponents,
        isDefault: false,
        isCustom: true,
        userId,
        organizationId,
        createdAt: view?.createdAt || new Date(),
        updatedAt: new Date(),
        tags: formData.tags || [],
        isPublic: formData.isPublic || false,
        usageCount: view?.usageCount || 0
      };

      await onSave(viewToSave);
      onClose();
    } catch (error) {
      console.error('Error saving view:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderComponentCard = (component: LayoutConfig) => {
    const option = COMPONENT_OPTIONS.find(opt => opt.id === component.component);
    const IconComponent = option?.icon || Layers;
    
    return (
      <Card 
        key={component.id}
        className={`cursor-pointer transition-all ${
          selectedComponent?.id === component.id ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => setSelectedComponent(component)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className="h-4 w-4" />
              <CardTitle className="text-sm">{component.title}</CardTitle>
              {!component.isVisible && <EyeOff className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateComponent(component.id);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeComponent(component.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {SIZE_OPTIONS.find(size => size.value === component.size)?.dimensions}
            </Badge>
            <span>Position: {component.position.x},{component.position.y}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderComponentProperties = () => {
    if (!selectedComponent) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="text-center">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            <p>Select a component to edit its properties</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="component-title">Title</Label>
          <Input
            id="component-title"
            value={selectedComponent.title || ''}
            onChange={(e) => updateComponent(selectedComponent.id, { title: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="component-size">Size</Label>
          <Select
            value={selectedComponent.size}
            onValueChange={(value) => updateComponent(selectedComponent.id, { size: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map(size => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="component-visible"
            checked={selectedComponent.isVisible !== false}
            onCheckedChange={(checked) => updateComponent(selectedComponent.id, { isVisible: checked })}
          />
          <Label htmlFor="component-visible">Visible</Label>
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Component Properties</Label>
          <div className="mt-2 space-y-2 text-sm">
            {Object.entries(selectedComponent.props || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}:</span>
                <span>{JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {view ? 'Edit View' : 'Create Custom View'}
          </DialogTitle>
          <DialogDescription>
            {view 
              ? 'Modify your analytics dashboard view'
              : 'Design a custom analytics dashboard layout'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="layout">Layout Design</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label htmlFor="view-name">View Name</Label>
                <Input
                  id="view-name"
                  value={formData.name}
                  onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                  placeholder="Enter view name"
                />
              </div>

              <div>
                <Label htmlFor="view-description">Description</Label>
                <Textarea
                  id="view-description"
                  value={formData.description}
                  onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                  placeholder="Describe the purpose of this view"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="view-tags">Tags (comma-separated)</Label>
                <Input
                  id="view-tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="analytics, quality, custom"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="view-public"
                  checked={formData.isPublic || false}
                  onCheckedChange={(checked) => handleBasicInfoChange('isPublic', checked)}
                />
                <Label htmlFor="view-public">Make this view public to organization</Label>
              </div>
            </TabsContent>

            <TabsContent value="layout" className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? <Eye className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
                    {previewMode ? 'Edit Mode' : 'Preview'}
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {layoutComponents.length} component{layoutComponents.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Component Library */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Components
                  </h4>
                  {COMPONENT_OPTIONS.map(option => {
                    const IconComponent = option.icon;
                    return (
                      <Card 
                        key={option.id}
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => addComponent(option.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <div>
                              <div className="font-medium text-sm">{option.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {option.description}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Layout Components */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Layout Components
                  </h4>
                  {layoutComponents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Grid className="h-8 w-8 mx-auto mb-2" />
                      <p>No components added yet</p>
                      <p className="text-xs">Add components from the left panel</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {layoutComponents.map(renderComponentCard)}
                    </div>
                  )}
                </div>

                {/* Component Properties */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Properties
                  </h4>
                  {renderComponentProperties()}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Start with a pre-designed template and customize it to your needs.
              </div>
              
              {templates.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Palette className="h-8 w-8 mx-auto mb-2" />
                  <p>No templates available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(template => (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => applyTemplate(template)}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {template.complexity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {template.layout.length} components
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !formData.name}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : (view ? 'Update View' : 'Create View')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 