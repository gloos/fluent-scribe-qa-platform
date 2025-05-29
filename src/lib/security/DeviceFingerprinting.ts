import { toast } from "@/hooks/use-toast";
import { 
  SECURITY_CONFIG, 
  DeviceFingerprint,
  SecurityEvent 
} from './types';

export class DeviceFingerprinting {
  private deviceFingerprints = new Map<string, DeviceFingerprint>();

  /**
   * Generate device fingerprint for anomaly detection
   */
  public generateDeviceFingerprint(): DeviceFingerprint {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'server',
        screenResolution: '0x0',
        timezone: 'UTC',
        language: 'en',
        colorDepth: 24,
        touchSupport: false,
        hash: 'server-fingerprint'
      };
    }

    const fingerprint: DeviceFingerprint = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      colorDepth: screen.colorDepth,
      touchSupport: 'ontouchstart' in window,
      hash: ''
    };

    // Generate hash from fingerprint data
    const fingerprintString = JSON.stringify(fingerprint);
    fingerprint.hash = this.simpleHash(fingerprintString);

    return fingerprint;
  }

  /**
   * Check for device changes and store fingerprint
   */
  public checkDeviceChange(
    identifier: string, 
    userId?: string,
    onLogEvent?: (event: SecurityEvent) => void
  ): { isNewDevice: boolean; fingerprint: DeviceFingerprint } {
    const now = Date.now();
    const fingerprint = this.generateDeviceFingerprint();
    const deviceKey = `${identifier}-${fingerprint.hash}`;
    
    // Check for device changes
    const existingDevices = Array.from(this.deviceFingerprints.keys())
      .filter(key => key.startsWith(`${identifier}-`));

    const isNewDevice = !this.deviceFingerprints.has(deviceKey);

    if (isNewDevice && existingDevices.length > 0) {
      // Log device change event
      if (onLogEvent) {
        onLogEvent({
          type: 'DEVICE_CHANGE',
          userId,
          email: identifier,
          ipAddress: this.getClientIP(),
          userAgent: fingerprint.userAgent,
          deviceFingerprint: fingerprint.hash,
          timestamp: now,
          success: true,
          metadata: { 
            newDevice: true,
            previousDevices: existingDevices.length
          }
        });
      }

      // Show user notification
      toast({
        title: "New Device Detected",
        description: "Login from a new device detected. If this wasn't you, please change your password.",
        variant: "default"
      });
    }

    // Store the fingerprint
    this.deviceFingerprints.set(deviceKey, fingerprint);

    return { isNewDevice, fingerprint };
  }

  /**
   * Get stored device fingerprints for a user
   */
  public getDeviceFingerprints(identifier: string): DeviceFingerprint[] {
    const userDevices = Array.from(this.deviceFingerprints.entries())
      .filter(([key]) => key.startsWith(`${identifier}-`))
      .map(([_, fingerprint]) => fingerprint);

    return userDevices;
  }

  /**
   * Remove a device fingerprint
   */
  public removeDeviceFingerprint(identifier: string, fingerprintHash: string): boolean {
    const deviceKey = `${identifier}-${fingerprintHash}`;
    return this.deviceFingerprints.delete(deviceKey);
  }

  /**
   * Clear all device fingerprints for a user
   */
  public clearUserDeviceFingerprints(identifier: string): number {
    const userDeviceKeys = Array.from(this.deviceFingerprints.keys())
      .filter(key => key.startsWith(`${identifier}-`));

    let removedCount = 0;
    for (const key of userDeviceKeys) {
      if (this.deviceFingerprints.delete(key)) {
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get device statistics
   */
  public getDeviceStats(): {
    totalDevices: number;
    uniqueUsers: number;
    averageDevicesPerUser: number;
  } {
    const totalDevices = this.deviceFingerprints.size;
    const uniqueUsers = new Set(
      Array.from(this.deviceFingerprints.keys())
        .map(key => key.split('-')[0])
    ).size;

    return {
      totalDevices,
      uniqueUsers,
      averageDevicesPerUser: uniqueUsers > 0 ? totalDevices / uniqueUsers : 0
    };
  }

  /**
   * Simple hash function for device fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get client IP address (best effort)
   */
  private getClientIP(): string {
    // In production, this would come from headers set by a reverse proxy
    // For now, we'll use a placeholder
    return 'client-ip-placeholder';
  }
} 