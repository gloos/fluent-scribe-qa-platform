/**
 * User-Friendly Error Reporting System
 * Provides actionable feedback and suggestions for XLIFF parsing errors
 */

import { EnhancedXLIFFError, ErrorCategory } from './errors';
import { ErrorSeverity } from './types';

/**
 * Report severity levels for user display
 */
export enum ReportSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Suggestion interface for actionable feedback
 */
export interface Suggestion {
  action: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate?: string;
  helpUrl?: string;
}

/**
 * User-friendly error report
 */
export interface ErrorReport {
  id: string;
  title: string;
  message: string;
  severity: ReportSeverity;
  category: string;
  location?: {
    description: string;
    line?: number;
    column?: number;
    element?: string;
  };
  suggestions: Suggestion[];
  technicalDetails?: {
    errorCode: string;
    phase: string;
    recoverable: boolean;
    context: Record<string, any>;
  };
  helpUrl?: string;
  timestamp: number;
}

/**
 * Error summary for overall document analysis
 */
export interface ErrorSummary {
  totalIssues: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  categoryCounts: Record<string, number>;
  fixTimeEstimate: string;
  canProceed: boolean;
  reports: ErrorReport[];
}

/**
 * User-friendly error reporter
 */
export class UserFriendlyReporter {
  /**
   * Convert technical error to user-friendly report
   */
  public createReport(error: EnhancedXLIFFError): ErrorReport {
    const reportId = this.generateReportId(error);
    const title = this.generateTitle(error);
    const message = this.generateUserMessage(error);
    const severity = this.mapSeverity(error.severity);
    const location = this.formatLocation(error);
    const suggestions = this.generateSuggestions(error);
    const helpUrl = this.getHelpUrl(error);

    return {
      id: reportId,
      title,
      message,
      severity,
      category: this.formatCategory(error.category),
      location,
      suggestions,
      technicalDetails: {
        errorCode: error.errorCode,
        phase: error.phase,
        recoverable: error.recoverable,
        context: error.context
      },
      helpUrl,
      timestamp: error.timestamp
    };
  }

  /**
   * Create summary report from multiple errors
   */
  public createSummary(errors: EnhancedXLIFFError[]): ErrorSummary {
    const reports = errors.map(error => this.createReport(error));
    
    const criticalCount = reports.filter(r => r.severity === ReportSeverity.CRITICAL).length;
    const errorCount = reports.filter(r => r.severity === ReportSeverity.ERROR).length;
    const warningCount = reports.filter(r => r.severity === ReportSeverity.WARNING).length;
    const infoCount = reports.filter(r => r.severity === ReportSeverity.INFO).length;

    const categoryCounts = reports.reduce((acc, report) => {
      acc[report.category] = (acc[report.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fixTimeEstimate = this.calculateFixTimeEstimate(reports);
    const canProceed = criticalCount === 0;

    return {
      totalIssues: reports.length,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      categoryCounts,
      fixTimeEstimate,
      canProceed,
      reports
    };
  }

  private generateReportId(error: EnhancedXLIFFError): string {
    const timestamp = error.timestamp.toString(36);
    const codeHash = error.errorCode.substring(0, 4);
    const locationHash = error.location.line ? error.location.line.toString(36) : 'x';
    return `${codeHash}-${locationHash}-${timestamp}`;
  }

  private generateTitle(error: EnhancedXLIFFError): string {
    switch (error.errorCode) {
      case 'STRUCT_001':
        return `Missing Required Element: ${error.location.elementName}`;
      case 'SYNTAX_001':
        return 'Invalid XML Structure';
      case 'ATTR_001':
        return `Invalid Attribute: ${error.location.attributeName}`;
      case 'ENC_001':
        return 'Character Encoding Issue';
      case 'SCHEMA_001':
        return 'Schema Validation Failed';
      case 'PERF_001':
        return 'Performance Warning';
      case 'COMPAT_001':
        return 'Compatibility Issue';
      default:
        return this.formatCategory(error.category) + ' Issue';
    }
  }

  private generateUserMessage(error: EnhancedXLIFFError): string {
    switch (error.errorCode) {
      case 'STRUCT_001':
        return `Your XLIFF file is missing a required "${error.location.elementName}" element${error.location.parentElement ? ` inside the "${error.location.parentElement}" section` : ''}. This element is necessary for the file to be valid.`;
      
      case 'SYNTAX_001':
        return 'The XLIFF file contains invalid XML syntax. This usually means there are unclosed tags, missing quotes, or special characters that need to be escaped.';
      
      case 'ATTR_001':
        return `The "${error.location.attributeName}" attribute in the "${error.location.elementName}" element has an invalid value. This may affect how the file is processed.`;
      
      case 'ENC_001':
        return 'There are character encoding issues in your file. Some characters may not display correctly or could cause processing errors.';
      
      case 'SCHEMA_001':
        return 'The file structure doesn\'t match the expected XLIFF format. This could prevent proper processing of your translations.';
      
      case 'PERF_001':
        return 'The file is taking longer than expected to process. This might be due to large file size or complex structure.';
      
      case 'COMPAT_001':
        return 'This file uses features that may not be fully supported in all systems. Processing may still work, but some functionality might be limited.';
      
      default:
        return error.message;
    }
  }

  private mapSeverity(severity: string): ReportSeverity {
    switch (severity.toLowerCase()) {
      case 'critical': return ReportSeverity.CRITICAL;
      case 'major': return ReportSeverity.ERROR;
      case 'minor': return ReportSeverity.WARNING;
      case 'warning': return ReportSeverity.WARNING;
      default: return ReportSeverity.INFO;
    }
  }

  private formatLocation(error: EnhancedXLIFFError): ErrorReport['location'] {
    if (!error.location) return undefined;

    let description = '';
    
    if (error.location.line) {
      description = `Line ${error.location.line}`;
      if (error.location.column) {
        description += `, Column ${error.location.column}`;
      }
    }

    if (error.location.elementName) {
      const elementDesc = error.location.parentElement 
        ? `in the "${error.location.elementName}" element within "${error.location.parentElement}"`
        : `in the "${error.location.elementName}" element`;
      
      description = description ? `${description} ${elementDesc}` : elementDesc;
    }

    return {
      description: description || 'Unknown location',
      line: error.location.line,
      column: error.location.column,
      element: error.location.elementName
    };
  }

  private generateSuggestions(error: EnhancedXLIFFError): Suggestion[] {
    const suggestions: Suggestion[] = [];

    switch (error.errorCode) {
      case 'STRUCT_001':
        suggestions.push(
          {
            action: 'Add Missing Element',
            description: `Add the required "${error.location.elementName}" element to your XLIFF file`,
            priority: 'high',
            difficulty: 'easy',
            timeEstimate: '2-5 minutes',
            helpUrl: 'https://docs.oasis-open.org/xliff/xliff-core/v1.2/os/xliff-core.html#structure'
          },
          {
            action: 'Check CAT Tool Export',
            description: 'Verify your translation tool exported the file correctly with all required elements',
            priority: 'medium',
            difficulty: 'easy',
            timeEstimate: '1-2 minutes'
          }
        );
        break;

      case 'SYNTAX_001':
        suggestions.push(
          {
            action: 'Validate XML',
            description: 'Use an XML validator to identify and fix syntax errors',
            priority: 'high',
            difficulty: 'medium',
            timeEstimate: '5-15 minutes',
            helpUrl: 'https://www.w3.org/TR/xml/'
          },
          {
            action: 'Check for Special Characters',
            description: 'Ensure special characters like <, >, &, ", \' are properly escaped',
            priority: 'high',
            difficulty: 'easy',
            timeEstimate: '2-5 minutes'
          },
          {
            action: 'Re-export from CAT Tool',
            description: 'Try exporting the file again from your translation tool',
            priority: 'medium',
            difficulty: 'easy',
            timeEstimate: '1-2 minutes'
          }
        );
        break;

      case 'ATTR_001':
        suggestions.push(
          {
            action: 'Correct Attribute Value',
            description: `Update the "${error.location.attributeName}" attribute with a valid value`,
            priority: 'medium',
            difficulty: 'easy',
            timeEstimate: '1-3 minutes'
          },
          {
            action: 'Check Documentation',
            description: 'Review the XLIFF specification for valid attribute values',
            priority: 'low',
            difficulty: 'medium',
            timeEstimate: '5-10 minutes',
            helpUrl: error.helpUrl
          }
        );
        break;

      case 'ENC_001':
        suggestions.push(
          {
            action: 'Save as UTF-8',
            description: 'Ensure the file is saved with UTF-8 encoding',
            priority: 'high',
            difficulty: 'easy',
            timeEstimate: '1-2 minutes'
          },
          {
            action: 'Check Source Content',
            description: 'Verify the original content doesn\'t have encoding issues',
            priority: 'medium',
            difficulty: 'medium',
            timeEstimate: '5-10 minutes'
          }
        );
        break;

      case 'SCHEMA_001':
        suggestions.push(
          {
            action: 'Verify XLIFF Version',
            description: 'Check that the file is a supported XLIFF version (1.2, 2.0, or MXLIFF)',
            priority: 'high',
            difficulty: 'easy',
            timeEstimate: '1-2 minutes'
          },
          {
            action: 'Convert Format',
            description: 'Consider converting to a supported XLIFF version if needed',
            priority: 'medium',
            difficulty: 'hard',
            timeEstimate: '15-30 minutes'
          }
        );
        break;

      case 'PERF_001':
        suggestions.push(
          {
            action: 'Split Large File',
            description: 'Consider splitting large files into smaller chunks for better performance',
            priority: 'low',
            difficulty: 'medium',
            timeEstimate: '10-20 minutes'
          },
          {
            action: 'Optimize Structure',
            description: 'Remove unnecessary elements or simplify complex structures',
            priority: 'low',
            difficulty: 'hard',
            timeEstimate: '20-45 minutes'
          }
        );
        break;

      case 'COMPAT_001':
        suggestions.push(
          {
            action: 'Check Feature Support',
            description: 'Verify which features are supported in your target system',
            priority: 'medium',
            difficulty: 'medium',
            timeEstimate: '5-15 minutes'
          },
          {
            action: 'Use Standard Features',
            description: 'Consider using only widely-supported XLIFF features',
            priority: 'low',
            difficulty: 'medium',
            timeEstimate: '10-30 minutes'
          }
        );
        break;

      default:
        suggestions.push(
          {
            action: 'Review Error Details',
            description: 'Check the technical details and error location for specific guidance',
            priority: 'medium',
            difficulty: 'medium',
            timeEstimate: '5-10 minutes'
          }
        );
        break;
    }

    return suggestions;
  }

  private formatCategory(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.STRUCTURAL: return 'Document Structure';
      case ErrorCategory.CONTENT: return 'Content Validation';
      case ErrorCategory.SCHEMA: return 'Schema Compliance';
      case ErrorCategory.ENCODING: return 'Character Encoding';
      case ErrorCategory.SYNTAX: return 'XML Syntax';
      case ErrorCategory.SEMANTIC: return 'Semantic Validation';
      case ErrorCategory.PERFORMANCE: return 'Performance';
      case ErrorCategory.COMPATIBILITY: return 'Compatibility';
      default: return 'General';
    }
  }

  private getHelpUrl(error: EnhancedXLIFFError): string {
    if (error.helpUrl) return error.helpUrl;

    switch (error.category) {
      case ErrorCategory.STRUCTURAL:
      case ErrorCategory.SCHEMA:
        return 'https://docs.oasis-open.org/xliff/xliff-core/v1.2/os/xliff-core.html';
      case ErrorCategory.SYNTAX:
        return 'https://www.w3.org/TR/xml/';
      case ErrorCategory.ENCODING:
        return 'https://www.w3.org/International/articles/definitions-characters/';
      default:
        return 'https://www.oasis-open.org/committees/xliff/';
    }
  }

  private calculateFixTimeEstimate(reports: ErrorReport[]): string {
    let totalMinutes = 0;

    reports.forEach(report => {
      // Get the highest priority suggestion's time estimate
      const primarySuggestion = report.suggestions
        .filter(s => s.timeEstimate)
        .sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })[0];

      if (primarySuggestion?.timeEstimate) {
        // Parse time estimate (e.g., "5-15 minutes" -> average of 10)
        const match = primarySuggestion.timeEstimate.match(/(\d+)(-(\d+))?\s*minutes?/);
        if (match) {
          const min = parseInt(match[1]);
          const max = match[3] ? parseInt(match[3]) : min;
          totalMinutes += (min + max) / 2;
        }
      } else {
        // Default estimate based on severity
        switch (report.severity) {
          case ReportSeverity.CRITICAL: totalMinutes += 15; break;
          case ReportSeverity.ERROR: totalMinutes += 10; break;
          case ReportSeverity.WARNING: totalMinutes += 5; break;
          default: totalMinutes += 2; break;
        }
      }
    });

    if (totalMinutes < 5) return 'Less than 5 minutes';
    if (totalMinutes < 15) return '5-15 minutes';
    if (totalMinutes < 30) return '15-30 minutes';
    if (totalMinutes < 60) return '30-60 minutes';
    return 'More than 1 hour';
  }
}

/**
 * HTML formatter for web display
 */
export class HTMLReportFormatter {
  /**
   * Format error report as HTML
   */
  public formatReport(report: ErrorReport): string {
    const severityClass = this.getSeverityClass(report.severity);
    const severityIcon = this.getSeverityIcon(report.severity);

    return `
      <div class="error-report ${severityClass}">
        <div class="error-header">
          <span class="severity-icon">${severityIcon}</span>
          <h3 class="error-title">${this.escapeHtml(report.title)}</h3>
          <span class="error-category">${this.escapeHtml(report.category)}</span>
        </div>
        
        <div class="error-message">
          <p>${this.escapeHtml(report.message)}</p>
        </div>
        
        ${report.location ? this.formatLocationHtml(report.location) : ''}
        
        <div class="suggestions">
          <h4>Suggested Actions:</h4>
          <ul class="suggestion-list">
            ${report.suggestions.map(s => this.formatSuggestionHtml(s)).join('')}
          </ul>
        </div>
        
        ${report.helpUrl ? `<div class="help-link">
          <a href="${report.helpUrl}" target="_blank" rel="noopener">📖 View Documentation</a>
        </div>` : ''}
        
        <details class="technical-details">
          <summary>Technical Details</summary>
          <div class="details-content">
            <p><strong>Error Code:</strong> ${report.technicalDetails?.errorCode}</p>
            <p><strong>Phase:</strong> ${report.technicalDetails?.phase}</p>
            <p><strong>Recoverable:</strong> ${report.technicalDetails?.recoverable ? 'Yes' : 'No'}</p>
            <p><strong>Report ID:</strong> ${report.id}</p>
          </div>
        </details>
      </div>
    `;
  }

  /**
   * Format error summary as HTML
   */
  public formatSummary(summary: ErrorSummary): string {
    const statusClass = summary.canProceed ? 'can-proceed' : 'cannot-proceed';
    const statusIcon = summary.canProceed ? '✅' : '❌';
    const statusText = summary.canProceed ? 'Can proceed with processing' : 'Critical issues must be fixed first';

    return `
      <div class="error-summary ${statusClass}">
        <div class="summary-header">
          <h2>${statusIcon} XLIFF Validation Report</h2>
          <p class="status-text">${statusText}</p>
        </div>
        
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">Total Issues:</span>
            <span class="stat-value">${summary.totalIssues}</span>
          </div>
          <div class="stat-item critical">
            <span class="stat-label">Critical:</span>
            <span class="stat-value">${summary.criticalCount}</span>
          </div>
          <div class="stat-item error">
            <span class="stat-label">Errors:</span>
            <span class="stat-value">${summary.errorCount}</span>
          </div>
          <div class="stat-item warning">
            <span class="stat-label">Warnings:</span>
            <span class="stat-value">${summary.warningCount}</span>
          </div>
          <div class="stat-item info">
            <span class="stat-label">Info:</span>
            <span class="stat-value">${summary.infoCount}</span>
          </div>
        </div>
        
        <div class="fix-estimate">
          <p><strong>Estimated Fix Time:</strong> ${summary.fixTimeEstimate}</p>
        </div>
        
        <div class="category-breakdown">
          <h3>Issues by Category:</h3>
          <ul>
            ${Object.entries(summary.categoryCounts).map(([category, count]) => 
              `<li>${category}: ${count}</li>`
            ).join('')}
          </ul>
        </div>
        
        <div class="detailed-reports">
          ${summary.reports.map(report => this.formatReport(report)).join('')}
        </div>
      </div>
    `;
  }

  private getSeverityClass(severity: ReportSeverity): string {
    return `severity-${severity}`;
  }

  private getSeverityIcon(severity: ReportSeverity): string {
    switch (severity) {
      case ReportSeverity.CRITICAL: return '🚨';
      case ReportSeverity.ERROR: return '❌';
      case ReportSeverity.WARNING: return '⚠️';
      case ReportSeverity.INFO: return 'ℹ️';
      default: return '📋';
    }
  }

  private formatLocationHtml(location: ErrorReport['location']): string {
    if (!location) return '';
    
    return `
      <div class="error-location">
        <p><strong>Location:</strong> ${this.escapeHtml(location.description)}</p>
      </div>
    `;
  }

  private formatSuggestionHtml(suggestion: Suggestion): string {
    const priorityClass = `priority-${suggestion.priority}`;
    const difficultyBadge = this.getDifficultyBadge(suggestion.difficulty);
    const priorityBadge = this.getPriorityBadge(suggestion.priority);

    return `
      <li class="suggestion-item ${priorityClass}">
        <div class="suggestion-header">
          <strong>${this.escapeHtml(suggestion.action)}</strong>
          ${priorityBadge}
          ${difficultyBadge}
        </div>
        <p class="suggestion-description">${this.escapeHtml(suggestion.description)}</p>
        ${suggestion.timeEstimate ? `<p class="time-estimate">⏱️ ${suggestion.timeEstimate}</p>` : ''}
        ${suggestion.helpUrl ? `<a href="${suggestion.helpUrl}" target="_blank" rel="noopener">Learn more</a>` : ''}
      </li>
    `;
  }

  private getPriorityBadge(priority: string): string {
    const badges = {
      high: '<span class="badge priority-high">High Priority</span>',
      medium: '<span class="badge priority-medium">Medium Priority</span>',
      low: '<span class="badge priority-low">Low Priority</span>'
    };
    return badges[priority as keyof typeof badges] || '';
  }

  private getDifficultyBadge(difficulty: string): string {
    const badges = {
      easy: '<span class="badge difficulty-easy">Easy</span>',
      medium: '<span class="badge difficulty-medium">Medium</span>',
      hard: '<span class="badge difficulty-hard">Hard</span>'
    };
    return badges[difficulty as keyof typeof badges] || '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export instances for convenience
export const userFriendlyReporter = new UserFriendlyReporter();
export const htmlReportFormatter = new HTMLReportFormatter(); 