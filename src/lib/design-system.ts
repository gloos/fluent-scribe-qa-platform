// Design System Configuration for AI-Powered Linguistic QA Platform

export const designTokens = {
  // Color palette extension for QA-specific use cases
  colors: {
    // Severity indicators for QA errors
    severity: {
      critical: {
        light: 'hsl(0, 84%, 60%)',    // Red for critical errors
        dark: 'hsl(0, 62%, 50%)'
      },
      major: {
        light: 'hsl(39, 100%, 57%)',  // Orange for major errors
        dark: 'hsl(39, 100%, 47%)'
      },
      minor: {
        light: 'hsl(48, 100%, 67%)',  // Yellow for minor errors
        dark: 'hsl(48, 100%, 57%)'
      },
      info: {
        light: 'hsl(213, 100%, 67%)', // Blue for informational
        dark: 'hsl(213, 100%, 57%)'
      }
    },
    
    // Status indicators
    status: {
      success: {
        light: 'hsl(143, 85%, 96%)',  // Light green background
        DEFAULT: 'hsl(142, 76%, 36%)', // Green for success
        dark: 'hsl(142, 76%, 26%)'
      },
      warning: {
        light: 'hsl(48, 100%, 96%)',  // Light yellow background
        DEFAULT: 'hsl(38, 92%, 50%)',  // Orange for warnings
        dark: 'hsl(38, 92%, 40%)'
      },
      error: {
        light: 'hsl(0, 100%, 97%)',   // Light red background
        DEFAULT: 'hsl(0, 84%, 60%)',  // Red for errors
        dark: 'hsl(0, 84%, 50%)'
      },
      processing: {
        light: 'hsl(213, 100%, 97%)', // Light blue background
        DEFAULT: 'hsl(213, 94%, 68%)', // Blue for processing
        dark: 'hsl(213, 94%, 58%)'
      }
    },

    // MQM score ranges
    mqm: {
      excellent: 'hsl(143, 85%, 36%)',  // Green (0-5 errors)
      good: 'hsl(89, 85%, 36%)',        // Light green (6-15 errors)
      fair: 'hsl(48, 100%, 50%)',       // Yellow (16-25 errors)
      poor: 'hsl(39, 100%, 57%)',       // Orange (26-40 errors)
      unacceptable: 'hsl(0, 84%, 60%)'  // Red (40+ errors)
    },

    // QA-specific semantic colors
    translation: {
      source: 'hsl(213, 27%, 84%)',     // Light blue-gray for source text
      target: 'hsl(142, 20%, 85%)',     // Light green-gray for target text
      highlight: 'hsl(48, 100%, 88%)',  // Light yellow for highlights
      error: 'hsl(0, 100%, 95%)'        // Light red for error highlights
    }
  },

  // Typography scale
  typography: {
    fontSizes: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem'   // 36px
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },

  // Spacing scale
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem'     // 64px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
  }
}

// Component size variants
export const componentSizes = {
  button: {
    sm: {
      height: '2rem',      // 32px
      padding: '0 0.75rem', // 12px horizontal
      fontSize: '0.875rem'
    },
    md: {
      height: '2.5rem',    // 40px
      padding: '0 1rem',   // 16px horizontal
      fontSize: '1rem'
    },
    lg: {
      height: '3rem',      // 48px
      padding: '0 1.5rem', // 24px horizontal
      fontSize: '1.125rem'
    }
  },
  input: {
    sm: {
      height: '2rem',
      padding: '0 0.75rem',
      fontSize: '0.875rem'
    },
    md: {
      height: '2.5rem',
      padding: '0 1rem',
      fontSize: '1rem'
    },
    lg: {
      height: '3rem',
      padding: '0 1.5rem',
      fontSize: '1.125rem'
    }
  }
}

// Animation configuration
export const animations = {
  transitions: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out'
  },
  durations: {
    fast: 150,
    normal: 200,
    slow: 300
  }
}

// Accessibility guidelines
export const accessibility = {
  // Minimum touch target size (44px x 44px for mobile)
  minTouchTarget: '2.75rem',
  
  // Color contrast ratios
  colorContrast: {
    normal: 4.5,      // AA standard
    large: 3,         // AA standard for large text
    enhanced: 7       // AAA standard
  },
  
  // Focus ring configuration
  focusRing: {
    width: '2px',
    offset: '2px',
    color: 'hsl(var(--ring))'
  }
}

// QA-specific component configurations
export const qaComponents = {
  // Error severity indicator configuration
  errorSeverity: {
    critical: {
      color: designTokens.colors.severity.critical.light,
      icon: 'AlertCircle',
      weight: 10
    },
    major: {
      color: designTokens.colors.severity.major.light,
      icon: 'AlertTriangle',
      weight: 5
    },
    minor: {
      color: designTokens.colors.severity.minor.light,
      icon: 'Info',
      weight: 1
    }
  },

  // MQM score visualization
  mqmScore: {
    ranges: [
      { min: 0, max: 5, label: 'Excellent', color: designTokens.colors.mqm.excellent },
      { min: 6, max: 15, label: 'Good', color: designTokens.colors.mqm.good },
      { min: 16, max: 25, label: 'Fair', color: designTokens.colors.mqm.fair },
      { min: 26, max: 40, label: 'Poor', color: designTokens.colors.mqm.poor },
      { min: 41, max: Infinity, label: 'Unacceptable', color: designTokens.colors.mqm.unacceptable }
    ]
  },

  // File type indicators
  fileTypes: {
    xliff: { color: 'hsl(213, 94%, 68%)', icon: 'FileText' },
    xlf: { color: 'hsl(142, 76%, 36%)', icon: 'FileText' },
    mxliff: { color: 'hsl(262, 83%, 58%)', icon: 'FileText' }
  }
}

// Layout breakpoints
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
}

// Z-index scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  toast: 1070
} 