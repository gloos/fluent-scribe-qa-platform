import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  CheckCircle, 
  Clock,
  BookOpen,
  Users,
  Zap
} from 'lucide-react';
import { 
  MQMDimension, 
  MQMErrorInstance, 
  MQMSeverity 
} from "@/lib/types/assessment";
import { ErrorDomain } from "@/lib/types/mqm-taxonomy-expansion";
import { SEVERITY_CLASSIFICATION_RULES } from "@/lib/utils/mqm-severity-classifier";

interface Recommendation {
  id: string;
  type: 'critical' | 'improvement' | 'optimization' | 'training';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_items: string[];
  impact_estimate: string;
  timeframe: string;
  resources_needed: string[];
  success_metrics: string[];
  related_errors: MQMErrorInstance[];
  domain?: ErrorDomain;
  dimension?: MQMDimension;
}

interface RecommendationCategory {
  name: string;
  icon: React.ReactNode;
  description: string;
  recommendations: Recommendation[];
}

interface AutomatedRecommendationsPanelProps {
  errors: MQMErrorInstance[];
  domain?: ErrorDomain;
  className?: string;
}

const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'medium':
      return <Target className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
};

const getTypeIcon = (type: 'critical' | 'improvement' | 'optimization' | 'training') => {
  switch (type) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'improvement':
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    case 'optimization':
      return <Zap className="h-4 w-4 text-purple-500" />;
    case 'training':
      return <BookOpen className="h-4 w-4 text-green-500" />;
  }
};

export function AutomatedRecommendationsPanel({ errors, domain, className }: AutomatedRecommendationsPanelProps) {
  // Generate automated recommendations based on error analysis
  const recommendations = useMemo((): Recommendation[] => {
    if (errors.length === 0) return [];

    const recs: Recommendation[] = [];

    // Analyze error patterns
    const errorByDimension = new Map<MQMDimension, MQMErrorInstance[]>();
    const errorBySeverity = new Map<MQMSeverity, MQMErrorInstance[]>();
    const errorByCategory = new Map<string, MQMErrorInstance[]>();

    errors.forEach(error => {
      // Group by dimension
      if (!errorByDimension.has(error.dimension)) {
        errorByDimension.set(error.dimension, []);
      }
      errorByDimension.get(error.dimension)!.push(error);

      // Group by severity
      if (!errorBySeverity.has(error.severity)) {
        errorBySeverity.set(error.severity, []);
      }
      errorBySeverity.get(error.severity)!.push(error);

      // Group by category
      if (!errorByCategory.has(error.category)) {
        errorByCategory.set(error.category, []);
      }
      errorByCategory.get(error.category)!.push(error);
    });

    // Critical issues recommendations
    const criticalErrors = errorBySeverity.get(MQMSeverity.CRITICAL) || [];
    if (criticalErrors.length > 0) {
      recs.push({
        id: 'critical-immediate',
        type: 'critical',
        priority: 'high',
        title: 'Address Critical Issues Immediately',
        description: `${criticalErrors.length} critical errors require immediate attention to prevent serious business impact.`,
        action_items: [
          'Review all critical errors with the quality team',
          'Implement immediate fixes for safety-related issues',
          'Escalate to technical leadership if needed',
          'Document root causes and preventive measures'
        ],
        impact_estimate: 'High - Prevents potential safety, legal, or financial risks',
        timeframe: 'Immediate (within 24 hours)',
        resources_needed: ['Quality team', 'Technical leads', 'Domain experts'],
        success_metrics: ['Zero critical errors remaining', 'Root cause analysis completed'],
        related_errors: criticalErrors,
        dimension: criticalErrors[0]?.dimension
      });
    }

    // High error dimension recommendations
    const sortedDimensions = Array.from(errorByDimension.entries())
      .sort(([, a], [, b]) => b.length - a.length);

    if (sortedDimensions.length > 0) {
      const [topDimension, dimensionErrors] = sortedDimensions[0];
      const errorPercentage = (dimensionErrors.length / errors.length) * 100;

      if (errorPercentage > 30) {
        recs.push({
          id: `dimension-focus-${topDimension}`,
          type: 'improvement',
          priority: errorPercentage > 50 ? 'high' : 'medium',
          title: `Focus on ${topDimension.replace('_', ' ')} Quality`,
          description: `${topDimension.replace('_', ' ')} accounts for ${errorPercentage.toFixed(1)}% of all errors. Targeted improvement in this area will have significant impact.`,
          action_items: [
            `Conduct detailed analysis of ${topDimension.replace('_', ' ')} errors`,
            'Develop specific guidelines and training materials',
            'Implement additional quality checks for this dimension',
            'Create dimension-specific review checklists'
          ],
          impact_estimate: `High - Could reduce overall error count by up to ${errorPercentage.toFixed(0)}%`,
          timeframe: '2-4 weeks',
          resources_needed: ['Quality analysts', 'Training team', 'Process improvement'],
          success_metrics: [
            `Reduce ${topDimension.replace('_', ' ')} errors by 50%`,
            'Improve overall quality score by 15%'
          ],
          related_errors: dimensionErrors,
          dimension: topDimension
        });
      }
    }

    // Terminology consistency recommendations
    const terminologyErrors = errorByDimension.get(MQMDimension.TERMINOLOGY) || [];
    if (terminologyErrors.length > 3) {
      recs.push({
        id: 'terminology-consistency',
        type: 'optimization',
        priority: 'medium',
        title: 'Improve Terminology Consistency',
        description: `${terminologyErrors.length} terminology-related errors suggest need for better term management and consistency guidelines.`,
        action_items: [
          'Create or update terminology glossary',
          'Implement term validation tools',
          'Provide terminology training to team',
          'Establish terminology review process'
        ],
        impact_estimate: 'Medium - Improves consistency and reduces confusion',
        timeframe: '3-6 weeks',
        resources_needed: ['Terminology specialists', 'Tool development', 'Training materials'],
        success_metrics: [
          'Reduce terminology errors by 70%',
          'Achieve 95% terminology consistency score'
        ],
        related_errors: terminologyErrors,
        dimension: MQMDimension.TERMINOLOGY
      });
    }

    // Accuracy recommendations
    const accuracyErrors = errorByDimension.get(MQMDimension.ACCURACY) || [];
    if (accuracyErrors.length > 5) {
      const majorAccuracyErrors = accuracyErrors.filter(e => e.severity === MQMSeverity.MAJOR || e.severity === MQMSeverity.CRITICAL);
      
      recs.push({
        id: 'accuracy-improvement',
        type: 'improvement',
        priority: majorAccuracyErrors.length > 3 ? 'high' : 'medium',
        title: 'Enhance Translation Accuracy',
        description: `${accuracyErrors.length} accuracy errors detected, with ${majorAccuracyErrors.length} being major or critical issues.`,
        action_items: [
          'Review translation methodology and guidelines',
          'Implement additional accuracy checks',
          'Provide specialized training on accuracy standards',
          'Consider peer review process for complex content'
        ],
        impact_estimate: 'High - Directly improves translation quality and user trust',
        timeframe: '4-8 weeks',
        resources_needed: ['Senior translators', 'Quality reviewers', 'Training development'],
        success_metrics: [
          'Reduce accuracy errors by 60%',
          'Achieve accuracy score above 90%'
        ],
        related_errors: accuracyErrors,
        dimension: MQMDimension.ACCURACY
      });
    }

    // Training recommendations based on error patterns
    if (errors.length > 10) {
      const repeatPatterns = new Map<string, number>();
      errors.forEach(error => {
        const pattern = `${error.dimension}:${error.category}`;
        repeatPatterns.set(pattern, (repeatPatterns.get(pattern) || 0) + 1);
      });

      const frequentPatterns = Array.from(repeatPatterns.entries())
        .filter(([, count]) => count >= 3)
        .sort(([, a], [, b]) => b - a);

      if (frequentPatterns.length > 0) {
        recs.push({
          id: 'training-patterns',
          type: 'training',
          priority: 'medium',
          title: 'Address Recurring Error Patterns',
          description: `${frequentPatterns.length} error patterns are recurring, indicating need for targeted training.`,
          action_items: [
            'Develop training modules for frequent error patterns',
            'Create practice exercises and examples',
            'Implement regular training sessions',
            'Track training effectiveness through error reduction'
          ],
          impact_estimate: 'Medium - Prevents systematic errors and improves team skills',
          timeframe: '6-10 weeks',
          resources_needed: ['Training specialists', 'Content developers', 'Assessment tools'],
          success_metrics: [
            'Reduce recurring errors by 50%',
            'Achieve 85% training completion rate'
          ],
          related_errors: errors.filter(e => {
            const pattern = `${e.dimension}:${e.category}`;
            return frequentPatterns.some(([p]) => p === pattern);
          })
        });
      }
    }

    // Style and consistency recommendations
    const styleErrors = errorByDimension.get(MQMDimension.STYLE) || [];
    const linguisticErrors = errorByDimension.get(MQMDimension.LINGUISTIC_CONVENTIONS) || [];
    const totalStyleIssues = styleErrors.length + linguisticErrors.length;

    if (totalStyleIssues > 5) {
      recs.push({
        id: 'style-consistency',
        type: 'optimization',
        priority: 'low',
        title: 'Improve Style and Linguistic Consistency',
        description: `${totalStyleIssues} style and linguistic convention errors suggest need for better style guides and consistency checks.`,
        action_items: [
          'Update or create comprehensive style guide',
          'Implement automated style checking tools',
          'Conduct style consistency training',
          'Establish style review checkpoints'
        ],
        impact_estimate: 'Medium - Improves text quality and professional appearance',
        timeframe: '4-6 weeks',
        resources_needed: ['Style guide experts', 'Tool integration', 'Training coordination'],
        success_metrics: [
          'Reduce style inconsistencies by 60%',
          'Achieve 90% style guide compliance'
        ],
        related_errors: [...styleErrors, ...linguisticErrors]
      });
    }

    // Domain-specific recommendations
    if (domain) {
      const domainSpecificErrors = errors.filter(e => {
        // Check if error is domain-specific based on context or category
        return e.category.toLowerCase().includes(domain.toLowerCase()) ||
               e.description?.toLowerCase().includes(domain.toLowerCase());
      });

      if (domainSpecificErrors.length > 2) {
        recs.push({
          id: `domain-specific-${domain}`,
          type: 'improvement',
          priority: 'medium',
          title: `Enhance ${domain.replace('_', ' ')} Domain Expertise`,
          description: `${domainSpecificErrors.length} domain-specific errors indicate need for specialized knowledge and guidelines.`,
          action_items: [
            `Develop ${domain.replace('_', ' ')}-specific quality guidelines`,
            'Provide specialized domain training',
            'Create domain-specific glossaries and resources',
            'Assign domain experts for review process'
          ],
          impact_estimate: 'High - Improves domain accuracy and reduces specialized errors',
          timeframe: '3-5 weeks',
          resources_needed: ['Domain experts', 'Specialized training', 'Resource development'],
          success_metrics: [
            `Reduce ${domain.replace('_', ' ')} errors by 70%`,
            'Achieve domain expert certification for team'
          ],
          related_errors: domainSpecificErrors,
          domain
        });
      }
    }

    return recs.sort((a, b) => {
      // Sort by priority (high > medium > low)
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [errors, domain]);

  // Group recommendations by category
  const recommendationCategories = useMemo((): RecommendationCategory[] => {
    const categories: RecommendationCategory[] = [
      {
        name: 'Critical Actions',
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        description: 'Immediate actions required to address critical issues',
        recommendations: recommendations.filter(r => r.type === 'critical')
      },
      {
        name: 'Quality Improvements',
        icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
        description: 'Strategic improvements to enhance overall quality',
        recommendations: recommendations.filter(r => r.type === 'improvement')
      },
      {
        name: 'Process Optimization',
        icon: <Zap className="h-5 w-5 text-purple-500" />,
        description: 'Optimize workflows and processes for better efficiency',
        recommendations: recommendations.filter(r => r.type === 'optimization')
      },
      {
        name: 'Training & Development',
        icon: <BookOpen className="h-5 w-5 text-green-500" />,
        description: 'Training recommendations to prevent future issues',
        recommendations: recommendations.filter(r => r.type === 'training')
      }
    ].filter(category => category.recommendations.length > 0);

    return categories;
  }, [recommendations]);

  // Calculate impact summary
  const impactSummary = useMemo(() => {
    const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
    const totalErrorsCovered = new Set(recommendations.flatMap(r => r.related_errors.map(e => e.id))).size;
    const coveragePercentage = errors.length > 0 ? (totalErrorsCovered / errors.length) * 100 : 0;

    return {
      highPriorityCount,
      totalErrorsCovered,
      coveragePercentage,
      totalRecommendations: recommendations.length
    };
  }, [recommendations, errors]);

  if (recommendations.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Automated Recommendations
          </CardTitle>
          <CardDescription>
            AI-powered insights and recommendations based on error analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No specific recommendations at this time</p>
            <p className="text-sm">Continue monitoring for patterns and insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Automated Recommendations
        </CardTitle>
        <CardDescription>
          AI-powered insights and recommendations based on error analysis
        </CardDescription>

        {/* Impact Summary */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Impact Summary:</strong> {impactSummary.totalRecommendations} recommendations generated, 
            covering {impactSummary.totalErrorsCovered} errors ({impactSummary.coveragePercentage.toFixed(1)}% coverage).
            {impactSummary.highPriorityCount > 0 && (
              <span className="text-red-600 font-medium"> {impactSummary.highPriorityCount} high-priority actions require immediate attention.</span>
            )}
          </AlertDescription>
        </Alert>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {recommendationCategories.map((category) => (
          <div key={category.name} className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              {category.icon}
              <h3 className="font-semibold">{category.name}</h3>
              <Badge variant="secondary">{category.recommendations.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{category.description}</p>
            
            <div className="space-y-4">
              {category.recommendations.map((rec) => (
                <Card key={rec.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(rec.type)}
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(rec.priority)}
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{rec.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong className="text-green-600">Impact:</strong>
                        <p className="mt-1">{rec.impact_estimate}</p>
                      </div>
                      <div>
                        <strong className="text-blue-600">Timeframe:</strong>
                        <p className="mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {rec.timeframe}
                        </p>
                      </div>
                    </div>

                    <div>
                      <strong className="text-purple-600">Action Items:</strong>
                      <ul className="mt-2 space-y-1">
                        {rec.action_items.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <strong className="text-orange-600">Resources Needed:</strong>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.resources_needed.map((resource, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Users className="h-2 w-2 mr-1" />
                              {resource}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <strong className="text-indigo-600">Success Metrics:</strong>
                        <ul className="mt-2 space-y-1">
                          {rec.success_metrics.map((metric, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Target className="h-3 w-3 mt-0.5 text-indigo-500 flex-shrink-0" />
                              {metric}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        Addresses {rec.related_errors.length} error{rec.related_errors.length !== 1 ? 's' : ''}
                        {rec.dimension && ` in ${rec.dimension.replace('_', ' ')}`}
                        {rec.domain && ` (${rec.domain.replace('_', ' ')} domain)`}
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 