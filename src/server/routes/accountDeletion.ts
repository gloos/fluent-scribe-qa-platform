import { Router } from 'express';
import { accountDeletionService } from '@/services/AccountDeletionService';
import { ApiAuthMiddleware, AuthenticatedRequest } from '@/lib/middleware/apiAuthMiddleware';
import { RateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware';

const router = Router();

/**
 * Create a new account deletion request
 * POST /api/v1/account/deletion-request
 */
router.post('/deletion-request',
  ApiAuthMiddleware.authenticate(),
  RateLimitMiddleware.forUser({ windowMs: 60 * 60 * 1000, maxRequests: 5 }), // 5 requests per hour
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { completionScheduled, reason, feedback, dataExported } = req.body;

      // Validation
      if (!completionScheduled) {
        res.status(400).json({
          error: { code: 'validation_error', message: 'Completion date is required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Ensure the scheduled date is in the future
      const scheduledDate = new Date(completionScheduled);
      const now = new Date();
      if (scheduledDate <= now) {
        res.status(400).json({
          error: { code: 'validation_error', message: 'Completion date must be in the future' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if user already has an active deletion request
      const existingRequest = await accountDeletionService.getDeletionRequest(req.auth.userId);
      if (existingRequest.success && existingRequest.data) {
        res.status(409).json({
          error: { 
            code: 'request_exists', 
            message: 'An active deletion request already exists',
            existingRequest: existingRequest.data
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await accountDeletionService.createDeletionRequest({
        userId: req.auth.userId,
        completionScheduled,
        reason,
        feedback,
        dataExported: Boolean(dataExported)
      });

      if (result.success) {
        res.status(201).json({
          data: result.data,
          message: 'Account deletion request created successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: {
            code: 'creation_error',
            message: result.error || 'Failed to create deletion request'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Account deletion request creation error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to process deletion request'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get current deletion request status
 * GET /api/v1/account/deletion-request
 */
router.get('/deletion-request',
  ApiAuthMiddleware.authenticate(),
  RateLimitMiddleware.forUser(),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await accountDeletionService.getDeletionRequest(req.auth.userId);

      if (result.success) {
        if (result.data) {
          // Calculate grace period info
          const daysRemaining = accountDeletionService.calculateGracePeriodDaysRemaining(
            result.data.completionScheduled
          );

          res.json({
            data: {
              ...result.data,
              gracePeriodDaysRemaining: daysRemaining,
              canCancel: result.data.status === 'grace_period' && daysRemaining > 0
            },
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(404).json({
            error: { code: 'not_found', message: 'No active deletion request found' },
            timestamp: new Date().toISOString()
          });
        }
      } else {
        res.status(500).json({
          error: {
            code: 'fetch_error',
            message: result.error || 'Failed to fetch deletion request'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Account deletion request fetch error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to fetch deletion request'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Cancel a deletion request
 * POST /api/v1/account/deletion-request/:requestId/cancel
 */
router.post('/deletion-request/:requestId/cancel',
  ApiAuthMiddleware.authenticate(),
  RateLimitMiddleware.forUser(),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { requestId } = req.params;
      const { cancellationReason } = req.body;

      if (!requestId) {
        res.status(400).json({
          error: { code: 'validation_error', message: 'Request ID is required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await accountDeletionService.cancelDeletionRequest(
        requestId,
        req.auth.userId,
        cancellationReason
      );

      if (result.success) {
        res.json({
          message: 'Deletion request cancelled successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'cancellation_error',
            message: result.error || 'Failed to cancel deletion request'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Account deletion cancellation error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to cancel deletion request'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get audit log for a deletion request
 * GET /api/v1/account/deletion-request/:requestId/audit-log
 */
router.get('/deletion-request/:requestId/audit-log',
  ApiAuthMiddleware.authenticate(),
  RateLimitMiddleware.forUser(),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          error: { code: 'validation_error', message: 'Request ID is required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // First verify the request belongs to the user
      const deletionRequest = await accountDeletionService.getDeletionRequest(req.auth.userId);
      if (!deletionRequest.success || !deletionRequest.data || deletionRequest.data.id !== requestId) {
        res.status(403).json({
          error: { code: 'forbidden', message: 'Access denied to this deletion request' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await accountDeletionService.getDeletionAuditLog(requestId);

      if (result.success) {
        res.json({
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: {
            code: 'fetch_error',
            message: result.error || 'Failed to fetch audit log'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Audit log fetch error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to fetch audit log'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Admin endpoint to process pending deletions (typically called by scheduled job)
 * POST /api/v1/admin/process-pending-deletions
 */
router.post('/admin/process-pending-deletions',
  ApiAuthMiddleware.authenticate(),
  // Note: In production, add admin role verification here
  RateLimitMiddleware.forUser({ windowMs: 60 * 1000, maxRequests: 1 }), // 1 request per minute
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // In production, verify admin role here
      // if (!req.auth.isAdmin) { ... }

      const result = await accountDeletionService.processPendingDeletions();

      res.json({
        data: {
          processed: result.processed,
          errors: result.errors,
          success: result.success
        },
        message: `Processed ${result.processed} deletions with ${result.errors.length} errors`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Pending deletions processing error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to process pending deletions'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router; 