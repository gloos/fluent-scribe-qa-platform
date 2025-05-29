export class SecurityHeaders {
  /**
   * Security Headers Management
   */
  public static setSecurityHeaders(): void {
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');

    // Apply security headers if running in browser environment
    if (typeof document !== 'undefined') {
      // Create meta tags for CSP (fallback for dev environment)
      const createMetaTag = (name: string, content: string) => {
        const existing = document.querySelector(`meta[http-equiv="${name}"]`);
        if (existing) {
          existing.setAttribute('content', content);
        } else {
          const meta = document.createElement('meta');
          meta.setAttribute('http-equiv', name);
          meta.setAttribute('content', content);
          document.head.appendChild(meta);
        }
      };

      createMetaTag('Content-Security-Policy', csp);
      createMetaTag('X-Content-Type-Options', 'nosniff');
      createMetaTag('X-Frame-Options', 'DENY');
      createMetaTag('X-XSS-Protection', '1; mode=block');
      createMetaTag('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Note: HSTS headers can only be set by server, not client-side
      console.log('🔒 Security headers configured for client-side');
    }
  }

  /**
   * Get recommended security headers for server configuration
   */
  public static getRecommendedHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
        "media-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }

  /**
   * Validate current page security headers
   */
  public static validateCurrentHeaders(): {
    hasCSP: boolean;
    hasXFrameOptions: boolean;
    hasXContentTypeOptions: boolean;
    hasReferrerPolicy: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let hasCSP = false;
    let hasXFrameOptions = false;
    let hasXContentTypeOptions = false;
    let hasReferrerPolicy = false;

    if (typeof document !== 'undefined') {
      // Check for existing meta tags
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      const xFrameMeta = document.querySelector('meta[http-equiv="X-Frame-Options"]');
      const xContentTypeMeta = document.querySelector('meta[http-equiv="X-Content-Type-Options"]');
      const referrerMeta = document.querySelector('meta[http-equiv="Referrer-Policy"]');

      hasCSP = !!cspMeta;
      hasXFrameOptions = !!xFrameMeta;
      hasXContentTypeOptions = !!xContentTypeMeta;
      hasReferrerPolicy = !!referrerMeta;

      if (!hasCSP) {
        recommendations.push('Add Content-Security-Policy header to prevent XSS attacks');
      }
      if (!hasXFrameOptions) {
        recommendations.push('Add X-Frame-Options header to prevent clickjacking');
      }
      if (!hasXContentTypeOptions) {
        recommendations.push('Add X-Content-Type-Options header to prevent MIME sniffing');
      }
      if (!hasReferrerPolicy) {
        recommendations.push('Add Referrer-Policy header to control referrer information');
      }

      // Check if HTTPS is being used
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        recommendations.push('Use HTTPS to encrypt data in transit');
      }
    }

    return {
      hasCSP,
      hasXFrameOptions,
      hasXContentTypeOptions,
      hasReferrerPolicy,
      recommendations
    };
  }

  /**
   * Generate a custom CSP based on requirements
   */
  public static generateCustomCSP(options: {
    allowInlineScripts?: boolean;
    allowInlineStyles?: boolean;
    allowEval?: boolean;
    additionalScriptSources?: string[];
    additionalStyleSources?: string[];
    additionalConnectSources?: string[];
  }): string {
    const {
      allowInlineScripts = false,
      allowInlineStyles = false,
      allowEval = false,
      additionalScriptSources = [],
      additionalStyleSources = [],
      additionalConnectSources = []
    } = options;

    const directives = [];

    // Default source
    directives.push("default-src 'self'");

    // Script source
    let scriptSrc = "'self'";
    if (allowInlineScripts) scriptSrc += " 'unsafe-inline'";
    if (allowEval) scriptSrc += " 'unsafe-eval'";
    if (additionalScriptSources.length > 0) {
      scriptSrc += " " + additionalScriptSources.join(" ");
    }
    directives.push(`script-src ${scriptSrc}`);

    // Style source
    let styleSrc = "'self'";
    if (allowInlineStyles) styleSrc += " 'unsafe-inline'";
    if (additionalStyleSources.length > 0) {
      styleSrc += " " + additionalStyleSources.join(" ");
    }
    directives.push(`style-src ${styleSrc}`);

    // Connect source
    let connectSrc = "'self'";
    if (additionalConnectSources.length > 0) {
      connectSrc += " " + additionalConnectSources.join(" ");
    }
    directives.push(`connect-src ${connectSrc}`);

    // Other common directives
    directives.push("img-src 'self' data: https: blob:");
    directives.push("font-src 'self'");
    directives.push("object-src 'none'");
    directives.push("base-uri 'self'");
    directives.push("form-action 'self'");
    directives.push("frame-ancestors 'none'");

    return directives.join('; ');
  }
} 