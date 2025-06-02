import { supabase } from '../supabase';
import { createHash, randomBytes } from 'crypto';

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  description?: string;
  permissions: string[];
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  last_used_at?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ApiKeyCreateRequest {
  name: string;
  description?: string;
  permissions?: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  expires_at?: string;
}

export interface ApiKeyValidationResult {
  key_id?: string;
  user_id?: string;
  permissions?: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  is_valid: boolean;
}

export interface RateLimitStatus {
  minute_allowed: boolean;
  hour_allowed: boolean;
  day_allowed: boolean;
  minute_remaining: number;
  hour_remaining: number;
  day_remaining: number;
}

/**
 * Service for managing API keys and authentication
 */
export class ApiKeyService {
  /**
   * Generate a new API key string
   */
  private static generateApiKey(): string {
    // Generate a secure random key with sk- prefix (similar to OpenAI style)
    const randomBytesBuffer = randomBytes(24);
    return `sk-${randomBytesBuffer.toString('base64').replace(/[+/=]/g, match => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    })}`;
  }

  /**
   * Hash an API key for secure storage
   */
  private static hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create a new API key for a user
   */
  static async createApiKey(
    userId: string, 
    request: ApiKeyCreateRequest
  ): Promise<{ success: boolean; apiKey?: string; data?: ApiKey; error?: any }> {
    try {
      // Generate the API key
      const apiKey = this.generateApiKey();
      const keyHash = this.hashApiKey(apiKey);

      // Prepare the data for insertion
      const apiKeyData = {
        user_id: userId,
        key_hash: keyHash,
        name: request.name,
        description: request.description || null,
        permissions: JSON.stringify(request.permissions || []),
        rate_limit_per_minute: request.rate_limit_per_minute || 60,
        rate_limit_per_hour: request.rate_limit_per_hour || 1000,
        rate_limit_per_day: request.rate_limit_per_day || 10000,
        expires_at: request.expires_at || null,
        created_by: userId
      };

      // Insert the API key record
      const { data, error } = await supabase
        .from('api_keys')
        .insert([apiKeyData])
        .select()
        .single();

      if (error) {
        return { success: false, error };
      }

      // Return the raw API key (only time it's shown) and the record
      return { 
        success: true, 
        apiKey, // The actual key - must be stored by the user
        data: {
          ...data,
          permissions: JSON.parse(data.permissions)
        }
      };
    } catch (error) {
      console.error('Error creating API key:', error);
      return { success: false, error: { message: 'Failed to create API key' } };
    }
  }

  /**
   * List API keys for a user (without showing the actual keys)
   */
  static async listApiKeys(userId: string): Promise<{ success: boolean; data?: ApiKey[]; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error };
      }

      // Parse permissions JSON and exclude sensitive data
      const apiKeys = data.map(key => ({
        ...key,
        permissions: JSON.parse(key.permissions),
        key_hash: undefined // Don't expose hash
      }));

      return { success: true, data: apiKeys };
    } catch (error) {
      console.error('Error listing API keys:', error);
      return { success: false, error: { message: 'Failed to list API keys' } };
    }
  }

  /**
   * Get a specific API key by ID
   */
  static async getApiKey(keyId: string, userId: string): Promise<{ success: boolean; data?: ApiKey; error?: any }> {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('id', keyId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return { success: false, error };
      }

      // Parse permissions and exclude sensitive data
      const apiKey = {
        ...data,
        permissions: JSON.parse(data.permissions),
        key_hash: undefined
      };

      return { success: true, data: apiKey };
    } catch (error) {
      console.error('Error getting API key:', error);
      return { success: false, error: { message: 'Failed to get API key' } };
    }
  }

  /**
   * Update an API key
   */
  static async updateApiKey(
    keyId: string, 
    userId: string, 
    updates: Partial<ApiKeyCreateRequest>
  ): Promise<{ success: boolean; data?: ApiKey; error?: any }> {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.permissions) updateData.permissions = JSON.stringify(updates.permissions);
      if (updates.rate_limit_per_minute) updateData.rate_limit_per_minute = updates.rate_limit_per_minute;
      if (updates.rate_limit_per_hour) updateData.rate_limit_per_hour = updates.rate_limit_per_hour;
      if (updates.rate_limit_per_day) updateData.rate_limit_per_day = updates.rate_limit_per_day;
      if (updates.expires_at !== undefined) updateData.expires_at = updates.expires_at;

      const { data, error } = await supabase
        .from('api_keys')
        .update(updateData)
        .eq('id', keyId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { success: false, error };
      }

      const apiKey = {
        ...data,
        permissions: JSON.parse(data.permissions),
        key_hash: undefined
      };

      return { success: true, data: apiKey };
    } catch (error) {
      console.error('Error updating API key:', error);
      return { success: false, error: { message: 'Failed to update API key' } };
    }
  }

  /**
   * Deactivate an API key
   */
  static async deactivateApiKey(keyId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deactivating API key:', error);
      return { success: false, error: { message: 'Failed to deactivate API key' } };
    }
  }

  /**
   * Delete an API key permanently
   */
  static async deleteApiKey(keyId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return { success: false, error: { message: 'Failed to delete API key' } };
    }
  }

  /**
   * Validate an API key and return its information
   */
  static async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    try {
      const { data, error } = await supabase.rpc('validate_api_key', {
        key_value: apiKey
      });

      if (error || !data || data.length === 0) {
        return { is_valid: false };
      }

      const keyInfo = data[0];
      return {
        key_id: keyInfo.key_id,
        user_id: keyInfo.user_id,
        permissions: keyInfo.permissions,
        rate_limit_per_minute: keyInfo.rate_limit_per_minute,
        rate_limit_per_hour: keyInfo.rate_limit_per_hour,
        rate_limit_per_day: keyInfo.rate_limit_per_day,
        is_valid: keyInfo.is_valid
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { is_valid: false };
    }
  }

  /**
   * Check rate limits for an API key
   */
  static async checkRateLimit(keyId: string): Promise<RateLimitStatus | null> {
    try {
      const { data, error } = await supabase.rpc('check_api_key_rate_limit', {
        key_id: keyId
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return null;
    }
  }

  /**
   * Record API usage and increment rate limits
   */
  static async recordUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    options: {
      requestSize?: number;
      responseSize?: number;
      processingTime?: number;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    try {
      // Record detailed usage
      const { error: usageError } = await supabase
        .from('api_key_usage')
        .insert([{
          api_key_id: keyId,
          endpoint,
          method,
          status_code: statusCode,
          request_size_bytes: options.requestSize || null,
          response_size_bytes: options.responseSize || null,
          processing_time_ms: options.processingTime || null,
          ip_address: options.ipAddress || null,
          user_agent: options.userAgent || null
        }]);

      if (usageError) {
        console.error('Error recording API usage:', usageError);
      }

      // Increment rate limit counters
      const { error: rateLimitError } = await supabase.rpc('increment_api_key_usage', {
        key_id: keyId
      });

      if (rateLimitError) {
        console.error('Error incrementing rate limit:', rateLimitError);
      }
    } catch (error) {
      console.error('Error recording API usage:', error);
    }
  }

  /**
   * Get usage statistics for an API key
   */
  static async getUsageStats(
    keyId: string,
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<{ success: boolean; data?: any[]; error?: any }> {
    try {
      let query = supabase
        .from('api_key_usage')
        .select(`
          endpoint,
          method,
          status_code,
          request_size_bytes,
          response_size_bytes,
          processing_time_ms,
          timestamp
        `)
        .eq('api_key_id', keyId)
        .order('timestamp', { ascending: false });

      if (options.startDate) {
        query = query.gte('timestamp', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('timestamp', options.endDate);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return { success: false, error: { message: 'Failed to get usage statistics' } };
    }
  }
} 