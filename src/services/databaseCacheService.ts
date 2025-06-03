import { EventEmitter } from 'events';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../lib/types/user';

// Type definitions for database entities
interface Organization {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface OrganizationMembership {
  organization_id: string;
  role: string;
  organizations: Organization[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  organization_id: string;
}

interface ProjectMembership {
  project_id: string;
  role: string;
  projects: Project[];
}

interface QASession {
  id: string;
  name: string;
  status: string;
  created_at: string;
  // Add other QA session fields as needed
}

interface DashboardMetrics {
  total_sessions: number;
  total_errors: number;
  completion_rate: number;
  // Add other dashboard metric fields as needed
}

// Cache entry interface
interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  ttl: number;
  size: number;
  tags?: string[];
}

// Cache configuration
interface DatabaseCacheConfig {
  maxSize: number;          // Maximum cache size in bytes
  defaultTTL: number;       // Default TTL in milliseconds
  maxEntries: number;       // Maximum number of entries
  cleanupInterval: number;  // Cleanup interval in milliseconds
  enableMetrics: boolean;   // Enable performance metrics
}

// Cache metrics
interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalRequests: number;
  totalSize: number;
  hitRatio: number;
  averageResponseTime: number;
}

// Cache invalidation strategies
type InvalidationStrategy = 'ttl' | 'tag-based' | 'manual' | 'event-driven';

// Cache warming strategies  
interface CacheWarmingConfig {
  enabled: boolean;
  strategies: Array<{
    key: string;
    query: () => Promise<unknown>;
    ttl?: number;
    schedule?: string; // Cron-like schedule
  }>;
}

export class DatabaseCacheService extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private config: DatabaseCacheConfig;
  private metrics: CacheMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private warmingConfig: CacheWarmingConfig;

  constructor(config?: Partial<DatabaseCacheConfig>) {
    super();
    
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: 5 * 60 * 1000,  // 5 minutes default
      maxEntries: 10000,          // 10k entries max
      cleanupInterval: 60 * 1000, // 1 minute cleanup
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalRequests: 0,
      totalSize: 0,
      hitRatio: 0,
      averageResponseTime: 0
    };

    this.warmingConfig = {
      enabled: true,
      strategies: []
    };

    this.startCleanupTimer();
    this.setupCacheWarming();
  }

  /**
   * Get data from cache or execute query and cache result
   */
  async get<T>(
    key: string,
    queryFn: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      skipCache?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Check if we should skip cache
      if (options?.skipCache) {
        const result = await queryFn();
        const responseTime = Date.now() - startTime;
        this.updateMetrics('miss', responseTime);
        return result;
      }

      // Try to get from cache
      const cached = this.cache.get(key);
      if (cached && this.isValid(cached)) {
        // Update access information
        cached.lastAccessed = Date.now();
        cached.accessCount++;
        
        const responseTime = Date.now() - startTime;
        this.updateMetrics('hit', responseTime);
        
        this.emit('cache_hit', { key, responseTime, size: cached.size });
        return cached.data as T;
      }

      // Cache miss - execute query
      const result = await queryFn();
      const responseTime = Date.now() - startTime;
      
      // Cache the result
      await this.set(key, result, {
        ttl: options?.ttl || this.config.defaultTTL,
        tags: options?.tags
      });

      this.updateMetrics('miss', responseTime);
      this.emit('cache_miss', { key, responseTime });
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics('miss', responseTime);
      this.emit('cache_error', { key, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(
    key: string,
    data: T,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): Promise<void> {
    const ttl = options?.ttl || this.config.defaultTTL;
    const size = this.calculateSize(data);
    
    // Check if we need to make space
    if (this.cache.size >= this.config.maxEntries || 
        this.metrics.totalSize + size > this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      ttl,
      size,
      tags: options?.tags
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.metrics.totalSize += size;

    this.emit('cache_set', { key, size, ttl });
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.metrics.deletes++;
      this.metrics.totalSize -= entry.size;
      this.emit('cache_delete', { key, size: entry.size });
      return true;
    }
    return false;
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.tags && entry.tags.some((tag: string) => tags.includes(tag))) {
        this.delete(key);
        invalidated++;
      }
    }
    this.emit('cache_invalidate', { tags, count: invalidated });
    return invalidated;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.totalSize = 0;
    this.emit('cache_clear', { count: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheMetrics & {
    entries: number;
    memoryUsage: string;
    config: DatabaseCacheConfig;
  } {
    const hitRatio = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0;

    return {
      ...this.metrics,
      hitRatio,
      entries: this.cache.size,
      memoryUsage: this.formatBytes(this.metrics.totalSize),
      config: this.config
    };
  }

  // User/Profile caching methods
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.get(
      `user_profile:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 10 * 60 * 1000, // 10 minutes
        tags: ['user', 'profile', `user:${userId}`]
      }
    );
  }

  async getUserRole(userId: string): Promise<string | null> {
    return this.get(
      `user_role:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        return data?.role;
      },
      { 
        ttl: 15 * 60 * 1000, // 15 minutes (roles change less frequently)
        tags: ['user', 'role', `user:${userId}`]
      }
    );
  }

  // Organization caching methods
  async getOrganization(orgId: string): Promise<Organization | null> {
    return this.get(
      `organization:${orgId}`,
      async () => {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 30 * 60 * 1000, // 30 minutes
        tags: ['organization', `org:${orgId}`]
      }
    );
  }

  async getUserOrganizations(userId: string): Promise<OrganizationMembership[]> {
    return this.get(
      `user_organizations:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('organization_members')
          .select(`
            organization_id,
            role,
            organizations (
              id,
              name,
              description,
              created_at
            )
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 15 * 60 * 1000, // 15 minutes
        tags: ['user', 'organization', `user:${userId}`]
      }
    );
  }

  // Project caching methods
  async getProject(projectId: string): Promise<Project | null> {
    return this.get(
      `project:${projectId}`,
      async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 20 * 60 * 1000, // 20 minutes
        tags: ['project', `project:${projectId}`]
      }
    );
  }

  async getUserProjects(userId: string): Promise<ProjectMembership[]> {
    return this.get(
      `user_projects:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('project_members')
          .select(`
            project_id,
            role,
            projects (
              id,
              name,
              description,
              status,
              created_at,
              organization_id
            )
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 15 * 60 * 1000, // 15 minutes
        tags: ['user', 'project', `user:${userId}`]
      }
    );
  }

  // QA Session caching methods
  async getQASession(sessionId: string): Promise<QASession | null> {
    return this.get(
      `qa_session:${sessionId}`,
      async () => {
        const { data, error } = await supabase
          .from('qa_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 10 * 60 * 1000, // 10 minutes
        tags: ['qa_session', `session:${sessionId}`]
      }
    );
  }

  // Analytics caching methods
  async getDashboardMetrics(orgId: string, timeRange: string): Promise<DashboardMetrics | null> {
    return this.get(
      `dashboard_metrics:${orgId}:${timeRange}`,
      async () => {
        // This would be a complex analytics query
        const { data, error } = await supabase
          .rpc('get_dashboard_metrics', {
            org_id: orgId,
            time_range: timeRange
          });
        
        if (error) throw error;
        return data;
      },
      { 
        ttl: 5 * 60 * 1000, // 5 minutes (analytics data updates frequently)
        tags: ['analytics', 'dashboard', `org:${orgId}`]
      }
    );
  }

  // Cache invalidation helpers
  invalidateUser(userId: string): void {
    this.invalidateByTags([`user:${userId}`]);
  }

  invalidateOrganization(orgId: string): void {
    this.invalidateByTags([`org:${orgId}`]);
  }

  invalidateProject(projectId: string): void {
    this.invalidateByTags([`project:${projectId}`]);
  }

  invalidateQASession(sessionId: string): void {
    this.invalidateByTags([`session:${sessionId}`]);
  }

  // Private helper methods
  private isValid(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  private calculateSize(data: unknown): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(data).length * 2; // UTF-16 encoding
  }

  private updateMetrics(type: 'hit' | 'miss', responseTime: number): void {
    if (type === 'hit') {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }

    // Update average response time (simple moving average)
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    this.metrics.hitRatio = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (!this.isValid(entry)) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('cache_cleanup', { cleaned, remaining: this.cache.size });
    }
  }

  private setupCacheWarming(): void {
    // Implementation for cache warming strategies
    // This could include preloading frequently accessed data
    if (this.warmingConfig.enabled) {
      // Setup warming strategies based on configuration
      this.emit('cache_warming_setup', { strategies: this.warmingConfig.strategies.length });
    }
  }

  /**
   * Destroy the cache service and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
    this.removeAllListeners();
  }

  /**
   * Clear entries by tags
   */
  clearByTags(tags: string[]): void {
    const keysToDelete: string[] = [];
    
    // Convert iterator to array to avoid TS errors
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.tags && entry.tags.some((tag: string) => tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.metrics.evictions += keysToDelete.length;
  }
}

// Create default instance
export const databaseCache = new DatabaseCacheService({
  maxSize: 100 * 1024 * 1024,  // 100MB
  defaultTTL: 5 * 60 * 1000,   // 5 minutes
  maxEntries: 10000,            // 10k entries
  cleanupInterval: 60 * 1000,   // 1 minute
  enableMetrics: true
});

// Export types
export type {
  CacheEntry,
  DatabaseCacheConfig,
  CacheMetrics,
  InvalidationStrategy,
  CacheWarmingConfig
}; 