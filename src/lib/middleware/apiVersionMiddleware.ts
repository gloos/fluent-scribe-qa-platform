import { Request, Response, NextFunction } from 'express';

export interface VersionedRequest extends Request {
  apiVersion: {
    major: number;
    minor: number;
    patch: number;
    full: string;
    isLatest: boolean;
    isDeprecated: boolean;
    deprecationDate?: Date;
    sunsetDate?: Date;
  };
}

export interface ApiVersionConfig {
  version: string;
  status: 'supported' | 'deprecated' | 'sunset';
  deprecationDate?: Date;
  sunsetDate?: Date;
  migrationGuide?: string;
}

export class ApiVersionMiddleware {
  private static supportedVersions: Map<string, ApiVersionConfig> = new Map([
    ['1.0.0', {
      version: '1.0.0',
      status: 'supported'
    }],
    ['2.0.0', {
      version: '2.0.0',
      status: 'supported'
    }]
  ]);

  private static latestVersion = '2.0.0';
  private static defaultVersion = '1.0.0';

  /**
   * Extract and validate API version from URL path
   */
  static extractVersion(req: Request, res: Response, next: NextFunction): void {
    const versionedReq = req as VersionedRequest;
    
    // Extract version from URL path like /api/v1/... or /api/v2.1/...
    const versionMatch = req.path.match(/^\/api\/v(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    
    let version: string;
    let major: number;
    let minor: number = 0;
    let patch: number = 0;

    if (versionMatch) {
      major = parseInt(versionMatch[1], 10);
      minor = parseInt(versionMatch[2] || '0', 10);
      patch = parseInt(versionMatch[3] || '0', 10);
      version = `${major}.${minor}.${patch}`;
    } else {
      // Fallback to default version if no version specified
      const defaultConfig = ApiVersionMiddleware.parseVersion(ApiVersionMiddleware.defaultVersion);
      major = defaultConfig.major;
      minor = defaultConfig.minor;
      patch = defaultConfig.patch;
      version = ApiVersionMiddleware.defaultVersion;
    }

    // Find the best matching supported version
    const supportedVersion = ApiVersionMiddleware.findBestMatchingVersion(major, minor, patch);
    
    if (!supportedVersion) {
      res.status(400).json({
        error: 'Unsupported API version',
        message: `API version v${major}.${minor}.${patch} is not supported`,
        supportedVersions: Array.from(ApiVersionMiddleware.supportedVersions.keys()),
        latestVersion: ApiVersionMiddleware.latestVersion
      });
      return;
    }

    const versionConfig = ApiVersionMiddleware.supportedVersions.get(supportedVersion)!;
    
    // Attach version information to request
    versionedReq.apiVersion = {
      major,
      minor,
      patch,
      full: supportedVersion,
      isLatest: supportedVersion === ApiVersionMiddleware.latestVersion,
      isDeprecated: versionConfig.status === 'deprecated',
      deprecationDate: versionConfig.deprecationDate,
      sunsetDate: versionConfig.sunsetDate
    };

    // Add deprecation warnings to response headers
    if (versionConfig.status === 'deprecated') {
      res.set('X-API-Deprecated', 'true');
      if (versionConfig.deprecationDate) {
        res.set('X-API-Deprecation-Date', versionConfig.deprecationDate.toISOString());
      }
      if (versionConfig.sunsetDate) {
        res.set('X-API-Sunset-Date', versionConfig.sunsetDate.toISOString());
      }
      if (versionConfig.migrationGuide) {
        res.set('X-API-Migration-Guide', versionConfig.migrationGuide);
      }
    }

    // Add current version to response headers
    res.set('X-API-Version', supportedVersion);
    res.set('X-API-Latest-Version', ApiVersionMiddleware.latestVersion);

    next();
  }

  /**
   * Find the best matching supported version for a given version request
   */
  private static findBestMatchingVersion(major: number, minor: number, patch: number): string | null {
    const requestedVersion = `${major}.${minor}.${patch}`;
    
    // First, try exact match
    if (ApiVersionMiddleware.supportedVersions.has(requestedVersion)) {
      return requestedVersion;
    }

    // Find highest compatible version within the same major version
    const compatibleVersions = Array.from(ApiVersionMiddleware.supportedVersions.keys())
      .filter(version => {
        const parsed = ApiVersionMiddleware.parseVersion(version);
        return parsed.major === major && 
               (parsed.minor > minor || (parsed.minor === minor && parsed.patch >= patch));
      })
      .sort((a, b) => {
        const aVer = ApiVersionMiddleware.parseVersion(a);
        const bVer = ApiVersionMiddleware.parseVersion(b);
        if (aVer.minor !== bVer.minor) return aVer.minor - bVer.minor;
        return aVer.patch - bVer.patch;
      });

    return compatibleVersions[0] || null;
  }

  /**
   * Parse version string into components
   */
  private static parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  /**
   * Add a new supported version
   */
  static addSupportedVersion(config: ApiVersionConfig): void {
    ApiVersionMiddleware.supportedVersions.set(config.version, config);
  }

  /**
   * Mark a version as deprecated
   */
  static deprecateVersion(version: string, deprecationDate: Date, sunsetDate?: Date, migrationGuide?: string): void {
    const config = ApiVersionMiddleware.supportedVersions.get(version);
    if (config) {
      config.status = 'deprecated';
      config.deprecationDate = deprecationDate;
      config.sunsetDate = sunsetDate;
      config.migrationGuide = migrationGuide;
    }
  }

  /**
   * Remove support for a version (sunset)
   */
  static sunsetVersion(version: string): void {
    const config = ApiVersionMiddleware.supportedVersions.get(version);
    if (config) {
      config.status = 'sunset';
    }
  }

  /**
   * Get information about all supported versions
   */
  static getVersionInfo(): { versions: ApiVersionConfig[]; latest: string; default: string } {
    return {
      versions: Array.from(ApiVersionMiddleware.supportedVersions.values()),
      latest: ApiVersionMiddleware.latestVersion,
      default: ApiVersionMiddleware.defaultVersion
    };
  }

  /**
   * Middleware for handling version-specific logic
   */
  static versionGuard(minVersion: string, maxVersion?: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const versionedReq = req as VersionedRequest;
      
      if (!versionedReq.apiVersion) {
        res.status(500).json({
          error: 'Version middleware not properly initialized'
        });
        return;
      }

      const currentVersion = versionedReq.apiVersion.full;
      const minVersionParsed = ApiVersionMiddleware.parseVersion(minVersion);
      const currentVersionParsed = ApiVersionMiddleware.parseVersion(currentVersion);

      // Check minimum version requirement
      if (ApiVersionMiddleware.compareVersions(currentVersionParsed, minVersionParsed) < 0) {
        res.status(400).json({
          error: 'API version too old',
          message: `This endpoint requires API version ${minVersion} or higher`,
          currentVersion,
          requiredVersion: minVersion
        });
        return;
      }

      // Check maximum version requirement if specified
      if (maxVersion) {
        const maxVersionParsed = ApiVersionMiddleware.parseVersion(maxVersion);
        if (ApiVersionMiddleware.compareVersions(currentVersionParsed, maxVersionParsed) > 0) {
          res.status(400).json({
            error: 'API version too new',
            message: `This endpoint is not available in API version ${currentVersion}`,
            currentVersion,
            maxSupportedVersion: maxVersion
          });
          return;
        }
      }

      next();
    };
  }

  /**
   * Compare two version objects
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  private static compareVersions(
    a: { major: number; minor: number; patch: number },
    b: { major: number; minor: number; patch: number }
  ): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }
} 