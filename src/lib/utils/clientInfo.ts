/**
 * Client information utilities for security tracking
 */

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
  fingerprint: string;
}

/**
 * Get client IP address
 * Note: This is a best-effort approach. In production, the IP should be 
 * obtained server-side to prevent spoofing.
 */
export const getClientIP = async (): Promise<string> => {
  try {
    // Try to get IP from a public API (fallback)
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.warn('Failed to get client IP:', error);
    return 'unknown';
  }
};

/**
 * Get browser user agent
 */
export const getUserAgent = (): string => {
  return navigator.userAgent || 'unknown';
};

/**
 * Generate a simple browser fingerprint
 * This is for basic tracking and should not be relied upon for security
 */
export const generateFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('Browser fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
};

/**
 * Get comprehensive client information
 */
export const getClientInfo = async (): Promise<ClientInfo> => {
  const [ipAddress] = await Promise.all([
    getClientIP()
  ]);
  
  return {
    ipAddress,
    userAgent: getUserAgent(),
    fingerprint: generateFingerprint()
  };
};

/**
 * Cached client info to avoid repeated API calls
 */
let cachedClientInfo: ClientInfo | null = null;

/**
 * Get cached client information (loads once per session)
 */
export const getCachedClientInfo = async (): Promise<ClientInfo> => {
  if (!cachedClientInfo) {
    cachedClientInfo = await getClientInfo();
  }
  return cachedClientInfo;
}; 