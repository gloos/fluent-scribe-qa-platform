import { ApiVersionConfig } from '../middleware/apiVersionMiddleware';

/**
 * API Versioning Configuration
 * 
 * This file defines the versioning strategy, supported versions,
 * deprecation policies, and migration paths for the API.
 */

export interface VersionDeprecationPolicy {
  /** Warning period before deprecation (in days) */
  warningPeriod: number;
  /** Grace period after deprecation before sunset (in days) */
  gracePeriod: number;
  /** Minimum support period for major versions (in days) */
  minimumSupportPeriod: number;
}

export interface VersionMigrationPath {
  fromVersion: string;
  toVersion: string;
  /** URL to migration guide documentation */
  migrationGuideUrl: string;
  /** List of breaking changes */
  breakingChanges: string[];
  /** Automated migration tools available */
  automationAvailable: boolean;
}

export class ApiVersionConfiguration {
  /**
   * Current versioning strategy configuration
   */
  static readonly VERSIONING_STRATEGY = {
    /** Version format: Major.Minor.Patch */
    format: 'semantic',
    /** How versions are specified in URLs */
    urlFormat: '/api/v{major}',
    /** Default version when none specified */
    defaultVersion: '1.0.0',
    /** Latest available version */
    latestVersion: '1.0.0',
    /** Whether to allow version negotiation via headers */
    allowHeaderNegotiation: false,
    /** Whether to automatically redirect to latest when no version specified */
    autoRedirectToLatest: false
  };

  /**
   * Deprecation and sunset policies
   */
  static readonly DEPRECATION_POLICY: VersionDeprecationPolicy = {
    warningPeriod: 90,    // 3 months warning before deprecation
    gracePeriod: 365,     // 1 year grace period after deprecation
    minimumSupportPeriod: 730  // 2 years minimum support for major versions
  };

  /**
   * Currently supported API versions
   */
  static readonly SUPPORTED_VERSIONS: ApiVersionConfig[] = [
    {
      version: '1.0.0',
      status: 'supported'
    }
  ];

  /**
   * Planned future versions and their expected release dates
   */
  static readonly PLANNED_VERSIONS = [
    {
      version: '2.0.0',
      plannedReleaseDate: new Date('2025-03-01'),
      majorChanges: [
        'Restructured authentication flow',
        'New batch processing endpoints',
        'Enhanced error response format',
        'Improved rate limiting granularity'
      ]
    }
  ];

  /**
   * Migration paths between versions
   */
  static readonly MIGRATION_PATHS: VersionMigrationPath[] = [
    // Placeholder for future migrations
    // {
    //   fromVersion: '1.0.0',
    //   toVersion: '2.0.0',
    //   migrationGuideUrl: 'https://docs.qa-platform.com/migration/v1-to-v2',
    //   breakingChanges: [
    //     'Authentication endpoints moved to /auth namespace',
    //     'Error response format changed',
    //     'Rate limiting headers renamed'
    //   ],
    //   automationAvailable: true
    // }
  ];

  /**
   * Endpoints that are version-specific or have different behavior across versions
   */
  static readonly VERSION_SPECIFIC_ENDPOINTS = {
    'v1': {
      deprecated: [
        // Future deprecated endpoints will be listed here
      ],
      added: [
        '/health',
        '/auth/login',
        '/auth/logout',
        '/files',
        '/assessments',
        '/batches',
        '/webhooks'
      ]
    }
  };

  /**
   * Get the complete version configuration
   */
  static getConfiguration() {
    return {
      strategy: this.VERSIONING_STRATEGY,
      policy: this.DEPRECATION_POLICY,
      supported: this.SUPPORTED_VERSIONS,
      planned: this.PLANNED_VERSIONS,
      migrations: this.MIGRATION_PATHS,
      endpoints: this.VERSION_SPECIFIC_ENDPOINTS
    };
  }

  /**
   * Check if a version is currently supported
   */
  static isVersionSupported(version: string): boolean {
    return this.SUPPORTED_VERSIONS.some(v => v.version === version && v.status !== 'sunset');
  }

  /**
   * Get deprecation information for a version
   */
  static getDeprecationInfo(version: string): ApiVersionConfig | null {
    return this.SUPPORTED_VERSIONS.find(v => v.version === version) || null;
  }

  /**
   * Calculate deprecation dates based on policy
   */
  static calculateDeprecationDates(releaseDate: Date): {
    warningDate: Date;
    deprecationDate: Date;
    sunsetDate: Date;
  } {
    const warning = new Date(releaseDate);
    warning.setDate(warning.getDate() + this.DEPRECATION_POLICY.warningPeriod);

    const deprecation = new Date(warning);
    deprecation.setDate(deprecation.getDate() + this.DEPRECATION_POLICY.warningPeriod);

    const sunset = new Date(deprecation);
    sunset.setDate(sunset.getDate() + this.DEPRECATION_POLICY.gracePeriod);

    return {
      warningDate: warning,
      deprecationDate: deprecation,
      sunsetDate: sunset
    };
  }

  /**
   * Get migration path between two versions
   */
  static getMigrationPath(fromVersion: string, toVersion: string): VersionMigrationPath | null {
    return this.MIGRATION_PATHS.find(
      path => path.fromVersion === fromVersion && path.toVersion === toVersion
    ) || null;
  }

  /**
   * Get all available migration paths for a version
   */
  static getAvailableMigrations(fromVersion: string): VersionMigrationPath[] {
    return this.MIGRATION_PATHS.filter(path => path.fromVersion === fromVersion);
  }
} 