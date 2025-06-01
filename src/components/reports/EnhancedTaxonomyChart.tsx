import React, { useState, useMemo } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Treemap,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { 
  MQMDimension, 
  MQMErrorInstance, 
  MQMSeverity 
} from "@/lib/types/assessment";
import { 
  ExpandedErrorCategory, 
  ErrorDomain, 
  HierarchicalErrorPath 
} from "@/lib/types/mqm-taxonomy-expansion";

interface TaxonomyNodeData {
  name: string;
  fullName: string;
  value: number;
  percentage: number;
  errorCount: number;
  severity: MQMSeverity;
  dimension?: MQMDimension;
  domain?: ErrorDomain;
  children?: TaxonomyNodeData[];
  level: 'dimension' | 'category' | 'subcategory' | 'leaf';
  hierarchicalPath?: string;
  color?: string;
}

interface DrillDownPath {
  level: 'dimension' | 'category' | 'subcategory' | 'leaf';
  name: string;
  fullName: string;
  hierarchicalPath: string;
}

interface EnhancedTaxonomyChartProps {
  errors: MQMErrorInstance[];
  expandedCategories: ExpandedErrorCategory[];
  onDrillDown?: (path: DrillDownPath[]) => void;
  selectedDomain?: ErrorDomain;
  className?: string;
}

const chartConfig = {
  accuracy: {
    label: "Accuracy",
    color: "hsl(0 84% 60%)",
  },
  terminology: {
    label: "Terminology", 
    color: "hsl(25 95% 53%)",
  },
  linguistic: {
    label: "Linguistic Conventions",
    color: "hsl(47 96% 53%)",
  },
  style: {
    label: "Style",
    color: "hsl(142 76% 36%)",
  },
  locale: {
    label: "Locale Conventions",
    color: "hsl(221 83% 53%)",
  },
  audience: {
    label: "Audience Appropriateness",
    color: "hsl(262 83% 58%)",
  },
  design: {
    label: "Design and Markup",
    color: "hsl(332 81% 60%)",
  },
} satisfies ChartConfig;

const getSeverityColor = (severity: MQMSeverity): string => {
  switch (severity) {
    case MQMSeverity.CRITICAL:
      return 'hsl(0 84% 60%)'; // Red
    case MQMSeverity.MAJOR:
      return 'hsl(25 95% 53%)'; // Orange
    case MQMSeverity.MINOR:
      return 'hsl(47 96% 53%)'; // Yellow
    case MQMSeverity.NEUTRAL:
      return 'hsl(142 76% 36%)'; // Green
    default:
      return 'hsl(210 40% 50%)'; // Gray
  }
};

const getDimensionColor = (dimension: MQMDimension): string => {
  const dimensionKey = dimension.toLowerCase().replace('_', '') as keyof typeof chartConfig;
  return chartConfig[dimensionKey]?.color || 'hsl(210 40% 50%)';
};

export function EnhancedTaxonomyChart({ 
  errors, 
  expandedCategories, 
  onDrillDown,
  selectedDomain,
  className 
}: EnhancedTaxonomyChartProps) {
  const [currentPath, setCurrentPath] = useState<DrillDownPath[]>([]);
  const [viewMode, setViewMode] = useState<'treemap' | 'hierarchy'>('treemap');

  // Process error data into hierarchical structure
  const taxonomyData = useMemo(() => {
    // Group errors by hierarchical path
    const errorGroups = new Map<string, MQMErrorInstance[]>();
    
    errors.forEach(error => {
      // Create hierarchical path based on error properties
      const dimension = error.dimension;
      const category = error.category;
      
      // Build paths for different levels
      const dimensionPath = dimension;
      const categoryPath = `${dimension}/${category}`;
      
      // Add to dimension level
      if (!errorGroups.has(dimensionPath)) {
        errorGroups.set(dimensionPath, []);
      }
      errorGroups.get(dimensionPath)!.push(error);
      
      // Add to category level
      if (!errorGroups.has(categoryPath)) {
        errorGroups.set(categoryPath, []);
      }
      errorGroups.get(categoryPath)!.push(error);
    });

    // Convert to tree structure
    const buildTreeData = (): TaxonomyNodeData[] => {
      const dimensions = new Map<MQMDimension, TaxonomyNodeData>();
      
      // Group by dimension
      Object.values(MQMDimension).forEach(dimension => {
        const dimensionErrors = errors.filter(e => e.dimension === dimension);
        if (dimensionErrors.length === 0) return;
        
        // Calculate severity distribution
        const severityCounts = {
          [MQMSeverity.CRITICAL]: 0,
          [MQMSeverity.MAJOR]: 0,
          [MQMSeverity.MINOR]: 0,
          [MQMSeverity.NEUTRAL]: 0
        };
        
        dimensionErrors.forEach(error => {
          severityCounts[error.severity]++;
        });
        
        // Determine predominant severity
        const predominantSeverity = Object.entries(severityCounts).reduce((a, b) => 
          severityCounts[a[0] as MQMSeverity] > severityCounts[b[0] as MQMSeverity] ? a : b
        )[0] as MQMSeverity;
        
        const dimensionNode: TaxonomyNodeData = {
          name: dimension.replace('_', ' '),
          fullName: dimension.replace('_', ' '),
          value: dimensionErrors.length,
          percentage: (dimensionErrors.length / errors.length) * 100,
          errorCount: dimensionErrors.length,
          severity: predominantSeverity,
          dimension,
          level: 'dimension',
          hierarchicalPath: dimension,
          color: getDimensionColor(dimension),
          children: []
        };
        
        // Group by category within dimension
        const categories = new Map<string, MQMErrorInstance[]>();
        dimensionErrors.forEach(error => {
          const category = error.category;
          if (!categories.has(category)) {
            categories.set(category, []);
          }
          categories.get(category)!.push(error);
        });
        
        // Build category nodes
        categories.forEach((categoryErrors, category) => {
          const categoryNode: TaxonomyNodeData = {
            name: category.replace(/_/g, ' '),
            fullName: `${dimension.replace('_', ' ')} > ${category.replace(/_/g, ' ')}`,
            value: categoryErrors.length,
            percentage: (categoryErrors.length / dimensionErrors.length) * 100,
            errorCount: categoryErrors.length,
            severity: categoryErrors[0]?.severity || MQMSeverity.MINOR,
            level: 'category',
            hierarchicalPath: `${dimension}/${category}`,
            color: getSeverityColor(categoryErrors[0]?.severity || MQMSeverity.MINOR)
          };
          
          dimensionNode.children!.push(categoryNode);
        });
        
        dimensions.set(dimension, dimensionNode);
      });
      
      return Array.from(dimensions.values());
    };

    return buildTreeData();
  }, [errors, selectedDomain]);

  // Get current level data based on drill-down path
  const currentLevelData = useMemo(() => {
    if (currentPath.length === 0) {
      return taxonomyData;
    }
    
    let current = taxonomyData;
    for (const pathSegment of currentPath) {
      const found = current.find(item => item.hierarchicalPath === pathSegment.hierarchicalPath);
      if (found && found.children) {
        current = found.children;
      } else {
        return [];
      }
    }
    
    return current;
  }, [taxonomyData, currentPath]);

  const handleNodeClick = (node: TaxonomyNodeData) => {
    if (node.children && node.children.length > 0) {
      const newPath = [...currentPath, {
        level: node.level,
        name: node.name,
        fullName: node.fullName,
        hierarchicalPath: node.hierarchicalPath || ''
      }];
      setCurrentPath(newPath);
      onDrillDown?.(newPath);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = currentPath.slice(0, index);
    setCurrentPath(newPath);
    onDrillDown?.(newPath);
  };

  const resetToRoot = () => {
    setCurrentPath([]);
    onDrillDown?.([]);
  };

  // Custom treemap content
  const CustomTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors } = props;
    
    if (depth === 1) {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={payload.color}
            fillOpacity={0.8}
            stroke="#fff"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(payload)}
          />
          {width > 60 && height > 40 && (
            <text
              x={x + width / 2}
              y={y + height / 2}
              textAnchor="middle"
              fill="#fff"
              fontSize="12"
              fontWeight="bold"
            >
              <tspan x={x + width / 2} dy="0">{payload.name}</tspan>
              <tspan x={x + width / 2} dy="16">{payload.errorCount} errors</tspan>
            </text>
          )}
        </g>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Enhanced Taxonomy Analysis
              {selectedDomain && (
                <Badge variant="secondary">
                  {selectedDomain.replace('_', ' ')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Hierarchical error distribution with drill-down capabilities
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'treemap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('treemap')}
            >
              Treemap
            </Button>
            <Button
              variant={viewMode === 'hierarchy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('hierarchy')}
            >
              Hierarchy
            </Button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        {currentPath.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToRoot}
              className="h-6 px-2"
            >
              Root
            </Button>
            {currentPath.map((segment, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="h-3 w-3" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBreadcrumbClick(index + 1)}
                  className="h-6 px-2"
                >
                  {segment.name}
                </Button>
              </React.Fragment>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {viewMode === 'treemap' ? (
          <div className="h-96">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={currentLevelData}
                  dataKey="value"
                  aspectRatio={4/3}
                  stroke="#fff"
                  content={<CustomTreemapContent />}
                />
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        ) : (
          <div className="space-y-2">
            {currentLevelData.map((node, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNodeClick(node)}
              >
                <div className="flex items-center gap-3">
                  {node.children && node.children.length > 0 ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: node.color }}
                  />
                  <div>
                    <div className="font-medium">{node.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {node.hierarchicalPath}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{node.errorCount} errors</div>
                  <div className="text-sm text-muted-foreground">
                    {node.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Statistics */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Total Errors</div>
              <div className="text-2xl font-bold">
                {currentLevelData.reduce((sum, node) => sum + node.errorCount, 0)}
              </div>
            </div>
            <div>
              <div className="font-medium">Categories</div>
              <div className="text-2xl font-bold">{currentLevelData.length}</div>
            </div>
            <div>
              <div className="font-medium">Drill-down Level</div>
              <div className="text-2xl font-bold">
                {currentPath.length === 0 ? 'Dimension' : 
                 currentPath.length === 1 ? 'Category' : 
                 currentPath.length === 2 ? 'Subcategory' : 'Leaf'}
              </div>
            </div>
            <div>
              <div className="font-medium">Coverage</div>
              <div className="text-2xl font-bold">
                {((currentLevelData.reduce((sum, node) => sum + node.errorCount, 0) / errors.length) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 