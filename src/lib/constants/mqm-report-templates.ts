/**
 * MQM Report HTML Templates and Formatting Utilities
 * Pre-designed templates for rendering MQM reports in different formats
 */

import {
  MQMReportTemplate,
  MQMGeneratedReport,
  MQMExecutiveSummary,
  MQMComprehensiveScorecard,
  MQMVisualizationData
} from '../types/assessment';

/**
 * CSS Styles for MQM Reports
 */
export const MQM_REPORT_CSS = `
<style>
  .mqm-report {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
    line-height: 1.6;
  }

  .mqm-header {
    border-bottom: 3px solid #007bff;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }

  .mqm-title {
    font-size: 2.5em;
    font-weight: 700;
    color: #007bff;
    margin: 0 0 10px 0;
  }

  .mqm-subtitle {
    font-size: 1.2em;
    color: #6c757d;
    margin: 0;
  }

  .mqm-score-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin: 30px 0;
  }

  .mqm-score-card {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .mqm-score-value {
    font-size: 3em;
    font-weight: 700;
    margin: 10px 0;
  }

  .mqm-score-label {
    font-size: 0.9em;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .quality-excellent { color: #28a745; }
  .quality-good { color: #20c997; }
  .quality-fair { color: #ffc107; }
  .quality-poor { color: #fd7e14; }
  .quality-unacceptable { color: #dc3545; }

  .severity-critical { color: #dc3545; background-color: #f8d7da; }
  .severity-major { color: #fd7e14; background-color: #fff3cd; }
  .severity-minor { color: #ffc107; background-color: #fff3cd; }
  .severity-neutral { color: #28a745; background-color: #d4edda; }

  .mqm-section {
    margin: 40px 0;
    padding: 25px;
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .mqm-section-title {
    font-size: 1.5em;
    font-weight: 600;
    color: #007bff;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #e9ecef;
  }

  .mqm-breakdown-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  .mqm-breakdown-table th,
  .mqm-breakdown-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
  }

  .mqm-breakdown-table th {
    background-color: #f8f9fa;
    font-weight: 600;
    color: #495057;
  }

  .mqm-breakdown-table tr:hover {
    background-color: #f8f9fa;
  }

  .mqm-chart-container {
    margin: 20px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    text-align: center;
  }

  .mqm-progress-bar {
    width: 100%;
    height: 20px;
    background-color: #e9ecef;
    border-radius: 10px;
    overflow: hidden;
    margin: 10px 0;
  }

  .mqm-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #28a745 0%, #20c997 50%, #ffc107 75%, #dc3545 100%);
    border-radius: 10px;
    transition: width 0.3s ease;
  }

  .mqm-recommendations {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    border-left: 4px solid #2196f3;
    padding: 20px;
    margin: 20px 0;
  }

  .mqm-critical-issues {
    background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
    border-left: 4px solid #f44336;
    padding: 20px;
    margin: 20px 0;
  }

  .mqm-insights {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin: 30px 0;
  }

  .mqm-insight-card {
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #dee2e6;
  }

  .insight-strengths {
    background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
    border-left: 4px solid #4caf50;
  }

  .insight-improvements {
    background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
    border-left: 4px solid #ff9800;
  }

  .insight-actions {
    background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
    border-left: 4px solid #e91e63;
  }

  .mqm-metadata {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    font-size: 0.9em;
    color: #6c757d;
    margin: 30px 0;
  }

  .mqm-footer {
    text-align: center;
    padding: 30px 0;
    border-top: 1px solid #dee2e6;
    margin-top: 50px;
    color: #6c757d;
  }

  @media (max-width: 768px) {
    .mqm-report {
      padding: 15px;
    }
    
    .mqm-score-summary {
      grid-template-columns: 1fr;
    }
    
    .mqm-insights {
      grid-template-columns: 1fr;
    }
  }

  @media print {
    .mqm-report {
      max-width: none;
      padding: 20px;
    }
    
    .mqm-section {
      break-inside: avoid;
    }
  }
</style>
`;

/**
 * HTML template for Executive Summary reports
 */
export const EXECUTIVE_SUMMARY_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  ${MQM_REPORT_CSS}
</head>
<body>
  <div class="mqm-report">
    <!-- Header -->
    <div class="mqm-header">
      <h1 class="mqm-title">{{project_name}} - Quality Assessment</h1>
      <p class="mqm-subtitle">Executive Summary | Generated {{generated_at}}</p>
    </div>

    <!-- Overall Quality Score -->
    <div class="mqm-score-summary">
      <div class="mqm-score-card">
        <div class="mqm-score-value quality-{{quality_level}}">{{mqm_score}}</div>
        <div class="mqm-score-label">MQM Score</div>
      </div>
      
      <div class="mqm-score-card">
        <div class="mqm-score-value {{pass_fail_status}}">{{pass_fail_status}}</div>
        <div class="mqm-score-label">Assessment Result</div>
      </div>
      
      <div class="mqm-score-card">
        <div class="mqm-score-value {{business_impact}}">{{business_impact}}</div>
        <div class="mqm-score-label">Business Impact</div>
      </div>
      
      <div class="mqm-score-card">
        <div class="mqm-score-value">{{critical_issues_count}}</div>
        <div class="mqm-score-label">Critical Issues</div>
      </div>
    </div>

    <!-- Risk Assessment -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Risk Assessment</h2>
      <div class="mqm-insights">
        <div class="mqm-insight-card">
          <h3>Regulatory Compliance</h3>
          <p><strong>Status:</strong> {{regulatory_compliance}}</p>
          <p>Assessment of compliance with industry standards and regulations.</p>
        </div>
        
        <div class="mqm-insight-card">
          <h3>User Experience Impact</h3>
          <p><strong>Level:</strong> {{user_experience_impact}}</p>
          <p>Potential impact on end-user experience and satisfaction.</p>
        </div>
        
        <div class="mqm-insight-card">
          <h3>Brand Risk</h3>
          <p><strong>Level:</strong> {{brand_risk}}</p>
          <p>Risk to brand reputation and consistency.</p>
        </div>
      </div>
    </div>

    <!-- Critical Issues -->
    {{#if critical_issues}}
    <div class="mqm-critical-issues">
      <h3>Critical Issues Requiring Immediate Attention</h3>
      <ul>
        {{#each critical_issues}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    {{/if}}

    <!-- Key Recommendations -->
    <div class="mqm-recommendations">
      <h3>Key Recommendations</h3>
      <ul>
        {{#each recommendations}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>

    <!-- Benchmarks -->
    {{#if benchmarks}}
    <div class="mqm-section">
      <h2 class="mqm-section-title">Performance Benchmarks</h2>
      <table class="mqm-breakdown-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Benchmark</th>
            <th>Variance</th>
          </tr>
        </thead>
        <tbody>
          {{#if benchmarks.previous_assessment}}
          <tr>
            <td>Previous Assessment</td>
            <td>{{mqm_score}}</td>
            <td>{{benchmarks.previous_assessment}}</td>
            <td>{{improvement_percentage}}%</td>
          </tr>
          {{/if}}
          {{#if benchmarks.target_score}}
          <tr>
            <td>Target Score</td>
            <td>{{mqm_score}}</td>
            <td>{{benchmarks.target_score}}</td>
            <td>{{target_variance}}%</td>
          </tr>
          {{/if}}
        </tbody>
      </table>
    </div>
    {{/if}}

    <!-- Report Metadata -->
    <div class="mqm-metadata">
      <p><strong>Assessment Details:</strong> Generated {{generated_at}} | Quality Level: {{quality_level}} | Threshold Met: {{threshold_met}}</p>
      {{#if confidence_level}}
      <p><strong>Confidence Level:</strong> {{confidence_level}}%</p>
      {{/if}}
    </div>

    <div class="mqm-footer">
      <p>This report was generated automatically by the MQM Assessment System</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * HTML template for Comprehensive Scorecard
 */
export const COMPREHENSIVE_SCORECARD_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  ${MQM_REPORT_CSS}
</head>
<body>
  <div class="mqm-report">
    <!-- Header -->
    <div class="mqm-header">
      <h1 class="mqm-title">{{assessment_header.project_name}}</h1>
      <p class="mqm-subtitle">Comprehensive Quality Scorecard | {{assessment_header.assessment_date}}</p>
      <p class="mqm-subtitle">Assessor: {{assessment_header.assessor_info}}</p>
    </div>

    <!-- Content Metadata -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Content Information</h2>
      <div class="mqm-score-summary">
        <div class="mqm-score-card">
          <div class="mqm-score-value">{{assessment_header.content_metadata.word_count}}</div>
          <div class="mqm-score-label">Word Count</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value">{{assessment_header.content_metadata.segment_count}}</div>
          <div class="mqm-score-label">Segments</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value">{{assessment_header.content_metadata.content_type}}</div>
          <div class="mqm-score-label">Content Type</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value">{{assessment_header.content_metadata.domain}}</div>
          <div class="mqm-score-label">Domain</div>
        </div>
      </div>
    </div>

    <!-- Overall Score -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Overall Quality Assessment</h2>
      <div class="mqm-score-summary">
        <div class="mqm-score-card">
          <div class="mqm-score-value quality-{{overall_score.quality_level}}">{{overall_score.mqm_score}}</div>
          <div class="mqm-score-label">MQM Score</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value">{{overall_score.error_rate}}%</div>
          <div class="mqm-score-label">Error Rate</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value {{overall_score.threshold_compliance}}">
            {{#if overall_score.threshold_compliance}}✓ PASS{{else}}✗ FAIL{{/if}}
          </div>
          <div class="mqm-score-label">Threshold</div>
        </div>
        <div class="mqm-score-card">
          <div class="mqm-score-value quality-{{overall_score.quality_level}}">{{overall_score.quality_level}}</div>
          <div class="mqm-score-label">Quality Level</div>
        </div>
      </div>
      
      {{#if overall_score.confidence_interval}}
      <div class="mqm-metadata">
        <p><strong>Confidence Interval:</strong> 
          {{overall_score.confidence_interval.lower}} - {{overall_score.confidence_interval.upper}} 
          ({{overall_score.confidence_interval.confidence_level}}% confidence)
        </p>
      </div>
      {{/if}}
    </div>

    <!-- Dimension Breakdown -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Quality Dimension Analysis</h2>
      <table class="mqm-breakdown-table">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Score</th>
            <th>Error Count</th>
            <th>Penalty</th>
            <th>Percentage</th>
            <th>Top Categories</th>
          </tr>
        </thead>
        <tbody>
          {{#each score_breakdowns.by_dimension}}
          <tr>
            <td><strong>{{@key}}</strong></td>
            <td>{{this.score}}</td>
            <td>{{this.error_count}}</td>
            <td>{{this.penalty}}</td>
            <td>{{this.percentage}}%</td>
            <td>{{join this.top_categories ", "}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <!-- Severity Breakdown -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Error Severity Distribution</h2>
      <table class="mqm-breakdown-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Count</th>
            <th>Penalty</th>
            <th>Percentage</th>
            <th>Impact Description</th>
          </tr>
        </thead>
        <tbody>
          {{#each score_breakdowns.by_severity}}
          <tr class="severity-{{@key}}">
            <td><strong>{{@key}}</strong></td>
            <td>{{this.count}}</td>
            <td>{{this.penalty}}</td>
            <td>{{this.percentage}}%</td>
            <td>{{this.impact_description}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>

    <!-- Weighting Information -->
    {{#if weighting_details}}
    <div class="mqm-section">
      <h2 class="mqm-section-title">Weighting Configuration</h2>
      <div class="mqm-metadata">
        <p><strong>Profile Used:</strong> {{weighting_details.profile_used}}</p>
        <p><strong>Weight Impact Analysis:</strong> {{weighting_details.weight_impact_analysis}}</p>
        {{#if weighting_details.adjustments_applied}}
        <p><strong>Adjustments Applied:</strong></p>
        <ul>
          {{#each weighting_details.adjustments_applied}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
        {{/if}}
      </div>
    </div>
    {{/if}}

    <!-- Actionable Insights -->
    <div class="mqm-insights">
      {{#if insights.strengths}}
      <div class="mqm-insight-card insight-strengths">
        <h3>Strengths</h3>
        <ul>
          {{#each insights.strengths}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}

      {{#if insights.improvement_areas}}
      <div class="mqm-insight-card insight-improvements">
        <h3>Areas for Improvement</h3>
        <ul>
          {{#each insights.improvement_areas}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}

      {{#if insights.critical_actions}}
      <div class="mqm-insight-card insight-actions">
        <h3>Critical Actions Required</h3>
        <ul>
          {{#each insights.critical_actions}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
    </div>

    <!-- Recommendations -->
    {{#if insights.recommendations}}
    <div class="mqm-recommendations">
      <h3>Recommendations</h3>
      <ul>
        {{#each insights.recommendations}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    {{/if}}

    <!-- Chart Placeholders -->
    <div class="mqm-section">
      <h2 class="mqm-section-title">Visual Analysis</h2>
      
      <div class="mqm-chart-container">
        <h4>Dimension Error Distribution</h4>
        <p><em>Chart data: {{charts.dimension_chart.labels}} with counts {{charts.dimension_chart.error_counts}}</em></p>
        <div class="mqm-progress-bar">
          <div class="mqm-progress-fill" style="width: {{overall_score.mqm_score}}%"></div>
        </div>
      </div>

      <div class="mqm-chart-container">
        <h4>Severity Distribution</h4>
        <p><em>Chart data: {{charts.severity_chart.labels}} with counts {{charts.severity_chart.counts}}</em></p>
      </div>
    </div>

    <!-- Footer -->
    <div class="mqm-footer">
      <p>MQM Assessment Report | Version {{version}} | Generated {{generated_at}}</p>
      <p>Checksum: {{export_info.checksum}} | Format Version: {{export_info.format_version}}</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Utility functions for template processing
 */
export class MQMReportTemplateProcessor {
  /**
   * Simple template engine for replacing placeholders
   */
  static processTemplate(template: string, data: any): string {
    let processed = template;
    
    // Replace simple placeholders like {{key}}
    processed = processed.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key.trim());
      return value !== undefined ? String(value) : match;
    });

    // Process conditional blocks {{#if condition}} ... {{/if}}
    processed = processed.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      return this.isTruthy(value) ? content : '';
    });

    // Process loops {{#each array}} ... {{/each}}
    processed = processed.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayPath, itemTemplate) => {
      const array = this.getNestedValue(data, arrayPath.trim());
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemContent = itemTemplate;
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        return itemContent;
      }).join('');
    });

    return processed;
  }

  /**
   * Get nested object value by dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Check if value is truthy for template conditions
   */
  private static isTruthy(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  }

  /**
   * Generate HTML report from MQM report data
   */
  static generateHTML(report: MQMGeneratedReport): string {
    let template: string;
    
    switch (report.config.template) {
      case MQMReportTemplate.EXECUTIVE_SUMMARY:
        template = EXECUTIVE_SUMMARY_TEMPLATE;
        break;
      case MQMReportTemplate.COMPREHENSIVE_SCORECARD:
        template = COMPREHENSIVE_SCORECARD_TEMPLATE;
        break;
      default:
        // Use comprehensive scorecard as default
        template = COMPREHENSIVE_SCORECARD_TEMPLATE;
    }

    // Flatten the report data for easier template access
    const templateData = {
      ...report,
      ...report.data,
      title: report.config.title,
      version: report.version,
      charts: report.visualizations,
      export_info: report.export_info
    };

    return this.processTemplate(template, templateData);
  }

  /**
   * Generate simplified text report
   */
  static generateTextSummary(report: MQMGeneratedReport): string {
    const data = report.data as any;
    const score = report.source_score;
    
    let text = `# ${report.config.title}\n\n`;
    text += `Generated: ${report.generated_at}\n`;
    text += `Report Type: ${report.config.template}\n\n`;
    
    text += `## Overall Quality Assessment\n`;
    text += `MQM Score: ${score.mqm_score}\n`;
    text += `Quality Level: ${score.quality_level}\n`;
    text += `Error Rate: ${score.error_rate}%\n`;
    text += `Threshold Met: ${score.meets_threshold ? 'Yes' : 'No'}\n\n`;
    
    if (data.critical_issues && data.critical_issues.count > 0) {
      text += `## Critical Issues (${data.critical_issues.count})\n`;
      if (data.critical_issues.top_critical_categories) {
        data.critical_issues.top_critical_categories.forEach((issue: string) => {
          text += `- ${issue}\n`;
        });
      }
      text += '\n';
    }
    
    if (data.recommendations && data.recommendations.length > 0) {
      text += `## Key Recommendations\n`;
      data.recommendations.forEach((rec: string) => {
        text += `- ${rec}\n`;
      });
      text += '\n';
    }
    
    // Add dimension breakdown
    text += `## Quality Dimensions\n`;
    Object.entries(score.dimension_breakdown).forEach(([dimension, dimData]: [string, any]) => {
      text += `- ${dimension}: ${dimData.error_count} errors, ${dimData.penalty} penalty\n`;
    });
    
    return text;
  }

  /**
   * Export report data as CSV
   */
  static generateCSV(report: MQMGeneratedReport): string {
    const score = report.source_score;
    let csv = 'Dimension,Error Count,Penalty,Percentage\n';
    
    Object.entries(score.dimension_breakdown).forEach(([dimension, data]: [string, any]) => {
      const percentage = score.total_errors > 0 ? (data.error_count / score.total_errors) * 100 : 0;
      csv += `"${dimension}",${data.error_count},${data.penalty},${percentage.toFixed(2)}\n`;
    });
    
    csv += '\nSeverity,Count,Penalty,Percentage\n';
    Object.entries(score.severity_breakdown).forEach(([severity, data]: [string, any]) => {
      csv += `"${severity}",${data.count},${data.penalty},${data.percentage}\n`;
    });
    
    return csv;
  }
}

/**
 * Predefined report configurations for common use cases
 */
export const PREDEFINED_REPORT_CONFIGS = {
  executive_summary: {
    template: MQMReportTemplate.EXECUTIVE_SUMMARY,
    format: 'html' as const,
    include_visualizations: false,
    include_examples: false,
    include_recommendations: true,
    include_statistical_analysis: false
  },
  
  comprehensive_scorecard: {
    template: MQMReportTemplate.COMPREHENSIVE_SCORECARD,
    format: 'html' as const,
    include_visualizations: true,
    include_examples: true,
    include_recommendations: true,
    include_statistical_analysis: true
  },
  
  quick_summary: {
    template: MQMReportTemplate.EXECUTIVE_SUMMARY,
    format: 'json' as const,
    include_visualizations: false,
    include_examples: false,
    include_recommendations: true,
    include_statistical_analysis: false
  }
};

/**
 * Export utilities
 */
export const MQMReportExportUtils = {
  /**
   * Export report to different formats
   */
  exportReport: (report: MQMGeneratedReport, format: 'html' | 'text' | 'csv' | 'json' = 'html'): string => {
    switch (format) {
      case 'html':
        return MQMReportTemplateProcessor.generateHTML(report);
      case 'text':
        return MQMReportTemplateProcessor.generateTextSummary(report);
      case 'csv':
        return MQMReportTemplateProcessor.generateCSV(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  },

  /**
   * Generate filename for export
   */
  generateFilename: (report: MQMGeneratedReport, format: string): string => {
    const timestamp = new Date().toISOString().split('T')[0];
    const template = report.config.template.replace(/_/g, '-');
    return `mqm-${template}-${timestamp}.${format}`;
  },

  /**
   * Get MIME type for format
   */
  getMimeType: (format: string): string => {
    const mimeTypes: Record<string, string> = {
      html: 'text/html',
      text: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      pdf: 'application/pdf'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }
}; 