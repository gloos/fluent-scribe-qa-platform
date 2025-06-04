import { vi, beforeEach, afterEach } from 'vitest';
import type { VulnerabilityResult, ScanConfiguration, ScanResult } from '../../lib/services/vulnerabilityScanner';
import type { PenTestConfiguration, PenTestResult } from '../../lib/security/PenetrationTestingEngine';

// Global test utilities for security testing
export const testUtils = {
  // Mock data for vulnerability scanning
  mockVulnerabilities: [] as VulnerabilityResult[],
  mockScanResult: {} as ScanResult,
  mockPenTestResults: [] as PenTestResult[],
  
  // Mock state management
  setMockVulnerabilities: (vulnerabilities: VulnerabilityResult[]) => {
    testUtils.mockVulnerabilities = vulnerabilities;
  },
  
  setMockScanResult: (result: ScanResult) => {
    testUtils.mockScanResult = result;
  },
  
  setMockPenTestResults: (results: PenTestResult[]) => {
    testUtils.mockPenTestResults = results;
  },
  
  clearMockData: () => {
    testUtils.mockVulnerabilities = [];
    testUtils.mockScanResult = {} as ScanResult;
    testUtils.mockPenTestResults = [];
  }
};

// Mock VulnerabilityScanner
export const mockVulnerabilityScanner = {
  getInstance: vi.fn(() => mockVulnerabilityScanner),
  performScan: vi.fn(async (config: ScanConfiguration, userId?: string) => {
    const scanId = `test_scan_${Date.now()}`;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 5000); // 5 second scan
    
    return {
      scan_id: scanId,
      scan_type: 'manual' as const,
      configuration: config,
      vulnerabilities: testUtils.mockVulnerabilities,
      summary: {
        total_vulnerabilities: testUtils.mockVulnerabilities.length,
        critical_count: testUtils.mockVulnerabilities.filter(v => v.severity === 'critical').length,
        high_count: testUtils.mockVulnerabilities.filter(v => v.severity === 'high').length,
        medium_count: testUtils.mockVulnerabilities.filter(v => v.severity === 'medium').length,
        low_count: testUtils.mockVulnerabilities.filter(v => v.severity === 'low').length,
        scan_duration_ms: 5000,
        scan_coverage: 85
      },
      started_at: startTime,
      completed_at: endTime,
      status: 'completed' as const,
      metadata: {
        scanner_version: '1.0.0',
        target_environment: 'development' as const,
        scanned_components: config.include_dependency_scan ? ['dependencies'] : []
      }
    };
  })
};

// Mock PenetrationTestingEngine
export const mockPenetrationTestingEngine = {
  getInstance: vi.fn(() => mockPenetrationTestingEngine),
  executePenTest: vi.fn(async (config: PenTestConfiguration) => {
    const testId = `test_pentest_${Date.now()}`;
    return {
      test_session_id: testId,
      configuration: config,
      test_results: testUtils.mockPenTestResults,
      summary: {
        total_tests_run: testUtils.mockPenTestResults.length,
        total_vulnerabilities: testUtils.mockPenTestResults.length,
        critical_count: testUtils.mockPenTestResults.filter(r => r.severity === 'critical').length,
        high_count: testUtils.mockPenTestResults.filter(r => r.severity === 'high').length,
        medium_count: testUtils.mockPenTestResults.filter(r => r.severity === 'medium').length,
        low_count: testUtils.mockPenTestResults.filter(r => r.severity === 'low').length,
        info_count: testUtils.mockPenTestResults.filter(r => r.severity === 'info').length,
        overall_risk_score: 5.0,
        test_coverage_percentage: 85
      },
      timeline: {
        started_at: new Date(),
        completed_at: new Date(),
        duration_ms: 10000
      },
      target_information: {
        endpoints_discovered: ['/api/auth/login', '/api/users'],
        technologies_detected: ['Express.js', 'PostgreSQL'],
        security_measures_identified: ['Rate Limiting', 'CORS']
      },
      recommendations: [],
      metadata: {
        engine_version: '1.0.0',
        test_environment: 'development' as const
      }
    };
  })
};

// Mock SecurityLogger
export const mockSecurityLogger = {
  logSecurityEvent: vi.fn(async (event: any) => {
    return { success: true, eventId: `event_${Date.now()}` };
  }),
  logAuthenticationAttempt: vi.fn(),
  logSuspiciousActivity: vi.fn(),
  logPasswordReset: vi.fn(),
  logSessionEvent: vi.fn()
};

// Mock AuditLogger
export const mockAuditLogger = {
  getInstance: vi.fn(() => mockAuditLogger),
  logEvent: vi.fn(async (event: any) => {
    return { success: true, eventId: `audit_${Date.now()}` };
  })
};

// Mock filesystem operations
export const mockFs = {
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ isDirectory: () => false, isFile: () => true }))
};

// Mock child_process for security scanning
export const mockChildProcess = {
  execSync: vi.fn(() => JSON.stringify({
    vulnerabilities: testUtils.mockVulnerabilities
  }))
};

// Mock fetch for API testing
export const mockFetch = vi.fn(async (url: string, options?: any) => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }),
    text: vi.fn(async () => 'Mock response'),
    json: vi.fn(async () => ({ success: true, data: 'mock data' }))
  };
});

// Security test data generators
export const createMockVulnerability = (overrides: Partial<VulnerabilityResult> = {}): VulnerabilityResult => ({
  id: `vuln_${Date.now()}`,
  type: 'dependency',
  severity: 'medium',
  title: 'Test Vulnerability',
  description: 'A test vulnerability for security testing',
  location: '/path/to/vulnerable/code',
  recommendations: ['Update the dependency', 'Apply security patch'],
  remediation_effort: 'medium',
  detected_at: new Date(),
  status: 'open',
  ...overrides
});

export const createMockPenTestResult = (overrides: Partial<PenTestResult> = {}): PenTestResult => ({
  test_id: `pentest_${Date.now()}`,
  test_type: 'authentication',
  severity: 'medium',
  title: 'Test Authentication Security',
  description: 'Testing authentication security',
  attack_vector: 'Credential testing',
  evidence: ['Authentication test executed'],
  exploitation_difficulty: 'medium',
  business_impact: 'medium',
  remediation: {
    immediate_actions: ['Review authentication'],
    long_term_fixes: ['Implement MFA'],
    code_changes: ['Add validation'],
    configuration_changes: ['Update settings']
  },
  detected_at: new Date(),
  test_duration_ms: 1000,
  complexity_factors: ['Authentication system'],
  ...overrides
});

// Setup global mocks
export const setupSecurityTestMocks = () => {
  // Mock modules
  vi.mock('../../lib/services/vulnerabilityScanner', () => ({
    VulnerabilityScanner: mockVulnerabilityScanner
  }));
  
  vi.mock('../../lib/security/PenetrationTestingEngine', () => ({
    PenetrationTestingEngine: mockPenetrationTestingEngine
  }));
  
  vi.mock('../../lib/security/SecurityLogger', () => ({
    SecurityLogger: vi.fn(() => mockSecurityLogger)
  }));
  
  vi.mock('../../lib/security/AuditLogger', () => ({
    AuditLogger: mockAuditLogger
  }));
  
  vi.mock('fs', () => mockFs);
  vi.mock('child_process', () => mockChildProcess);
  
  // Mock global fetch
  global.fetch = mockFetch as any;
};

// Cleanup function for tests
export const cleanupSecurityTests = () => {
  vi.clearAllMocks();
  testUtils.clearMockData();
};

// Test environment setup
beforeEach(() => {
  setupSecurityTestMocks();
});

afterEach(() => {
  cleanupSecurityTests();
}); 