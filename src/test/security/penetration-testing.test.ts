import { describe, test, expect, beforeEach } from 'vitest';
import { PenetrationTestingEngine } from '../../lib/security/PenetrationTestingEngine';
import type { PenTestConfiguration, PenTestResult } from '../../lib/security/PenetrationTestingEngine';
import { testUtils, createMockPenTestResult } from './security-test-setup';

describe('Penetration Testing Tests', () => {
  let penTestEngine: PenetrationTestingEngine;

  beforeEach(() => {
    penTestEngine = PenetrationTestingEngine.getInstance();
    testUtils.clearMockData();
  });

  describe('Basic Penetration Testing', () => {
    test('should execute a complete penetration test with default configuration', async () => {
      // Setup mock test results
      const mockResults = [
        createMockPenTestResult({ 
          test_type: 'authentication', 
          severity: 'high',
          title: 'Weak Password Policy',
          description: 'Password policy allows weak passwords'
        }),
        createMockPenTestResult({ 
          test_type: 'injection', 
          severity: 'critical',
          title: 'SQL Injection Vulnerability',
          description: 'SQL injection found in user input'
        }),
        createMockPenTestResult({ 
          test_type: 'authorization', 
          severity: 'medium',
          title: 'Privilege Escalation Risk',
          description: 'User can access unauthorized resources'
        })
      ];
      testUtils.setMockPenTestResults(mockResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: true,
          injection: true,
          session_management: true,
          api_security: true,
          file_upload: true,
          rate_limiting: true,
          business_logic: true
        },
        test_depth: 'active',
        max_test_duration_minutes: 30,
        include_complexity_analysis: true,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config, 'security-tester');

      expect(result).toBeDefined();
      expect(result.test_session_id).toMatch(/^test_pentest_\d+$/);
      expect(result.configuration).toEqual(config);
      expect(result.test_results).toHaveLength(3);
      expect(result.summary.total_tests_run).toBe(3);
      expect(result.summary.total_vulnerabilities).toBe(3);
      expect(result.summary.critical_count).toBe(1);
      expect(result.summary.high_count).toBe(1);
      expect(result.summary.medium_count).toBe(1);
    });

    test('should handle empty test results', async () => {
      testUtils.setMockPenTestResults([]);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'passive',
        max_test_duration_minutes: 10,
        include_complexity_analysis: false,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(0);
      expect(result.summary.total_vulnerabilities).toBe(0);
      expect(result.summary.critical_count).toBe(0);
      expect(result.target_information).toBeDefined();
    });
  });

  describe('Authentication Testing', () => {
    test('should detect authentication vulnerabilities', async () => {
      const authResults = [
        createMockPenTestResult({
          test_type: 'authentication',
          severity: 'critical',
          title: 'Default Credentials Accepted',
          description: 'System accepts default username/password combinations',
          attack_vector: 'Credential testing with common defaults',
          evidence: ['admin/admin login successful', 'No account lockout implemented'],
          remediation: {
            immediate_actions: ['Change default passwords', 'Implement account lockout'],
            long_term_fixes: ['Enforce strong password policy', 'Implement MFA'],
            code_changes: ['Add password validation', 'Add lockout mechanism'],
            configuration_changes: ['Configure password requirements', 'Set lockout thresholds']
          }
        }),
        createMockPenTestResult({
          test_type: 'authentication',
          severity: 'high',
          title: 'Brute Force Attack Possible',
          description: 'No rate limiting on authentication attempts',
          attack_vector: 'Automated brute force attack',
          evidence: ['1000 login attempts completed without lockout'],
          exploitation_difficulty: 'easy'
        })
      ];
      testUtils.setMockPenTestResults(authResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 15,
        include_complexity_analysis: false,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'authentication')).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Default Credentials'))).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Brute Force'))).toBe(true);
      expect(result.test_results.some(r => r.exploitation_difficulty === 'easy')).toBe(true);
    });

    test('should provide detailed remediation for authentication issues', async () => {
      const authResult = createMockPenTestResult({
        test_type: 'authentication',
        severity: 'high',
        remediation: {
          immediate_actions: ['Implement rate limiting', 'Add CAPTCHA after failed attempts'],
          long_term_fixes: ['Deploy multi-factor authentication', 'Implement behavioral analysis'],
          code_changes: ['Add rate limiting middleware', 'Implement CAPTCHA integration'],
          configuration_changes: ['Configure rate limits', 'Enable security headers']
        }
      });
      testUtils.setMockPenTestResults([authResult]);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 10,
        include_complexity_analysis: false,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      const testResult = result.test_results[0];
      expect(testResult.remediation.immediate_actions).toContain('Implement rate limiting');
      expect(testResult.remediation.long_term_fixes).toContain('Deploy multi-factor authentication');
      expect(testResult.remediation.code_changes).toContain('Add rate limiting middleware');
      expect(testResult.remediation.configuration_changes).toContain('Configure rate limits');
    });
  });

  describe('Injection Testing', () => {
    test('should detect SQL injection vulnerabilities', async () => {
      const injectionResults = [
        createMockPenTestResult({
          test_type: 'injection',
          severity: 'critical',
          title: 'SQL Injection in User Search',
          description: 'SQL injection vulnerability found in search parameter',
          attack_vector: 'Input parameter manipulation',
          payload_used: "' OR '1'='1' --",
          evidence: ['Database error messages revealed', 'Unauthorized data access confirmed'],
          cwe_id: 'CWE-89',
          cvss_score: 9.8,
          business_impact: 'high'
        }),
        createMockPenTestResult({
          test_type: 'injection',
          severity: 'high',
          title: 'NoSQL Injection Detected',
          description: 'NoSQL injection in MongoDB query',
          attack_vector: 'JSON parameter manipulation',
          payload_used: '{"$ne": null}',
          evidence: ['Unexpected query results', 'Data bypass confirmed']
        })
      ];
      testUtils.setMockPenTestResults(injectionResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: true,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'aggressive',
        max_test_duration_minutes: 20,
        include_complexity_analysis: true,
        safe_mode: false
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'injection')).toBe(true);
      expect(result.test_results.some(r => r.cwe_id === 'CWE-89')).toBe(true);
      expect(result.test_results.some(r => r.cvss_score === 9.8)).toBe(true);
      expect(result.test_results.some(r => r.payload_used?.includes("OR '1'='1'"))).toBe(true);
    });
  });

  describe('Authorization Testing', () => {
    test('should detect authorization bypass vulnerabilities', async () => {
      const authzResults = [
        createMockPenTestResult({
          test_type: 'authorization',
          severity: 'high',
          title: 'Vertical Privilege Escalation',
          description: 'Regular user can access admin functions',
          attack_vector: 'Direct URL access to admin endpoints',
          evidence: ['Admin panel accessible without admin role', 'User management functions available'],
          business_impact: 'high',
          exploitation_difficulty: 'easy'
        }),
        createMockPenTestResult({
          test_type: 'authorization',
          severity: 'medium',
          title: 'Horizontal Privilege Escalation',
          description: 'Users can access other users\' data',
          attack_vector: 'Parameter manipulation',
          evidence: ['User ID parameter manipulation successful', 'Access to unauthorized user profiles']
        })
      ];
      testUtils.setMockPenTestResults(authzResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        authentication_credentials: {
          username: 'testuser',
          password: 'testpass',
          jwt_token: 'test-jwt-token'
        },
        test_categories: {
          authentication: false,
          authorization: true,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 15,
        include_complexity_analysis: true,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'authorization')).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Vertical Privilege'))).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Horizontal Privilege'))).toBe(true);
      expect(result.test_results.some(r => r.exploitation_difficulty === 'easy')).toBe(true);
    });
  });

  describe('Session Management Testing', () => {
    test('should detect session security issues', async () => {
      const sessionResults = [
        createMockPenTestResult({
          test_type: 'session',
          severity: 'medium',
          title: 'Session Fixation Vulnerability',
          description: 'Session ID not regenerated after login',
          attack_vector: 'Session fixation attack',
          evidence: ['Same session ID before and after login', 'Session hijacking possible'],
          cwe_id: 'CWE-384'
        }),
        createMockPenTestResult({
          test_type: 'session',
          severity: 'high',
          title: 'Weak Session Token',
          description: 'Session tokens are predictable',
          attack_vector: 'Session token analysis',
          evidence: ['Pattern found in session IDs', 'Tokens can be predicted']
        })
      ];
      testUtils.setMockPenTestResults(sessionResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: false,
          session_management: true,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 10,
        include_complexity_analysis: false,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'session')).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Session Fixation'))).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Weak Session Token'))).toBe(true);
      expect(result.test_results.some(r => r.cwe_id === 'CWE-384')).toBe(true);
    });
  });

  describe('API Security Testing', () => {
    test('should detect API security vulnerabilities', async () => {
      const apiResults = [
        createMockPenTestResult({
          test_type: 'api',
          severity: 'high',
          title: 'API Rate Limiting Bypass',
          description: 'API rate limits can be bypassed',
          attack_vector: 'Header manipulation',
          evidence: ['X-Forwarded-For bypass successful', 'Rate limits not enforced'],
          owasp_category: 'API4:2023'
        }),
        createMockPenTestResult({
          test_type: 'api',
          severity: 'medium',
          title: 'Excessive Data Exposure',
          description: 'API returns more data than necessary',
          attack_vector: 'Data enumeration',
          evidence: ['Full user objects returned', 'Sensitive fields exposed']
        })
      ];
      testUtils.setMockPenTestResults(apiResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: true,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 25,
        include_complexity_analysis: true,
        safe_mode: true,
        exclude_endpoints: ['/api/health', '/api/status']
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'api')).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Rate Limiting Bypass'))).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Excessive Data Exposure'))).toBe(true);
      expect(result.test_results.some(r => r.owasp_category === 'API4:2023')).toBe(true);
    });
  });

  describe('File Upload Security Testing', () => {
    test('should detect file upload vulnerabilities', async () => {
      const fileUploadResults = [
        createMockPenTestResult({
          test_type: 'file_upload',
          severity: 'critical',
          title: 'Malicious File Upload',
          description: 'Server accepts executable files',
          attack_vector: 'File extension bypass',
          evidence: ['PHP file uploaded successfully', 'File execution confirmed'],
          business_impact: 'high',
          exploitation_difficulty: 'medium'
        })
      ];
      testUtils.setMockPenTestResults(fileUploadResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: true,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'aggressive',
        max_test_duration_minutes: 15,
        include_complexity_analysis: false,
        safe_mode: false
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(1);
      expect(result.test_results[0].test_type).toBe('file_upload');
      expect(result.test_results[0].severity).toBe('critical');
      expect(result.test_results[0].title.includes('Malicious File Upload')).toBe(true);
    });
  });

  describe('Business Logic Testing', () => {
    test('should detect business logic flaws', async () => {
      const businessLogicResults = [
        createMockPenTestResult({
          test_type: 'business_logic',
          severity: 'high',
          title: 'Price Manipulation Vulnerability',
          description: 'Product prices can be manipulated during checkout',
          attack_vector: 'Parameter tampering',
          evidence: ['Price parameter manipulation successful', 'Negative prices accepted'],
          business_impact: 'high'
        }),
        createMockPenTestResult({
          test_type: 'business_logic',
          severity: 'medium',
          title: 'Workflow Bypass',
          description: 'Required workflow steps can be skipped',
          attack_vector: 'Direct endpoint access',
          evidence: ['Payment step bypassed', 'Order completed without payment']
        })
      ];
      testUtils.setMockPenTestResults(businessLogicResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: false,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: true
        },
        test_depth: 'active',
        max_test_duration_minutes: 30,
        include_complexity_analysis: true,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results).toHaveLength(2);
      expect(result.test_results.every(r => r.test_type === 'business_logic')).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Price Manipulation'))).toBe(true);
      expect(result.test_results.some(r => r.title.includes('Workflow Bypass'))).toBe(true);
    });
  });

  describe('Test Report Generation', () => {
    test('should generate comprehensive test reports', async () => {
      const mixedResults = [
        createMockPenTestResult({ test_type: 'authentication', severity: 'critical' }),
        createMockPenTestResult({ test_type: 'injection', severity: 'high' }),
        createMockPenTestResult({ test_type: 'authorization', severity: 'medium' }),
        createMockPenTestResult({ test_type: 'session', severity: 'low' }),
        createMockPenTestResult({ test_type: 'api', severity: 'info' })
      ];
      testUtils.setMockPenTestResults(mixedResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: true,
          injection: true,
          session_management: true,
          api_security: true,
          file_upload: true,
          rate_limiting: true,
          business_logic: true
        },
        test_depth: 'active',
        max_test_duration_minutes: 60,
        include_complexity_analysis: true,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      // Verify report structure
      expect(result.summary.total_tests_run).toBe(5);
      expect(result.summary.total_vulnerabilities).toBe(5);
      expect(result.summary.critical_count).toBe(1);
      expect(result.summary.high_count).toBe(1);
      expect(result.summary.medium_count).toBe(1);
      expect(result.summary.low_count).toBe(1);
      expect(result.summary.info_count).toBe(1);
      expect(result.summary.overall_risk_score).toBe(5.0);
      expect(result.summary.test_coverage_percentage).toBe(85);

      // Verify timeline
      expect(result.timeline.started_at).toBeInstanceOf(Date);
      expect(result.timeline.completed_at).toBeInstanceOf(Date);
      expect(result.timeline.duration_ms).toBe(10000);

      // Verify target information
      expect(result.target_information.endpoints_discovered).toContain('/api/auth/login');
      expect(result.target_information.endpoints_discovered).toContain('/api/users');
      expect(result.target_information.technologies_detected).toContain('Express.js');
      expect(result.target_information.security_measures_identified).toContain('Rate Limiting');

      // Verify metadata
      expect(result.metadata.engine_version).toBe('1.0.0');
      expect(result.metadata.test_environment).toBe('development');
    });

    test('should handle custom payloads configuration', async () => {
      const customResults = [
        createMockPenTestResult({
          test_type: 'injection',
          severity: 'high',
          payload_used: 'CUSTOM_XSS_PAYLOAD',
          evidence: ['Custom XSS payload executed successfully']
        })
      ];
      testUtils.setMockPenTestResults(customResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: true,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'active',
        max_test_duration_minutes: 15,
        include_complexity_analysis: false,
        safe_mode: true,
        custom_payloads: {
          xss: ['<script>alert("custom")</script>', 'CUSTOM_XSS_PAYLOAD'],
          sql: ['UNION SELECT * FROM users', '\' OR 1=1 --']
        }
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.test_results[0].payload_used).toBe('CUSTOM_XSS_PAYLOAD');
      expect(result.test_results[0].evidence).toContain('Custom XSS payload executed successfully');
    });
  });

  describe('Safe Mode and Security Controls', () => {
    test('should respect safe mode configuration', async () => {
      const safeResults = [
        createMockPenTestResult({
          test_type: 'injection',
          severity: 'medium',
          title: 'Potential SQL Injection (Safe Mode)',
          description: 'SQL injection detected but not exploited in safe mode'
        })
      ];
      testUtils.setMockPenTestResults(safeResults);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: false,
          authorization: false,
          injection: true,
          session_management: false,
          api_security: false,
          file_upload: false,
          rate_limiting: false,
          business_logic: false
        },
        test_depth: 'passive',
        max_test_duration_minutes: 10,
        include_complexity_analysis: false,
        safe_mode: true
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.configuration.safe_mode).toBe(true);
      expect(result.test_results[0].title).toContain('Safe Mode');
    });

    test('should handle excluded endpoints configuration', async () => {
      testUtils.setMockPenTestResults([]);

      const config: PenTestConfiguration = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: true,
          injection: true,
          session_management: true,
          api_security: true,
          file_upload: true,
          rate_limiting: true,
          business_logic: true
        },
        test_depth: 'active',
        max_test_duration_minutes: 20,
        include_complexity_analysis: false,
        safe_mode: true,
        exclude_endpoints: [
          '/api/health',
          '/api/status',
          '/api/admin/dangerous-endpoint'
        ]
      };

      const result = await penTestEngine.executePenTest(config);

      expect(result.configuration.exclude_endpoints).toHaveLength(3);
      expect(result.configuration.exclude_endpoints).toContain('/api/admin/dangerous-endpoint');
    });
  });
}); 