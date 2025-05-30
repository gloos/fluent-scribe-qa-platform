// Circuit Breaker Implementation for LLM Fallback System

import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  LLMProvider,
  LLMError
} from '../types/llm-types';

export class CircuitBreaker {
  private provider: LLMProvider;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private halfOpenRequests: number = 0;

  constructor(provider: LLMProvider, config: CircuitBreakerConfig) {
    this.provider = provider;
    this.config = config;
  }

  /**
   * Check if request can proceed
   */
  public canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
          this.state = CircuitBreakerState.HALF_OPEN;
          this.halfOpenRequests = 0;
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // Allow limited requests to test recovery
        return this.halfOpenRequests < this.config.halfOpenMaxRequests;

      default:
        return false;
    }
  }

  /**
   * Record successful request
   */
  public recordSuccess(): void {
    this.totalRequests++;
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenRequests++;
      
      // If we've had enough successful requests, close the circuit
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.halfOpenRequests = 0;
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failed request
   */
  public recordFailure(error?: LLMError): void {
    this.totalRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (this.state === CircuitBreakerState.CLOSED && 
        this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.state = CircuitBreakerState.OPEN;
      this.halfOpenRequests = 0;
    }
  }

  /**
   * Get current circuit breaker status
   */
  public getStatus(): CircuitBreakerStatus {
    const now = Date.now();
    const successRate = this.totalRequests > 0 ? 
      (this.successCount / this.totalRequests) * 100 : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime > 0 ? new Date(this.lastFailureTime).toISOString() : undefined,
      nextAttemptTime: this.state === CircuitBreakerState.OPEN ? 
        new Date(this.lastFailureTime + this.config.recoveryTimeout).toISOString() : undefined,
      totalRequests: this.totalRequests,
      successRate
    };
  }

  /**
   * Reset circuit breaker
   */
  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Force circuit state (for testing)
   */
  public forceState(state: CircuitBreakerState): void {
    this.state = state;
    if (state === CircuitBreakerState.OPEN) {
      this.lastFailureTime = Date.now();
    }
  }

  /**
   * Get provider
   */
  public getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Check if circuit is healthy (closed state with low failure rate)
   */
  public isHealthy(): boolean {
    const status = this.getStatus();
    return status.state === CircuitBreakerState.CLOSED && 
           status.successRate >= 90; // Consider healthy if >90% success rate
  }

  /**
   * Get time until next attempt (for open circuits)
   */
  public getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitBreakerState.OPEN) {
      return 0;
    }
    
    const now = Date.now();
    const nextAttemptTime = this.lastFailureTime + this.config.recoveryTimeout;
    return Math.max(0, nextAttemptTime - now);
  }
} 