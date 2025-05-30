import { MQMReport, OutputFormat, ErrorBreakdown, DimensionBreakdown, SeverityDistribution } from '../types/reporting';

/**
 * Report Export Interface
 */
export interface ReportExporter {
  export(report: MQMReport): string | Buffer;
  getContentType(): string;
  getFileExtension(): string;
}

/**
 * JSON Report Exporter
 */
export class JSONReportExporter implements ReportExporter {
  export(report: MQMReport): string {
    return JSON.stringify(report, null, 2);
  }

  getContentType(): string {
    return 'application/json';
  }

  getFileExtension(): string {
    return '.json';
  }
}

/**
 * HTML Report Exporter
 */
export class HTMLReportExporter implements ReportExporter {
  export(report: MQMReport): string {
    return this.generateHTMLReport(report);
  }

  getContentType(): string {
    return 'text/html';
  }

  getFileExtension(): string {
    return '.html';
  }

  private generateHTMLReport(report: MQMReport): string {
    const css = this.getCSS();
    const content = this.generateHTMLContent(report);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MQM Assessment Report - ${report.overview.projectName}</title>
    <style>${css}</style>
</head>
<body>
    ${content}
</body>
</html>`;
  }

  private generateHTMLContent(report: MQMReport): string {
    return `
    <div class="report-container">
        ${this.generateHeader(report)}
        ${this.generateOverview(report)}
        ${this.generateSummary(report)}
        ${this.generateDetails(report)}
        ${this.generateCharts(report)}
        ${this.generateStakeholderViews(report)}
        ${this.generateFooter(report)}
    </div>`;
  }

  private generateHeader(report: MQMReport): string {
    return `
    <header class="report-header">
        <h1>MQM Quality Assessment Report</h1>
        <div class="report-meta">
            <p><strong>Project:</strong> ${report.overview.projectName}</p>
            <p><strong>Assessment Date:</strong> ${new Date(report.overview.assessmentDate).toLocaleDateString()}</p>
            <p><strong>Report Generated:</strong> ${new Date(report.createdAt).toLocaleDateString()}</p>
            <p><strong>Report Type:</strong> ${report.type}</p>
        </div>
    </header>`;
  }

  private generateOverview(report: MQMReport): string {
    const qualityLevel = report.overview.qualityLevel;
    const qualityClass = qualityLevel.level.toLowerCase();
    
    return `
    <section class="overview">
        <h2>Executive Overview</h2>
        <div class="quality-badge quality-${qualityClass}">
            <h3>Quality Level: ${qualityLevel.level.toUpperCase()}</h3>
            <p class="score">MQM Score: ${qualityLevel.score.toFixed(2)}</p>
            <p class="description">${qualityLevel.description}</p>
        </div>
        <div class="overview-stats">
            <div class="stat">
                <h4>Total Word Count</h4>
                <p class="stat-value">${report.overview.totalWordCount.toLocaleString()}</p>
            </div>
            <div class="stat">
                <h4>Assessment Scope</h4>
                <p class="stat-value">${report.overview.assessmentScope}</p>
            </div>
            <div class="stat">
                <h4>Pass Status</h4>
                <p class="stat-value ${report.overview.passStatus ? 'pass' : 'fail'}">
                    ${report.overview.passStatus ? '✓ PASS' : '✗ FAIL'}
                </p>
            </div>
        </div>
    </section>`;
  }

  private generateSummary(report: MQMReport): string {
    const kpis = report.summary.kpis.map(kpi => `
        <div class="kpi-item kpi-${kpi.status}">
            <h4>${kpi.name}</h4>
            <div class="kpi-value">${kpi.value} ${kpi.unit}</div>
            <div class="kpi-target">Target: ${kpi.target}</div>
            <p class="kpi-description">${kpi.description}</p>
        </div>
    `).join('');

    const recommendations = report.summary.recommendations.map(rec => `
        <li>${rec}</li>
    `).join('');

    return `
    <section class="summary">
        <h2>Quality Summary</h2>
        <div class="kpis">
            <h3>Key Performance Indicators</h3>
            <div class="kpi-grid">
                ${kpis}
            </div>
        </div>
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${recommendations}
            </ul>
        </div>
    </section>`;
  }

  private generateDetails(report: MQMReport): string {
    const errorInventory = this.generateErrorInventory(report.details.errorInventory);
    const dimensionBreakdown = this.generateDimensionBreakdown(report.details.dimensionBreakdown);
    const severityDistribution = this.generateSeverityDistribution(report.details.severityDistribution);

    return `
    <section class="details">
        <h2>Detailed Analysis</h2>
        ${errorInventory}
        ${dimensionBreakdown}
        ${severityDistribution}
    </section>`;
  }

  private generateErrorInventory(errors: ErrorBreakdown[]): string {
    const errorRows = errors.slice(0, 20).map(error => `
        <tr>
            <td>${error.dimension}</td>
            <td>${error.category}</td>
            <td class="severity severity-${error.severity.toLowerCase()}">${error.severity}</td>
            <td class="count">${error.count}</td>
            <td class="percentage">${error.percentage.toFixed(1)}%</td>
            <td class="impact">${error.weightedImpact.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <div class="error-inventory">
        <h3>Error Inventory (Top 20)</h3>
        <table class="error-table">
            <thead>
                <tr>
                    <th>Dimension</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Count</th>
                    <th>Percentage</th>
                    <th>Weighted Impact</th>
                </tr>
            </thead>
            <tbody>
                ${errorRows}
            </tbody>
        </table>
    </div>`;
  }

  private generateDimensionBreakdown(dimensions: DimensionBreakdown[]): string {
    const dimensionRows = dimensions.map(dim => `
        <tr>
            <td>${dim.dimension}</td>
            <td class="count">${dim.totalErrors}</td>
            <td class="percentage">${dim.percentage.toFixed(1)}%</td>
            <td class="impact impact-${dim.impact}">${dim.impact.toUpperCase()}</td>
            <td class="score">${dim.weightedScore.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <div class="dimension-breakdown">
        <h3>Dimension Breakdown</h3>
        <table class="dimension-table">
            <thead>
                <tr>
                    <th>MQM Dimension</th>
                    <th>Total Errors</th>
                    <th>Percentage</th>
                    <th>Impact Level</th>
                    <th>Weighted Score</th>
                </tr>
            </thead>
            <tbody>
                ${dimensionRows}
            </tbody>
        </table>
    </div>`;
  }

  private generateSeverityDistribution(severities: SeverityDistribution[]): string {
    const severityRows = severities.map(sev => `
        <tr>
            <td class="severity severity-${sev.severity.toLowerCase()}">${sev.severity}</td>
            <td class="count">${sev.count}</td>
            <td class="percentage">${sev.percentage.toFixed(1)}%</td>
            <td class="score">${sev.weightedScore.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
    <div class="severity-distribution">
        <h3>Severity Distribution</h3>
        <table class="severity-table">
            <thead>
                <tr>
                    <th>Severity Level</th>
                    <th>Count</th>
                    <th>Percentage</th>
                    <th>Weighted Score</th>
                </tr>
            </thead>
            <tbody>
                ${severityRows}
            </tbody>
        </table>
    </div>`;
  }

  private generateCharts(report: MQMReport): string {
    // For HTML export, we'll include chart placeholders
    // In a real implementation, you'd integrate with a charting library
    return `
    <section class="charts">
        <h2>Visual Analysis</h2>
        <div class="chart-grid">
            <div class="chart-placeholder">
                <h3>${report.charts.dimensionDistribution.title}</h3>
                <p>Chart visualization would appear here</p>
                <p>Total Count: ${report.charts.dimensionDistribution.totalCount}</p>
            </div>
            <div class="chart-placeholder">
                <h3>${report.charts.severityDistribution.title}</h3>
                <p>Chart visualization would appear here</p>
                <p>Total Count: ${report.charts.severityDistribution.totalCount}</p>
            </div>
        </div>
    </section>`;
  }

  private generateStakeholderViews(report: MQMReport): string {
    let stakeholderContent = '';
    
    Object.entries(report.stakeholderViews).forEach(([viewType, viewData]) => {
      stakeholderContent += `
        <div class="stakeholder-view">
            <h3>${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View</h3>
            <div class="view-content">
                <pre>${JSON.stringify(viewData, null, 2)}</pre>
            </div>
        </div>`;
    });

    return stakeholderContent ? `
    <section class="stakeholder-views">
        <h2>Stakeholder-Specific Views</h2>
        ${stakeholderContent}
    </section>` : '';
  }

  private generateFooter(report: MQMReport): string {
    return `
    <footer class="report-footer">
        <div class="metadata">
            <p><strong>Generated by:</strong> ${report.metadata.generatedBy}</p>
            <p><strong>Version:</strong> ${report.metadata.version}</p>
            <p><strong>Export Formats:</strong> ${report.metadata.exportFormats.join(', ')}</p>
        </div>
        <div class="timestamp">
            <p>Report generated on ${new Date().toLocaleString()}</p>
        </div>
    </footer>`;
  }

  private getCSS(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .report-container { max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        
        .report-header { border-bottom: 3px solid #2563eb; padding-bottom: 1rem; margin-bottom: 2rem; }
        .report-header h1 { color: #1e40af; font-size: 2.5rem; margin-bottom: 0.5rem; }
        .report-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .report-meta p { padding: 0.5rem; background: #f8fafc; border-left: 4px solid #e2e8f0; }
        
        .overview { margin-bottom: 3rem; }
        .quality-badge { text-align: center; padding: 2rem; border-radius: 8px; margin: 1rem 0; }
        .quality-excellent { background: linear-gradient(135deg, #10b981, #059669); color: white; }
        .quality-good { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
        .quality-fair { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .quality-poor { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
        .quality-unacceptable { background: linear-gradient(135deg, #7c2d12, #991b1b); color: white; }
        
        .overview-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 2rem; }
        .stat { background: #f8fafc; padding: 1.5rem; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: #1e40af; }
        .stat-value.pass { color: #059669; }
        .stat-value.fail { color: #dc2626; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .kpi-item { padding: 1.5rem; border-radius: 8px; border-left: 4px solid #e5e7eb; }
        .kpi-excellent { border-left-color: #059669; background: #f0fdf4; }
        .kpi-good { border-left-color: #3b82f6; background: #eff6ff; }
        .kpi-warning { border-left-color: #f59e0b; background: #fffbeb; }
        .kpi-value { font-size: 2rem; font-weight: bold; color: #1e40af; }
        
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8fafc; font-weight: 600; color: #374151; }
        tr:hover { background: #f9fafb; }
        
        .severity-critical { background: #fee2e2; color: #991b1b; font-weight: bold; }
        .severity-major { background: #fef3c7; color: #92400e; font-weight: bold; }
        .severity-minor { background: #e0f2fe; color: #0c4a6e; }
        .severity-neutral { background: #f3f4f6; color: #374151; }
        
        .impact-high { color: #dc2626; font-weight: bold; }
        .impact-medium { color: #f59e0b; font-weight: bold; }
        .impact-low { color: #059669; }
        
        .count, .percentage, .score, .impact { text-align: center; }
        
        .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin: 2rem 0; }
        .chart-placeholder { background: #f8fafc; padding: 2rem; border-radius: 8px; border: 2px dashed #d1d5db; text-align: center; }
        
        .stakeholder-view { margin: 2rem 0; padding: 1.5rem; background: #f8fafc; border-radius: 8px; }
        .view-content pre { background: white; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.875rem; }
        
        .report-footer { margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #e5e7eb; display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: center; }
        .metadata p, .timestamp p { margin: 0.25rem 0; color: #6b7280; font-size: 0.875rem; }
        
        h2 { color: #1e40af; margin: 2rem 0 1rem 0; font-size: 1.875rem; }
        h3 { color: #374151; margin: 1.5rem 0 1rem 0; font-size: 1.25rem; }
        h4 { color: #4b5563; margin: 1rem 0 0.5rem 0; }
        
        .recommendations ul { list-style-type: none; }
        .recommendations li { padding: 0.5rem 0; padding-left: 1.5rem; position: relative; }
        .recommendations li:before { content: '→'; position: absolute; left: 0; color: #3b82f6; font-weight: bold; }
        
        @media (max-width: 768px) {
            .report-container { padding: 1rem; }
            .report-header h1 { font-size: 2rem; }
            .overview-stats, .kpi-grid { grid-template-columns: 1fr; }
            .chart-grid { grid-template-columns: 1fr; }
            .report-footer { grid-template-columns: 1fr; text-align: center; }
        }
    `;
  }
}

/**
 * CSV Report Exporter
 */
export class CSVReportExporter implements ReportExporter {
  export(report: MQMReport): string {
    const sections = [];
    
    // Overview section
    sections.push('OVERVIEW');
    sections.push(`Project Name,${report.overview.projectName}`);
    sections.push(`Assessment Date,${report.overview.assessmentDate}`);
    sections.push(`Total Word Count,${report.overview.totalWordCount}`);
    sections.push(`Quality Level,${report.overview.qualityLevel.level}`);
    sections.push(`Overall Score,${report.overview.overallScore}`);
    sections.push(`Pass Status,${report.overview.passStatus ? 'PASS' : 'FAIL'}`);
    sections.push('');

    // KPIs section
    sections.push('KEY PERFORMANCE INDICATORS');
    sections.push('Name,Value,Unit,Target,Status,Description');
    report.summary.kpis.forEach(kpi => {
      sections.push(`"${kpi.name}",${kpi.value},${kpi.unit},${kpi.target},${kpi.status},"${kpi.description}"`);
    });
    sections.push('');

    // Error breakdown section
    sections.push('ERROR BREAKDOWN');
    sections.push('Dimension,Category,Severity,Count,Percentage,Weighted Impact');
    report.details.errorInventory.forEach(error => {
      sections.push(`${error.dimension},${error.category},${error.severity},${error.count},${error.percentage.toFixed(2)},${error.weightedImpact.toFixed(2)}`);
    });
    sections.push('');

    // Dimension breakdown
    sections.push('DIMENSION BREAKDOWN');
    sections.push('Dimension,Total Errors,Percentage,Impact Level,Weighted Score');
    report.details.dimensionBreakdown.forEach(dim => {
      sections.push(`${dim.dimension},${dim.totalErrors},${dim.percentage.toFixed(2)},${dim.impact},${dim.weightedScore.toFixed(2)}`);
    });
    sections.push('');

    // Severity distribution
    sections.push('SEVERITY DISTRIBUTION');
    sections.push('Severity,Count,Percentage,Weighted Score');
    report.details.severityDistribution.forEach(sev => {
      sections.push(`${sev.severity},${sev.count},${sev.percentage.toFixed(2)},${sev.weightedScore.toFixed(2)}`);
    });

    return sections.join('\n');
  }

  getContentType(): string {
    return 'text/csv';
  }

  getFileExtension(): string {
    return '.csv';
  }
}

/**
 * PDF Report Exporter (Placeholder)
 * In a real implementation, this would use a PDF generation library
 */
export class PDFReportExporter implements ReportExporter {
  export(report: MQMReport): Buffer {
    // Placeholder - would use a library like puppeteer, jsPDF, or similar
    const htmlExporter = new HTMLReportExporter();
    const htmlContent = htmlExporter.export(report);
    
    // Convert HTML to PDF using your preferred library
    // For now, return the HTML as text converted to buffer
    return Buffer.from(htmlContent, 'utf-8');
  }

  getContentType(): string {
    return 'application/pdf';
  }

  getFileExtension(): string {
    return '.pdf';
  }
}

/**
 * Report Exporter Factory
 */
export class ReportExporterFactory {
  static createExporter(format: OutputFormat): ReportExporter {
    switch (format) {
      case 'json':
        return new JSONReportExporter();
      case 'html':
        return new HTMLReportExporter();
      case 'csv':
        return new CSVReportExporter();
      case 'pdf':
        return new PDFReportExporter();
      case 'xlsx':
        // Would implement Excel exporter
        throw new Error('XLSX format not yet implemented');
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  static getSupportedFormats(): OutputFormat[] {
    return ['json', 'html', 'csv', 'pdf'];
  }

  static exportReport(report: MQMReport, format: OutputFormat): { content: string | Buffer; contentType: string; filename: string } {
    const exporter = this.createExporter(format);
    const content = exporter.export(report);
    const timestamp = new Date().toISOString().slice(0, 10);
    const sanitizedProjectName = report.overview.projectName.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
      content,
      contentType: exporter.getContentType(),
      filename: `mqm_report_${sanitizedProjectName}_${timestamp}${exporter.getFileExtension()}`
    };
  }
} 