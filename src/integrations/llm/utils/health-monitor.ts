// Health Monitoring System for LLM Providers

import {
  LLMProvider,
  ProviderHealthStatus,
  HealthMonitoringMetrics,
  FallbackNotification,
  CircuitBreakerState,
  LLMRequest,
  LLMResponse,
  LLMError
} from '../types/llm-types';

import { CircuitBreaker } from './circuit-breaker';

export interface HealthCheckResult {
  provider: LLMProvider;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: string;
}

export class HealthMonitor {
  private healthStatus: Map<LLMProvider, ProviderHealthStatus> = new Map();
  private circuitBreakers: Map<LLMProvider, CircuitBreaker> = new Map();
  private healthCheckInterval: number;
  private monitoringTimer?: NodeJS.Timeout;
  private notifications: FallbackNotification[] = [];
  private maxNotifications: number = 100;

  constructor(
    providers: LLMProvider[],
    healthCheckInterval: number = 60000 // Default 1 minute
  ) {
    this.healthCheckInterval = healthCheckInterval;
    this.initializeProviders(providers);
  }

  /**
   * Initialize health monitoring for providers
   */
  private initializeProviders(providers: LLMProvider[]): void {
    providers.forEach(provider => {
      const initialStatus: ProviderHealthStatus = {
        provider,
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        responseTime: 0,
        errorRate: 0,
        consecutiveFailures: 0,
        circuitBreaker: {
          state: CircuitBreakerState.CLOSED,
          failureCount: 0,
          totalRequests: 0,
          successRate: 100
        },
        availability: 100
      };

      this.healthStatus.set(provider, initialStatus);

      // Initialize circuit breaker with default config
      const circuitBreaker = new CircuitBreaker(provider, {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        halfOpenMaxRequests: 3
      });
      
      this.circuitBreakers.set(provider, circuitBreaker);
    });
  }

  /**
   * Start health monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);

    // Perform initial health check
    this.performHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.healthStatus.keys()).map(provider => 
      this.performHealthCheck(provider)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Perform health check on a specific provider
   */
  private async performHealthCheck(provider: LLMProvider): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple health check request
      const healthCheckRequest: LLMRequest = {
        prompt: 'Health check: respond with "OK"',
        maxTokens: 10,
        temperature: 0,
        metadata: { healthCheck: true }
      };

      // This would need to be implemented with actual provider clients
      // For now, we'll simulate the health check
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        provider,
        isHealthy: true,
        responseTime,
        timestamp: new Date().toISOString()
      };

      this.updateProviderHealth(provider, result);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        provider,
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };

      this.updateProviderHealth(provider, result);
      return result;
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(provider: LLMProvider, result: HealthCheckResult): void {
    const currentStatus = this.healthStatus.get(provider);
    if (!currentStatus) return;

    const circuitBreaker = this.circuitBreakers.get(provider);
    if (!circuitBreaker) return;

    // Update consecutive failures
    const consecutiveFailures = result.isHealthy ? 0 : currentStatus.consecutiveFailures + 1;

    // Calculate error rate (simplified for demo)
    const errorRate = result.isHealthy ? 
      Math.max(0, currentStatus.errorRate - 5) : 
      Math.min(100, currentStatus.errorRate + 10);

    // Calculate availability (simplified for demo)
    const availability = Math.max(0, 100 - errorRate);

    const updatedStatus: ProviderHealthStatus = {
      ...currentStatus,
      isHealthy: result.isHealthy,
      lastHealthCheck: result.timestamp,
      responseTime: result.responseTime,
      errorRate,
      consecutiveFailures,
      circuitBreaker: circuitBreaker.getStatus(),
      availability
    };

    this.healthStatus.set(provider, updatedStatus);

    // Check for status changes and notify
    this.checkStatusChanges(currentStatus, updatedStatus);
  }

  /**
   * Check for significant status changes and generate notifications
   */
  private checkStatusChanges(
    previousStatus: ProviderHealthStatus, 
    currentStatus: ProviderHealthStatus
  ): void {
    // Provider went from healthy to unhealthy
    if (previousStatus.isHealthy && !currentStatus.isHealthy) {
      this.addNotification({
        type: 'provider_failure',
        severity: 'warning',
        message: `Provider ${currentStatus.provider} is experiencing issues`,
        provider: currentStatus.provider,
        timestamp: new Date().toISOString(),
        metadata: {
          consecutiveFailures: currentStatus.consecutiveFailures,
          errorRate: currentStatus.errorRate
        }
      });
    }

    // Provider recovered
    if (!previousStatus.isHealthy && currentStatus.isHealthy) {
      this.addNotification({
        type: 'service_recovery',
        severity: 'info',
        message: `Provider ${currentStatus.provider} has recovered`,
        provider: currentStatus.provider,
        timestamp: new Date().toISOString()
      });
    }

    // Circuit breaker opened
    if (previousStatus.circuitBreaker.state !== CircuitBreakerState.OPEN &&
        currentStatus.circuitBreaker.state === CircuitBreakerState.OPEN) {
      this.addNotification({
        type: 'circuit_open',
        severity: 'error',
        message: `Circuit breaker opened for provider ${currentStatus.provider}`,
        provider: currentStatus.provider,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Record request success for a provider
   */
  public recordSuccess(provider: LLMProvider, responseTime: number): void {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      circuitBreaker.recordSuccess();
    }

    const status = this.healthStatus.get(provider);
    if (status) {
      status.responseTime = responseTime;
      status.circuitBreaker = circuitBreaker?.getStatus() || status.circuitBreaker;
    }
  }

  /**
   * Record request failure for a provider
   */
  public recordFailure(provider: LLMProvider, error: LLMError): void {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      circuitBreaker.recordFailure(error);
    }

    const status = this.healthStatus.get(provider);
    if (status) {
      status.consecutiveFailures++;
      status.circuitBreaker = circuitBreaker?.getStatus() || status.circuitBreaker;
    }
  }

  /**
   * Check if provider can handle requests
   */
  public canUseProvider(provider: LLMProvider): boolean {
    const circuitBreaker = this.circuitBreakers.get(provider);
    return circuitBreaker ? circuitBreaker.canExecute() : false;
  }

  /**
   * Get healthy providers in order of preference
   */
  public getHealthyProviders(): LLMProvider[] {
    return Array.from(this.healthStatus.values())
      .filter(status => status.isHealthy && this.canUseProvider(status.provider))
      .sort((a, b) => {
        // Sort by availability and response time
        if (a.availability !== b.availability) {
          return b.availability - a.availability;
        }
        return a.responseTime - b.responseTime;
      })
      .map(status => status.provider);
  }

  /**
   * Get comprehensive health metrics
   */
  public getHealthMetrics(): HealthMonitoringMetrics {
    const providers: Record<LLMProvider, ProviderHealthStatus> = {};
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;
    let providerCount = 0;

    this.healthStatus.forEach((status, provider) => {
      providers[provider] = status;
      
      if (status.circuitBreaker.totalRequests > 0) {
        totalRequests += status.circuitBreaker.totalRequests;
        successfulRequests += status.circuitBreaker.totalRequests * (status.circuitBreaker.successRate / 100);
        totalResponseTime += status.responseTime;
        providerCount++;
      }
    });

    const globalSuccessRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const averageResponseTime = providerCount > 0 ? totalResponseTime / providerCount : 0;

    return {
      providers,
      globalStats: {
        totalRequests,
        successfulRequests: Math.round(successfulRequests),
        globalSuccessRate,
        averageResponseTime,
        lastUpdated: new Date().toISOString()
      },
      alerts: this.notifications.slice(-20) // Return last 20 notifications
    };
  }

  /**
   * Add notification
   */
  private addNotification(notification: FallbackNotification): void {
    this.notifications.push(notification);
    
    // Keep only the most recent notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }
  }

  /**
   * Get recent notifications
   */
  public getNotifications(limit: number = 20): FallbackNotification[] {
    return this.notifications.slice(-limit);
  }

  /**
   * Clear notifications
   */
  public clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Reset provider health
   */
  public resetProviderHealth(provider: LLMProvider): void {
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }

    const status = this.healthStatus.get(provider);
    if (status) {
      status.consecutiveFailures = 0;
      status.errorRate = 0;
      status.availability = 100;
      status.isHealthy = true;
      status.circuitBreaker = circuitBreaker?.getStatus() || status.circuitBreaker;
    }
  }

  /**
   * Get circuit breaker for provider
   */
  public getCircuitBreaker(provider: LLMProvider): CircuitBreaker | undefined {
    return this.circuitBreakers.get(provider);
  }
} 