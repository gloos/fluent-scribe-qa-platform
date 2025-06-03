/**
 * Formula Library Component
 * 
 * Provides a browsable collection of formula templates organized by category,
 * with search functionality and detailed examples.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Search, 
  Star, 
  TrendingUp, 
  Copy,
  Eye,
  Filter,
  Tag,
  Users,
  Calendar
} from 'lucide-react';

import type {
  FormulaTemplate,
  FormulaCategory,
  FormulaExample
} from '@/lib/types/scoring-models';

import { 
  getAllFormulaTemplates, 
  getTemplatesByCategory, 
  getPopularTemplates,
  getHighlyRatedTemplates,
  searchTemplates
} from '@/lib/utils/formula-templates';

interface FormulaLibraryProps {
  /** Current category filter */
  category?: FormulaCategory;
  /** Currently selected template */
  activeTemplate?: FormulaTemplate;
  /** Called when template is selected */
  onTemplateSelect: (template: FormulaTemplate) => void;
  /** Whether to show only public templates */
  publicOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FormulaLibrary({
  category,
  activeTemplate,
  onTemplateSelect,
  publicOnly = true,
  className = ''
}: FormulaLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FormulaCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent'>('popular');

  // Get all templates
  const allTemplates = useMemo(() => {
    return getAllFormulaTemplates().filter(template => 
      !publicOnly || template.isPublic
    );
  }, [publicOnly]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let templates = allTemplates;

    // Apply search filter
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery.trim());
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      templates = templates.filter(template => template.category === selectedCategory);
    }

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        templates = templates.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'rating':
        templates = templates.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'recent':
        templates = templates.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return templates;
  }, [allTemplates, searchQuery, selectedCategory, sortBy]);

  // Get templates by category for tabs
  const templatesByCategory = useMemo(() => {
    const categories: FormulaCategory[] = [
      'dimension_scoring',
      'error_penalty', 
      'overall_scoring',
      'quality_level',
      'conditional_logic',
      'statistical'
    ];

    return categories.reduce((acc, cat) => {
      acc[cat] = getTemplatesByCategory(cat).filter(t => !publicOnly || t.isPublic);
      return acc;
    }, {} as Record<FormulaCategory, FormulaTemplate[]>);
  }, [publicOnly]);

  // Category display names
  const categoryNames: Record<FormulaCategory | 'all', string> = {
    all: 'All Categories',
    dimension_scoring: 'Dimension Scoring',
    error_penalty: 'Error Penalty',
    overall_scoring: 'Overall Scoring',
    quality_level: 'Quality Level',
    conditional_logic: 'Conditional Logic',
    statistical: 'Statistical',
    custom: 'Custom'
  };

  // Format category for display
  const formatCategoryName = (cat: string) => {
    return categoryNames[cat as FormulaCategory] || cat.replace('_', ' ');
  };

  // Template card component
  const TemplateCard = ({ template }: { template: FormulaTemplate }) => {
    const isActive = activeTemplate?.id === template.id;
    
    return (
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md ${
          isActive ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => onTemplateSelect(template)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {template.name}
                {template.rating && template.rating >= 4.5 && (
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </div>
            
            <Badge variant="outline" className="text-xs">
              {formatCategoryName(template.category)}
            </Badge>
          </div>

          {/* Template metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {template.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {template.rating.toFixed(1)}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {template.usageCount} uses
            </div>
            {template.createdBy && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {template.createdBy}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Formula expression preview */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Expression:</div>
            <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
              {template.expression}
            </code>
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 4).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 4 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.tags.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Example preview */}
          {template.examples.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Example:</div>
              <div className="bg-muted/50 p-2 rounded text-xs">
                <div className="font-medium">{template.examples[0].name}</div>
                <div className="text-muted-foreground">{template.examples[0].description}</div>
                {template.examples[0].expectedResult !== undefined && (
                  <div className="font-mono">Result: {template.examples[0].expectedResult}</div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onTemplateSelect(template);
              }}
              className="flex-1"
            >
              <Copy className="h-3 w-3 mr-1" />
              Use Template
            </Button>
            
            <Button variant="outline" size="sm">
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`formula-library space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Formula Library
              </CardTitle>
              <CardDescription>
                Choose from pre-built formula templates or browse examples
              </CardDescription>
            </div>
            
            <Badge variant="outline" className="text-sm">
              {filteredTemplates.length} templates
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FormulaCategory | 'all')}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryNames).filter(([key]) => key !== 'all').map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>

            {/* Sort options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'popular' | 'rating' | 'recent')}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>

          {/* Quick filter buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={sortBy === 'popular' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('popular')}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Popular
            </Button>
            <Button
              variant={sortBy === 'rating' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('rating')}
            >
              <Star className="h-3 w-3 mr-1" />
              Top Rated
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('weighted');
                setSelectedCategory('dimension_scoring');
              }}
            >
              <Tag className="h-3 w-3 mr-1" />
              Weighted Scoring
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('conditional');
                setSelectedCategory('conditional_logic');
              }}
            >
              <Tag className="h-3 w-3 mr-1" />
              Conditional
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template tabs by category */}
      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FormulaCategory | 'all')}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="dimension_scoring">Dimensions</TabsTrigger>
          <TabsTrigger value="error_penalty">Errors</TabsTrigger>
          <TabsTrigger value="overall_scoring">Overall</TabsTrigger>
          <TabsTrigger value="quality_level">Quality</TabsTrigger>
          <TabsTrigger value="conditional_logic">Logic</TabsTrigger>
          <TabsTrigger value="statistical">Stats</TabsTrigger>
        </TabsList>

        {/* All templates */}
        <TabsContent value="all" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
            
            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-muted-foreground">
                  {searchQuery ? 'No templates found matching your search.' : 'No templates available.'}
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Category-specific templates */}
        {Object.entries(templatesByCategory).map(([cat, templates]) => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">{formatCategoryName(cat)}</h3>
              <p className="text-sm text-muted-foreground">
                {cat === 'dimension_scoring' && 'Formulas for calculating weighted dimension scores'}
                {cat === 'error_penalty' && 'Formulas for applying error penalties and deductions'}
                {cat === 'overall_scoring' && 'Formulas for calculating final scores'}
                {cat === 'quality_level' && 'Formulas for determining quality classifications'}
                {cat === 'conditional_logic' && 'Formulas with conditional logic and thresholds'}
                {cat === 'statistical' && 'Statistical calculations and normalization formulas'}
              </p>
            </div>

            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
              
              {templates.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="text-muted-foreground">
                    No templates available in this category.
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default FormulaLibrary; 