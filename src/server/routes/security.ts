import { Router, Request, Response } from 'express';
import { VulnerabilityScanner } from '../../lib/services/vulnerabilityScanner';
import { PenetrationTestingEngine } from '../../lib/security/PenetrationTestingEngine';
import { ApiAuthMiddleware } from '../../lib/middleware/apiAuthMiddleware';
import { z } from 'zod';

// Type extension for authenticated requests
interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role?: string;
    authMethod: 'jwt' | 'api_key';
  };
}

const router = Router();

// Validation schemas
const ScanConfigurationSchema = z.object({
  include_dependency_scan: z.boolean().default(true),
  include_security_headers: z.boolean().default(true),
  include_api_endpoints: z.boolean().default(true),
  include_configuration: z.boolean().default(true),
  include_code_patterns: z.boolean().default(true),
  severity_threshold: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  scan_depth: z.enum(['surface', 'standard', 'deep']).default('standard'),
  exclude_patterns: z.array(z.string()).optional()
});

// Validation schema for penetration testing configuration
const PenTestConfigurationSchema = z.object({
  target_base_url: z.string().url().default('http://localhost:3000'),
  authentication_credentials: z.object({
    username: z.string(),
    password: z.string(),
    api_key: z.string().optional(),
    jwt_token: z.string().optional()
  }).optional(),
  test_categories: z.object({
    authentication: z.boolean().default(true),
    authorization: z.boolean().default(true),
    injection: z.boolean().default(true),
    session_management: z.boolean().default(true),
    api_security: z.boolean().default(true),
    file_upload: z.boolean().default(true),
    rate_limiting: z.boolean().default(true),
    business_logic: z.boolean().default(true)
  }).default({}),
  test_depth: z.enum(['passive', 'active', 'aggressive']).default('active'),
  max_test_duration_minutes: z.number().min(5).max(120).default(30),
  include_complexity_analysis: z.boolean().default(true),
  safe_mode: z.boolean().default(true),
  exclude_endpoints: z.array(z.string()).optional(),
  custom_payloads: z.record(z.array(z.string())).optional()
});

/**
 * POST /api/v1/security/scans
 * Trigger a new vulnerability scan
 */
router.post('/scans', 
  ApiAuthMiddleware.authenticate(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const configuration = ScanConfigurationSchema.parse(req.body);
      const userId = req.auth?.userId; // Now properly typed

      const scanner = VulnerabilityScanner.getInstance();
      
      // Convert Zod output to ScanConfiguration
      const scanConfig = {
        include_dependency_scan: configuration.include_dependency_scan,
        include_security_headers: configuration.include_security_headers,
        include_api_endpoints: configuration.include_api_endpoints,
        include_configuration: configuration.include_configuration,
        include_code_patterns: configuration.include_code_patterns,
        severity_threshold: configuration.severity_threshold,
        scan_depth: configuration.scan_depth,
        exclude_patterns: configuration.exclude_patterns || []
      };

      const scanResult = await scanner.performScan(scanConfig, userId);

      res.status(201).json({
        success: true,
        data: scanResult,
        message: 'Vulnerability scan completed successfully'
      });
    } catch (error) {
      console.error('Vulnerability scan error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform vulnerability scan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/v1/security/scans
 * List vulnerability scans with pagination
 */
router.get('/scans', 
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
  try {
    // This would typically query the database for scan history
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        scans: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      },
      message: 'Scans retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving scans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerability scans'
    });
  }
});

/**
 * GET /api/v1/security/scans/:scanId
 * Get specific scan details
 */
router.get('/scans/:scanId',
  ApiAuthMiddleware.authenticate(), 
  async (req: Request, res: Response) => {
  try {
    const { scanId } = req.params;
    
    // This would typically query the database for the specific scan
    // For now, return a placeholder response
    res.json({
      success: true,
      data: null,
      message: `Scan ${scanId} not found`
    });
  } catch (error) {
    console.error('Error retrieving scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerability scan'
    });
  }
});

/**
 * GET /api/v1/security/vulnerabilities
 * List vulnerabilities with filtering
 */
router.get('/vulnerabilities',
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
  try {
    const {
      severity,
      type,
      status,
      page = 1,
      limit = 20
    } = req.query;

    // This would typically query the database for vulnerabilities
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        vulnerabilities: [],
        summary: {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          open: 0,
          fixed: 0
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
          totalPages: 0
        }
      },
      message: 'Vulnerabilities retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve vulnerabilities'
    });
  }
});

/**
 * PATCH /api/v1/security/vulnerabilities/:vulnId/status
 * Update vulnerability status
 */
router.patch('/vulnerabilities/:vulnId/status',
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
  try {
    const { vulnId } = req.params;
    const { status, notes } = req.body;

    if (!['open', 'acknowledged', 'in_progress', 'fixed', 'false_positive', 'risk_accepted'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    // This would typically update the vulnerability in the database
    res.json({
      success: true,
      data: {
        vulnerability_id: vulnId,
        status,
        updated_at: new Date().toISOString()
      },
      message: 'Vulnerability status updated successfully'
    });
  } catch (error) {
    console.error('Error updating vulnerability status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vulnerability status'
    });
  }
});

/**
 * GET /api/v1/security/dashboard
 * Get security dashboard data
 */
router.get('/dashboard',
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
  try {
    // This would typically aggregate data from the database
    const dashboardData = {
      summary: {
        total_vulnerabilities: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        fixed_this_month: 0,
        avg_resolution_time: 0
      },
      recent_scans: [],
      trending: {
        vulnerability_types: [],
        severity_distribution: [],
        resolution_trends: []
      },
      top_vulnerabilities: [],
      security_score: 85
    };

    res.json({
      success: true,
      data: dashboardData,
      message: 'Dashboard data retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security dashboard data'
    });
  }
});

/**
 * POST /api/v1/security/test
 * Test endpoint for vulnerability scanning functionality
 */
router.post('/test',
  ApiAuthMiddleware.authenticate(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scanner = VulnerabilityScanner.getInstance();
      
      // Test configuration with minimal scanning
      const testConfig = {
        include_dependency_scan: false, // Disable npm audit for testing
        include_security_headers: true,
        include_api_endpoints: true,
        include_configuration: true,
        include_code_patterns: true,
        severity_threshold: 'low' as const,
        scan_depth: 'surface' as const,
        exclude_patterns: []
      };

      const result = await scanner.performScan(testConfig, req.auth?.userId);

      res.json({
        success: true,
        data: {
          scan_id: result.scan_id,
          status: result.status,
          vulnerabilities_found: result.summary.total_vulnerabilities,
          scan_duration: result.summary.scan_duration_ms,
          summary: result.summary
        },
        message: 'Test scan completed successfully'
      });
    } catch (error) {
      console.error('Test scan error:', error);
      res.status(500).json({
        success: false,
        error: 'Test scan failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/v1/security/pentests
 * Trigger a new penetration test
 */
router.post('/pentests',
  ApiAuthMiddleware.authenticate(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const configuration = PenTestConfigurationSchema.parse(req.body);
      const userId = req.auth?.userId;

      const penTestEngine = PenetrationTestingEngine.getInstance();
      
      // Convert Zod output to PenTestConfiguration
      const penTestConfig = {
        target_base_url: configuration.target_base_url,
        authentication_credentials: configuration.authentication_credentials,
        test_categories: configuration.test_categories,
        test_depth: configuration.test_depth,
        max_test_duration_minutes: configuration.max_test_duration_minutes,
        include_complexity_analysis: configuration.include_complexity_analysis,
        safe_mode: configuration.safe_mode,
        exclude_endpoints: configuration.exclude_endpoints,
        custom_payloads: configuration.custom_payloads
      };

      const penTestResult = await penTestEngine.executePenTest(penTestConfig, userId);

      res.status(201).json({
        success: true,
        data: penTestResult,
        message: 'Penetration test completed successfully'
      });
    } catch (error) {
      console.error('Penetration test error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform penetration test',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/v1/security/pentests
 * List penetration tests with pagination
 */
router.get('/pentests',
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
    try {
      // This would typically query the database for penetration test history
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          pentests: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        },
        message: 'Penetration tests retrieved successfully'
      });
    } catch (error) {
      console.error('Error retrieving penetration tests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve penetration tests'
      });
    }
  }
);

/**
 * GET /api/v1/security/pentests/:testId
 * Get specific penetration test details
 */
router.get('/pentests/:testId',
  ApiAuthMiddleware.authenticate(),
  async (req: Request, res: Response) => {
    try {
      const { testId } = req.params;
      
      // This would typically query the database for the specific test
      // For now, return a placeholder response
      res.json({
        success: true,
        data: null,
        message: `Penetration test ${testId} not found`
      });
    } catch (error) {
      console.error('Error retrieving penetration test:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve penetration test'
      });
    }
  }
);

/**
 * POST /api/v1/security/pentests/quick
 * Run a quick penetration test with default settings
 */
router.post('/pentests/quick',
  ApiAuthMiddleware.authenticate(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth?.userId;
      const penTestEngine = PenetrationTestingEngine.getInstance();
      
      // Quick test configuration with safe defaults
      const quickConfig = {
        target_base_url: 'http://localhost:3000',
        test_categories: {
          authentication: true,
          authorization: true,
          injection: true,
          session_management: false, // Skip to avoid session interference
          api_security: true,
          file_upload: false, // Skip file upload tests in quick mode
          rate_limiting: true,
          business_logic: false // Skip complex business logic tests
        },
        test_depth: 'passive' as const,
        max_test_duration_minutes: 10,
        include_complexity_analysis: false,
        safe_mode: true,
        exclude_endpoints: ['/api/v1/auth/logout'] // Avoid logout endpoint
      };

      const result = await penTestEngine.executePenTest(quickConfig, userId);

      res.json({
        success: true,
        data: {
          test_session_id: result.test_session_id,
          summary: result.summary,
          duration_ms: result.timeline.duration_ms,
          recommendations: result.recommendations.slice(0, 5) // Only top 5 recommendations
        },
        message: 'Quick penetration test completed successfully'
      });
    } catch (error) {
      console.error('Quick penetration test error:', error);
      res.status(500).json({
        success: false,
        error: 'Quick penetration test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as securityRouter }; 