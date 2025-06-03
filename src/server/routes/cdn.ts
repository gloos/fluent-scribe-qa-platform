import express from 'express';
import { cdnService } from '../../services/cdnService';

const router = express.Router();

/**
 * @swagger
 * /api/v1/cdn/status:
 *   get:
 *     summary: Get CDN service status and metrics
 *     description: Returns comprehensive CDN performance metrics including hit ratio, response times, and geographic distribution
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: CDN status and metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: running
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     hitRatio:
 *                       type: number
 *                       example: 0.85
 *                     avgResponseTime:
 *                       type: number
 *                       example: 245
 *                     totalRequests:
 *                       type: integer
 *                       example: 15432
 *                     cacheHits:
 *                       type: integer
 *                       example: 13117
 *                     cacheMisses:
 *                       type: integer
 *                       example: 2315
 *                     bytesServed:
 *                       type: integer
 *                       example: 2456789123
 *                     errorRate:
 *                       type: number
 *                       example: 0.02
 *                     geoDistribution:
 *                       type: object
 *                       example: {"US": 1234, "GB": 567, "DE": 890}
 *                     timestamp:
 *                       type: integer
 *                       example: 1672531200000
 *                 configuration:
 *                   type: object
 *                   properties:
 *                     enabledProviders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           enabled:
 *                             type: boolean
 *                     geoOptimization:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         regions:
 *                           type: array
 *                           items:
 *                             type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/status', (req, res) => {
  try {
    const metrics = cdnService.getMetrics();
    const configuration = cdnService.getConfiguration();
    const isRunning = cdnService.isServiceRunning();

    res.json({
      status: isRunning ? 'running' : 'stopped',
      metrics,
      configuration: {
        enabledProviders: configuration.enabledProviders,
        geoOptimization: configuration.geoOptimization,
        monitoring: configuration.monitoring
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN status error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_status_error',
        message: 'Failed to retrieve CDN status'
      },
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/v1/cdn/metrics:
 *   get:
 *     summary: Get detailed CDN performance metrics
 *     description: Returns detailed performance metrics and analytics for CDN operations
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: CDN metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metrics:
 *                   type: object
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [performance, availability, cache, error]
 *                       severity:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       message:
 *                         type: string
 *                       timestamp:
 *                         type: integer
 *                       metadata:
 *                         type: object
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = cdnService.getMetrics();
    const alerts = cdnService.getAlerts();

    res.json({
      metrics,
      alerts,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN metrics error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_metrics_error',
        message: 'Failed to retrieve CDN metrics'
      },
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/v1/cdn/alerts:
 *   get:
 *     summary: Get CDN alerts and notifications
 *     description: Returns current and recent CDN alerts based on performance thresholds
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: CDN alerts retrieved successfully
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = cdnService.getAlerts();
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const highAlerts = alerts.filter(alert => alert.severity === 'high');

    res.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: criticalAlerts.length,
        high: highAlerts.length,
        recent: alerts.filter(alert => Date.now() - alert.timestamp < 3600000).length // Last hour
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN alerts error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_alerts_error',
        message: 'Failed to retrieve CDN alerts'
      },
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/v1/cdn/cache/invalidate:
 *   post:
 *     summary: Invalidate CDN cache
 *     description: Invalidate CDN cache for specific patterns or all cached content
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pattern:
 *                 type: string
 *                 description: Pattern to match for cache invalidation (optional)
 *                 example: "*.js"
 *               reason:
 *                 type: string
 *                 description: Reason for cache invalidation
 *                 example: "Updated JavaScript assets"
 *     responses:
 *       200:
 *         description: Cache invalidated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cache invalidated successfully"
 *                 pattern:
 *                   type: string
 *                 timestamp:
 *                   type: integer
 */
router.post('/cache/invalidate', (req, res) => {
  try {
    const { pattern, reason } = req.body;

    cdnService.invalidateCache(pattern);

    console.log(`Cache invalidation requested: ${pattern || 'all'} - Reason: ${reason || 'Manual request'}`);

    res.json({
      success: true,
      message: `Cache invalidated successfully${pattern ? ` for pattern: ${pattern}` : ''}`,
      pattern: pattern || 'all',
      reason: reason || 'Manual request',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN cache invalidation error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_cache_invalidation_error',
        message: 'Failed to invalidate CDN cache'
      },
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/v1/cdn/config:
 *   get:
 *     summary: Get CDN configuration
 *     description: Returns the current CDN service configuration
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: CDN configuration retrieved successfully
 */
router.get('/config', (req, res) => {
  try {
    const configuration = cdnService.getConfiguration();

    res.json({
      configuration,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN config error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_config_error',
        message: 'Failed to retrieve CDN configuration'
      },
      timestamp: Date.now()
    });
  }
});

/**
 * @swagger
 * /api/v1/cdn/config:
 *   put:
 *     summary: Update CDN configuration
 *     description: Update CDN service configuration settings
 *     tags:
 *       - CDN
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               geoOptimization:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   regions:
 *                     type: array
 *                     items:
 *                       type: string
 *               monitoring:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   metricsInterval:
 *                     type: integer
 *               cacheControl:
 *                 type: object
 *                 properties:
 *                   staticAssets:
 *                     type: string
 *                   dynamicContent:
 *                     type: string
 *                   images:
 *                     type: string
 *                   documents:
 *                     type: string
 *     responses:
 *       200:
 *         description: CDN configuration updated successfully
 */
router.put('/config', (req, res) => {
  try {
    const updates = req.body;

    // Validate updates before applying
    if (updates.monitoring?.metricsInterval && updates.monitoring.metricsInterval < 10) {
      res.status(400).json({
        error: {
          code: 'invalid_config',
          message: 'Metrics interval must be at least 10 seconds'
        },
        timestamp: Date.now()
      });
      return;
    }

    cdnService.updateConfiguration(updates);

    res.json({
      success: true,
      message: 'CDN configuration updated successfully',
      configuration: cdnService.getConfiguration(),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('CDN config update error:', error);
    res.status(500).json({
      error: {
        code: 'cdn_config_update_error',
        message: 'Failed to update CDN configuration'
      },
      timestamp: Date.now()
    });
  }
});

export { router as cdnRouter }; 