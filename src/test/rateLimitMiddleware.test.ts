import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware } from '../lib/middleware/rateLimitMiddleware';

// Mock Express request and response objects
const createMockRequest = (ip: string = '127.0.0.1'): Partial<Request> => ({
  ip,
  headers: {},
  connection: { remoteAddress: ip } as any,
  socket: { remoteAddress: ip } as any
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    headers: {},
    statusCode: 200,
    set: vi.fn((headers: Record<string, string>) => {
      Object.assign(res.headers, headers);
      return res;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((data: any) => {
      res.jsonData = data;
      return res;
    })
  };
  return res;
};

const createMockNext = (): NextFunction => {
  return () => {};
};

describe('RateLimitMiddleware', () => {
  beforeEach(() => {
    // Clear any existing rate limit data between tests
    vi.clearAllMocks();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 5
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 3 requests (under limit)
      for (let i = 0; i < 3; i++) {
        await middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests that exceed the limit', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 3
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await middleware(req, res, next);
      }

      // 4th request should be blocked
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'rate_limit_exceeded'
          })
        })
      );
    });

    it('should add appropriate rate limit headers', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 5
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '4',
          'X-RateLimit-Reset': expect.any(String)
        })
      );
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should track different IPs separately', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 2
      });

      const req1 = createMockRequest('192.168.1.1') as Request;
      const req2 = createMockRequest('192.168.1.2') as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Each IP should be able to make 2 requests
      await middleware(req1, res, next);
      await middleware(req1, res, next);
      await middleware(req2, res, next);
      await middleware(req2, res, next);

      expect(next).toHaveBeenCalledTimes(4);

      // 3rd request from IP1 should be blocked
      await middleware(req1, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle X-Forwarded-For header', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      const req = createMockRequest() as Request;
      req.headers = { 'x-forwarded-for': '203.0.113.1, 70.41.3.18' };
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should be blocked (same forwarded IP)
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Preset Configurations', () => {
    it('should have correct preset values', () => {
      expect(RateLimitMiddleware.presets.strict).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 5,
        message: 'Too many requests. Maximum 5 requests per minute allowed.'
      });

      expect(RateLimitMiddleware.presets.standard).toEqual({
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        message: 'Too many requests. Maximum 100 requests per 15 minutes allowed.'
      });

      expect(RateLimitMiddleware.presets.lenient).toEqual({
        windowMs: 60 * 60 * 1000,
        maxRequests: 1000,
        message: 'Too many requests. Maximum 1000 requests per hour allowed.'
      });

      expect(RateLimitMiddleware.presets.auth).toEqual({
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
        message: 'Too many authentication attempts. Please try again later.'
      });
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator when provided', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 1,
        keyGenerator: (req) => 'custom-key'
      });

      const req1 = createMockRequest('192.168.1.1') as Request;
      const req2 = createMockRequest('192.168.1.2') as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await middleware(req1, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Even different IP should be blocked because same custom key
      await middleware(req2, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Endpoint-specific Rate Limiting', () => {
    it('should create endpoint-specific middleware', async () => {
      const middleware = RateLimitMiddleware.forEndpoint('test-endpoint', {
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('User-specific Rate Limiting', () => {
    it('should use user ID when available', async () => {
      const middleware = RateLimitMiddleware.forUser({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      const req1 = createMockRequest() as any;
      req1.auth = { userId: 'user1' };
      
      const req2 = createMockRequest() as any;
      req2.auth = { userId: 'user2' };

      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Different users should have separate limits
      await middleware(req1, res, next);
      await middleware(req2, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Same user should be blocked on second request
      await middleware(req1, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should fall back to IP when no user ID', async () => {
      const middleware = RateLimitMiddleware.forUser({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Error Handling', () => {
    it('should continue on error and not crash', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 5,
        keyGenerator: () => {
          throw new Error('Test error');
        }
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // Should not throw and should call next()
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry-After Header', () => {
    it('should include Retry-After header when rate limited', async () => {
      const middleware = RateLimitMiddleware.create({
        windowMs: 60 * 1000,
        maxRequests: 1
      });

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      // First request should pass
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should be rate limited with Retry-After header
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Retry-After': expect.any(String)
        })
      );
    });
  });
}); 