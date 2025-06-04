import { Page } from '@playwright/test';

/**
 * WCAG 2.1 AA Compliance Checklist
 * Based on Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
 */

export interface WCAGChecklistItem {
  id: string;
  criterion: string;
  level: 'A' | 'AA';
  description: string;
  automated: boolean;
  manual: boolean;
  category: string;
}

export interface WCAGCheckResult {
  item: WCAGChecklistItem;
  status: 'pass' | 'fail' | 'manual' | 'not-applicable';
  notes?: string;
  evidence?: string[];
}

export const WCAG_CHECKLIST: WCAGChecklistItem[] = [
  // Perceivable
  {
    id: '1.1.1',
    criterion: 'Non-text Content',
    level: 'A',
    description: 'All non-text content has text alternatives that serve the equivalent purpose',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.2.1',
    criterion: 'Audio-only and Video-only (Prerecorded)',
    level: 'A',
    description: 'Alternatives for time-based media are provided',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.2.2',
    criterion: 'Captions (Prerecorded)',
    level: 'A',
    description: 'Captions are provided for all prerecorded audio content in synchronized media',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.2.3',
    criterion: 'Audio Description or Media Alternative (Prerecorded)',
    level: 'A',
    description: 'Audio description or full text alternative is provided for synchronized media',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.2.4',
    criterion: 'Captions (Live)',
    level: 'AA',
    description: 'Captions are provided for all live audio content in synchronized media',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.2.5',
    criterion: 'Audio Description (Prerecorded)',
    level: 'AA',
    description: 'Audio description is provided for all prerecorded video content',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.3.1',
    criterion: 'Info and Relationships',
    level: 'A',
    description: 'Information, structure, and relationships can be programmatically determined',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.3.2',
    criterion: 'Meaningful Sequence',
    level: 'A',
    description: 'Content reading sequence is meaningful when linearized',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.3.3',
    criterion: 'Sensory Characteristics',
    level: 'A',
    description: 'Instructions do not rely solely on sensory characteristics',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.3.4',
    criterion: 'Orientation',
    level: 'AA',
    description: 'Content does not restrict viewing to a single display orientation',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.3.5',
    criterion: 'Identify Input Purpose',
    level: 'AA',
    description: 'Input purpose can be programmatically determined for user interface components',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.1',
    criterion: 'Use of Color',
    level: 'A',
    description: 'Color is not used as the only visual means of conveying information',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.2',
    criterion: 'Audio Control',
    level: 'A',
    description: 'Audio that plays automatically can be paused, stopped, or controlled',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.3',
    criterion: 'Contrast (Minimum)',
    level: 'AA',
    description: 'Text has contrast ratio of at least 4.5:1 (or 3:1 for large text)',
    automated: true,
    manual: false,
    category: 'perceivable'
  },
  {
    id: '1.4.4',
    criterion: 'Resize Text',
    level: 'AA',
    description: 'Text can be resized up to 200% without loss of content or functionality',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.5',
    criterion: 'Images of Text',
    level: 'AA',
    description: 'Images of text are only used when essential or customizable',
    automated: false,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.10',
    criterion: 'Reflow',
    level: 'AA',
    description: 'Content can be presented without horizontal scrolling at 320 CSS pixels',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.11',
    criterion: 'Non-text Contrast',
    level: 'AA',
    description: 'UI components and graphics have contrast ratio of at least 3:1',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.12',
    criterion: 'Text Spacing',
    level: 'AA',
    description: 'Content can adapt to increased line height, paragraph spacing, and letter spacing',
    automated: true,
    manual: true,
    category: 'perceivable'
  },
  {
    id: '1.4.13',
    criterion: 'Content on Hover or Focus',
    level: 'AA',
    description: 'Additional content triggered by hover or focus can be dismissed and persistent',
    automated: true,
    manual: true,
    category: 'perceivable'
  },

  // Operable
  {
    id: '2.1.1',
    criterion: 'Keyboard',
    level: 'A',
    description: 'All functionality is available from a keyboard',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.1.2',
    criterion: 'No Keyboard Trap',
    level: 'A',
    description: 'Keyboard focus can be moved away from any component',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.1.4',
    criterion: 'Character Key Shortcuts',
    level: 'A',
    description: 'Character key shortcuts can be turned off or remapped',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.2.1',
    criterion: 'Timing Adjustable',
    level: 'A',
    description: 'Time limits can be turned off, adjusted, or extended',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.2.2',
    criterion: 'Pause, Stop, Hide',
    level: 'A',
    description: 'Moving, blinking, or auto-updating content can be paused, stopped, or hidden',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.3.1',
    criterion: 'Three Flashes or Below Threshold',
    level: 'A',
    description: 'Content does not contain flashing that occurs more than three times per second',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.1',
    criterion: 'Bypass Blocks',
    level: 'A',
    description: 'Mechanism to skip blocks of content is available',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.2',
    criterion: 'Page Titled',
    level: 'A',
    description: 'Web pages have titles that describe topic or purpose',
    automated: true,
    manual: false,
    category: 'operable'
  },
  {
    id: '2.4.3',
    criterion: 'Focus Order',
    level: 'A',
    description: 'Focus order preserves meaning and operability',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.4',
    criterion: 'Link Purpose (In Context)',
    level: 'A',
    description: 'Purpose of each link can be determined from link text or context',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.5',
    criterion: 'Multiple Ways',
    level: 'AA',
    description: 'More than one way to locate a page within a set of pages',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.6',
    criterion: 'Headings and Labels',
    level: 'AA',
    description: 'Headings and labels describe topic or purpose',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.4.7',
    criterion: 'Focus Visible',
    level: 'AA',
    description: 'Keyboard focus indicator is visible',
    automated: true,
    manual: false,
    category: 'operable'
  },
  {
    id: '2.5.1',
    criterion: 'Pointer Gestures',
    level: 'A',
    description: 'Multipoint or path-based gestures have single-pointer alternatives',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.5.2',
    criterion: 'Pointer Cancellation',
    level: 'A',
    description: 'Down-event of pointer can be aborted or undone',
    automated: false,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.5.3',
    criterion: 'Label in Name',
    level: 'A',
    description: 'Accessible name contains visible label text',
    automated: true,
    manual: true,
    category: 'operable'
  },
  {
    id: '2.5.4',
    criterion: 'Motion Actuation',
    level: 'A',
    description: 'Device motion can be disabled and has alternatives',
    automated: false,
    manual: true,
    category: 'operable'
  },

  // Understandable
  {
    id: '3.1.1',
    criterion: 'Language of Page',
    level: 'A',
    description: 'Primary language of each page can be programmatically determined',
    automated: true,
    manual: false,
    category: 'understandable'
  },
  {
    id: '3.1.2',
    criterion: 'Language of Parts',
    level: 'AA',
    description: 'Language of each passage can be programmatically determined',
    automated: true,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.2.1',
    criterion: 'On Focus',
    level: 'A',
    description: 'Receiving focus does not initiate change of context',
    automated: false,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.2.2',
    criterion: 'On Input',
    level: 'A',
    description: 'Changing settings does not cause change of context unless user is aware',
    automated: false,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.2.3',
    criterion: 'Consistent Navigation',
    level: 'AA',
    description: 'Navigation mechanisms are used consistently',
    automated: false,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.2.4',
    criterion: 'Consistent Identification',
    level: 'AA',
    description: 'Components with same functionality are identified consistently',
    automated: false,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.3.1',
    criterion: 'Error Identification',
    level: 'A',
    description: 'Input errors are identified and described to the user',
    automated: true,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.3.2',
    criterion: 'Labels or Instructions',
    level: 'A',
    description: 'Labels or instructions are provided when content requires user input',
    automated: true,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.3.3',
    criterion: 'Error Suggestion',
    level: 'AA',
    description: 'Error suggestions are provided when input errors are detected',
    automated: false,
    manual: true,
    category: 'understandable'
  },
  {
    id: '3.3.4',
    criterion: 'Error Prevention (Legal, Financial, Data)',
    level: 'AA',
    description: 'Submissions are reversible, checked, or confirmed for important data',
    automated: false,
    manual: true,
    category: 'understandable'
  },

  // Robust
  {
    id: '4.1.1',
    criterion: 'Parsing',
    level: 'A',
    description: 'Markup can be parsed unambiguously',
    automated: true,
    manual: false,
    category: 'robust'
  },
  {
    id: '4.1.2',
    criterion: 'Name, Role, Value',
    level: 'A',
    description: 'Name, role, and value can be programmatically determined',
    automated: true,
    manual: true,
    category: 'robust'
  },
  {
    id: '4.1.3',
    criterion: 'Status Messages',
    level: 'AA',
    description: 'Status messages can be programmatically determined',
    automated: true,
    manual: true,
    category: 'robust'
  }
];

/**
 * Automated WCAG checks using Playwright
 */
export class WCAGAutomatedChecker {
  constructor(private page: Page) {}

  async checkPageTitle(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '2.4.2')!;
    const title = await this.page.title();
    
    return {
      item,
      status: title && title.trim() ? 'pass' : 'fail',
      notes: title ? `Page title: "${title}"` : 'Page title is missing or empty'
    };
  }

  async checkLanguage(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '3.1.1')!;
    const htmlLang = await this.page.locator('html').getAttribute('lang');
    
    return {
      item,
      status: htmlLang && htmlLang.trim() ? 'pass' : 'fail',
      notes: htmlLang ? `Language set to: "${htmlLang}"` : 'HTML lang attribute is missing'
    };
  }

  async checkHeadingStructure(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '1.3.1')!;
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    
    let previousLevel = 0;
    let hasH1 = false;
    const issues: string[] = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const currentLevel = parseInt(tagName.slice(1));
      
      if (currentLevel === 1) hasH1 = true;
      
      if (previousLevel > 0 && currentLevel - previousLevel > 1) {
        issues.push(`Heading level skipped: ${tagName} follows h${previousLevel}`);
      }
      
      previousLevel = currentLevel;
    }

    if (!hasH1) {
      issues.push('No h1 element found on page');
    }

    return {
      item,
      status: issues.length === 0 ? 'pass' : 'fail',
      notes: issues.length > 0 ? issues.join('; ') : 'Heading structure is correct'
    };
  }

  async checkFormLabels(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '3.3.2')!;
    const formControls = await this.page.locator('input:not([type="hidden"]), select, textarea').all();
    const unlabeledControls: string[] = [];

    for (const control of formControls) {
      const hasLabel = await this.hasAccessibleName(control);
      if (!hasLabel) {
        const tagName = await control.evaluate(el => el.tagName.toLowerCase());
        const type = await control.getAttribute('type') || '';
        unlabeledControls.push(`${tagName}${type ? `[type="${type}"]` : ''}`);
      }
    }

    return {
      item,
      status: unlabeledControls.length === 0 ? 'pass' : 'fail',
      notes: unlabeledControls.length > 0 
        ? `Unlabeled form controls: ${unlabeledControls.join(', ')}`
        : 'All form controls have accessible labels'
    };
  }

  async checkImageAltText(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '1.1.1')!;
    const images = await this.page.locator('img').all();
    const missingAlt: string[] = [];

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      const src = await img.getAttribute('src');
      
      if (alt === null && role !== 'presentation') {
        missingAlt.push(src || 'unknown source');
      }
    }

    return {
      item,
      status: missingAlt.length === 0 ? 'pass' : 'fail',
      notes: missingAlt.length > 0
        ? `Images missing alt text: ${missingAlt.join(', ')}`
        : 'All images have appropriate alt text'
    };
  }

  async checkFocusVisibility(): Promise<WCAGCheckResult> {
    const item = WCAG_CHECKLIST.find(item => item.id === '2.4.7')!;
    const focusableElements = await this.page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    const elementsWithoutFocus: string[] = [];

    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      const element = focusableElements[i];
      await element.focus();
      
      const computedStyle = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow
        };
      });

      const hasFocusIndicator = 
        computedStyle.outline !== 'none' || 
        computedStyle.outlineWidth !== '0px' ||
        computedStyle.boxShadow !== 'none';

      if (!hasFocusIndicator) {
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        elementsWithoutFocus.push(tagName);
      }
    }

    return {
      item,
      status: elementsWithoutFocus.length === 0 ? 'pass' : 'fail',
      notes: elementsWithoutFocus.length > 0
        ? `Elements without visible focus: ${elementsWithoutFocus.join(', ')}`
        : 'All tested elements have visible focus indicators'
    };
  }

  private async hasAccessibleName(locator: any): Promise<boolean> {
    const element = locator.first();
    
    // Check for aria-label
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return true;
    
    // Check for aria-labelledby
    const ariaLabelledBy = await element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) return true;
    
    // Check for associated label
    const id = await element.getAttribute('id');
    if (id) {
      const label = await element.page().locator(`label[for="${id}"]`);
      const labelCount = await label.count();
      if (labelCount > 0) return true;
    }
    
    // Check for wrapping label
    const parentLabel = await element.locator('xpath=ancestor::label').count();
    return parentLabel > 0;
  }

  async runAllAutomatedChecks(): Promise<WCAGCheckResult[]> {
    const results: WCAGCheckResult[] = [];

    results.push(await this.checkPageTitle());
    results.push(await this.checkLanguage());
    results.push(await this.checkHeadingStructure());
    results.push(await this.checkFormLabels());
    results.push(await this.checkImageAltText());
    results.push(await this.checkFocusVisibility());

    return results;
  }
}

/**
 * Generate WCAG compliance report
 */
export function generateWCAGReport(results: WCAGCheckResult[]): {
  summary: {
    total: number;
    passed: number;
    failed: number;
    manual: number;
    notApplicable: number;
  };
  results: WCAGCheckResult[];
  recommendations: string[];
} {
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    manual: results.filter(r => r.status === 'manual').length,
    notApplicable: results.filter(r => r.status === 'not-applicable').length
  };

  const recommendations: string[] = [];
  
  results
    .filter(r => r.status === 'fail')
    .forEach(result => {
      recommendations.push(`${result.item.id} - ${result.item.criterion}: ${result.notes}`);
    });

  return {
    summary,
    results,
    recommendations
  };
} 