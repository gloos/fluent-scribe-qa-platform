# MQM Reporting System Usage Guide

## Overview

The MQM Reporting System provides comprehensive report generation capabilities for MQM assessment results. It supports multiple stakeholder views, output formats, and customization options.

## Core Components

### 1. Report Types and Templates

```typescript
import { ReportTemplates } from '../templates/report-templates';

// Get all available templates
const allTemplates = ReportTemplates.getAllTemplates();

// Get specific template
const executiveTemplate = ReportTemplates.getTemplate('executive-dashboard');

// Get recommended templates for use case
const qualityTemplates = ReportTemplates.getRecommendedTemplates('quality');
```

### 2. Report Generation

```typescript
import { ReportGenerator } from '../utils/report-generator';
import { MQMScoreResult, MQMErrorInstance, MQMAssessmentConfig } from '../types/assessment';
import { ReportConfiguration } from '../types/reporting';

// Create report generator instance
const generator = ReportGenerator.getInstance();

// Example assessment data
const scoreResult: MQMScoreResult = {
  mqm_score: 85.3,
  error_rate: 1.2,
  total_errors: 24,
  total_penalty: 48.5,
  unit_count: 2000,
  assessment_date: '2024-01-15T10:00:00Z',
  dimension_breakdown: {
    accuracy: { error_count: 8, penalty: 20.0, normalized_score: 90.0 },
    fluency: { error_count: 6, penalty: 15.0, normalized_score: 92.5 },
    style: { error_count: 4, penalty: 8.0, normalized_score: 96.0 },
    terminology: { error_count: 3, penalty: 3.0, normalized_score: 98.5 },
    locale_conventions: { error_count: 2, penalty: 2.0, normalized_score: 99.0 },
    design_and_markup: { error_count: 1, penalty: 0.5, normalized_score: 99.8 }
  },
  confidence_interval: {
    lower: 82.1,
    upper: 88.5,
    confidence_level: 0.95
  }
};

const errors: MQMErrorInstance[] = [
  {
    id: 'err_1',
    dimension: 'accuracy',
    category: 'mistranslation',
    severity: 'major',
    highlighted_text: 'incorrect translation',
    description: 'The word "bank" was translated as financial institution instead of river bank',
    penalty: 5.0,
    start_offset: 125,
    end_offset: 145
  },
  // ... more errors
];

const config: MQMAssessmentConfig = {
  content_type: 'general',
  source_language: 'en',
  target_language: 'es',
  dimension_weights: {
    accuracy: 0.35,
    fluency: 0.25,
    style: 0.15,
    terminology: 0.15,
    locale_conventions: 0.05,
    design_and_markup: 0.05
  },
  severity_penalties: {
    neutral: 0,
    minor: 1,
    major: 5,
    critical: 10
  }
};

// Generate comprehensive report
const reportConfig: ReportConfiguration = {
  type: 'comprehensive-scorecard',
  sections: [
    'overview',
    'quality-metrics',
    'error-breakdown',
    'severity-analysis',
    'dimension-analysis',
    'statistical-summary',
    'recommendations'
  ],
  outputFormat: 'html',
  customization: {
    includeCharts: true,
    includeExamples: true,
    includeRecommendations: true,
    includeStatistics: true,
    detailLevel: 'detailed'
  }
};

const report = generator.generateReport(
  scoreResult,
  errors,
  config,
  reportConfig,
  'Translation Quality Assessment'
);
```

### 3. Export to Different Formats

```typescript
import { ReportExporterFactory } from '../exporters/report-exporters';

// Export as HTML
const htmlExport = ReportExporterFactory.exportReport(report, 'html');
console.log('HTML Content Type:', htmlExport.contentType);
console.log('Filename:', htmlExport.filename);
// Save htmlExport.content to file

// Export as JSON
const jsonExport = ReportExporterFactory.exportReport(report, 'json');

// Export as CSV
const csvExport = ReportExporterFactory.exportReport(report, 'csv');

// Export as PDF (placeholder implementation)
const pdfExport = ReportExporterFactory.exportReport(report, 'pdf');

// Get supported formats
const supportedFormats = ReportExporterFactory.getSupportedFormats();
console.log('Supported formats:', supportedFormats);
```

## Stakeholder-Specific Reports

### Executive Dashboard

```typescript
const executiveConfig = ReportTemplates.createCustomConfiguration('executive-dashboard', {
  customization: {
    includeCharts: true,
    includeExamples: false,
    detailLevel: 'summary'
  }
});

const executiveReport = generator.generateReport(
  scoreResult,
  errors,
  config,
  executiveConfig!,
  'Q4 Translation Quality Review'
);
```

### Project Manager Report

```typescript
const pmConfig = ReportTemplates.createCustomConfiguration('project-manager', {
  stakeholderView: 'projectManager',
  outputFormat: 'html'
});

const pmReport = generator.generateReport(
  scoreResult,
  errors,
  config,
  pmConfig!,
  'Project Alpha Translation Assessment'
);
```

### Quality Analyst Deep Dive

```typescript
const qaConfig = ReportTemplates.createCustomConfiguration('quality-analyst', {
  sections: [
    'overview',
    'error-breakdown',
    'severity-analysis',
    'dimension-analysis',
    'category-analysis',
    'statistical-summary'
  ],
  stakeholderView: 'qualityAnalyst',
  customization: {
    includeStatistics: true,
    detailLevel: 'detailed'
  }
});

const qaReport = generator.generateReport(
  scoreResult,
  errors,
  config,
  qaConfig!,
  'Detailed Quality Analysis'
);
```

### Linguistic Review Report

```typescript
const linguisticConfig = ReportTemplates.createCustomConfiguration('linguistic-review', {
  stakeholderView: 'linguisticReview',
  customization: {
    includeExamples: true,
    detailLevel: 'detailed'
  }
});

const linguisticReport = generator.generateReport(
  scoreResult,
  errors,
  config,
  linguisticConfig!,
  'Linguistic Quality Review'
);
```

### Developer Technical Report

```typescript
const developerConfig = ReportTemplates.createCustomConfiguration('developer', {
  stakeholderView: 'developer',
  outputFormat: 'json',
  customization: {
    includeExamples: true,
    detailLevel: 'standard'
  }
});

const developerReport = generator.generateReport(
  scoreResult,
  errors,
  config,
  developerConfig!,
  'Technical Quality Assessment'
);
```

## Custom Report Configuration

### Advanced Customization

```typescript
const customConfig: ReportConfiguration = {
  type: 'detailed-analysis',
  sections: [
    'overview',
    'quality-metrics',
    'error-breakdown',
    'severity-analysis',
    'dimension-analysis',
    'category-analysis',
    'weighting-analysis',
    'statistical-summary',
    'recommendations',
    'benchmarks'
  ],
  outputFormat: 'html',
  stakeholderView: 'qualityAnalyst',
  customization: {
    includeCharts: true,
    includeExamples: true,
    includeRecommendations: true,
    includeStatistics: true,
    detailLevel: 'detailed'
  }
};

// Validate configuration against template
const validation = ReportTemplates.validateConfiguration('detailed-analysis', customConfig);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Multiple Format Export

```typescript
async function exportMultipleFormats(report: MQMReport, projectName: string) {
  const formats: OutputFormat[] = ['html', 'json', 'csv'];
  const exports = [];
  
  for (const format of formats) {
    try {
      const exportResult = ReportExporterFactory.exportReport(report, format);
      exports.push({
        format,
        ...exportResult
      });
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
    }
  }
  
  return exports;
}

// Usage
const allExports = await exportMultipleFormats(report, 'project-alpha');
allExports.forEach(exp => {
  console.log(`${exp.format.toUpperCase()}: ${exp.filename}`);
  // Save exp.content to file system
});
```

## Integration Examples

### Web API Integration

```typescript
import express from 'express';

const app = express();

app.post('/api/reports/generate', async (req, res) => {
  try {
    const { scoreResult, errors, config, reportType = 'comprehensive-scorecard', format = 'html' } = req.body;
    
    // Get report configuration
    const reportConfig = ReportTemplates.createCustomConfiguration(reportType, {
      outputFormat: format
    });
    
    if (!reportConfig) {
      return res.status(400).json({ error: 'Invalid report type' });
    }
    
    // Generate report
    const generator = ReportGenerator.getInstance();
    const report = generator.generateReport(
      scoreResult,
      errors,
      config,
      reportConfig,
      req.body.projectName || 'MQM Assessment'
    );
    
    // Export in requested format
    const exportResult = ReportExporterFactory.exportReport(report, format);
    
    // Set appropriate headers
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    
    // Send file
    res.send(exportResult.content);
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/api/reports/templates', (req, res) => {
  const useCase = req.query.useCase as string;
  const templates = useCase 
    ? ReportTemplates.getRecommendedTemplates(useCase as any)
    : ReportTemplates.getAllTemplates();
    
  res.json(templates);
});
```

### React Component Integration

```typescript
import React, { useState } from 'react';
import { ReportGenerator } from '../lib/utils/report-generator';
import { ReportExporterFactory } from '../lib/exporters/report-exporters';
import { ReportTemplates } from '../lib/templates/report-templates';

interface ReportGeneratorComponentProps {
  scoreResult: MQMScoreResult;
  errors: MQMErrorInstance[];
  config: MQMAssessmentConfig;
}

export const ReportGeneratorComponent: React.FC<ReportGeneratorComponentProps> = ({
  scoreResult,
  errors,
  config
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('comprehensive-scorecard');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('html');
  const [loading, setLoading] = useState(false);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const reportConfig = ReportTemplates.createCustomConfiguration(selectedTemplate, {
        outputFormat
      });
      
      if (!reportConfig) {
        throw new Error('Invalid template configuration');
      }
      
      const generator = ReportGenerator.getInstance();
      const report = generator.generateReport(
        scoreResult,
        errors,
        config,
        reportConfig,
        'Quality Assessment Report'
      );
      
      const exportResult = ReportExporterFactory.exportReport(report, outputFormat);
      
      // Create download link
      const blob = new Blob([exportResult.content], { type: exportResult.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportResult.filename;
      link.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoading(false);
    }
  };

  const templates = ReportTemplates.getAllTemplates();
  const supportedFormats = ReportExporterFactory.getSupportedFormats();

  return (
    <div className="report-generator">
      <h3>Generate MQM Report</h3>
      
      <div className="form-group">
        <label>Report Template:</label>
        <select 
          value={selectedTemplate} 
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label>Output Format:</label>
        <select 
          value={outputFormat} 
          onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
        >
          {supportedFormats.map(format => (
            <option key={format} value={format}>
              {format.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      
      <button 
        onClick={handleGenerateReport} 
        disabled={loading}
        className="generate-btn"
      >
        {loading ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
};
```

## Best Practices

### 1. Template Selection
- Use **Executive Dashboard** for high-level stakeholder communications
- Use **Project Manager** template for resource planning and timeline estimates
- Use **Quality Analyst** template for detailed error pattern analysis
- Use **Linguistic Review** for language-specific quality assessments
- Use **Developer** template for technical integration and automation

### 2. Format Selection
- **HTML**: Best for interactive viewing and presentations
- **PDF**: Best for formal reports and archival
- **JSON**: Best for programmatic processing and API integration
- **CSV**: Best for data analysis and spreadsheet import

### 3. Performance Considerations
- Cache report generator instances using singleton pattern
- Consider pagination for large error inventories
- Use appropriate detail levels based on audience needs
- Implement async generation for large datasets

### 4. Customization Guidelines
- Always validate configurations before generation
- Use template-based approach for consistency
- Customize based on stakeholder requirements
- Include appropriate level of statistical detail

This comprehensive reporting system provides flexible, professional-quality reports suitable for various stakeholders and use cases in the MQM quality assessment workflow. 