import express, { Request, Response } from 'express';
import { resourceMonitor, SystemMetrics, Alert } from '../../services/resourceMonitoringService';
import { DatabaseMonitoringService, DatabaseMetrics, DatabaseAlert } from '../../services/databaseMonitoringService';

const router = express.Router();

// Initialize database monitoring service
let dbMonitor: DatabaseMonitoringService | null = null;

// Initialize database monitoring if environment variables are available
if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
  dbMonitor = new DatabaseMonitoringService(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
}

// Store alerts for retrieval
const systemAlerts: Alert[] = [];
const databaseAlerts: DatabaseAlert[] = [];

// Set up event listeners for alerts
resourceMonitor.on('alert', (alert: Alert) => {
  systemAlerts.push(alert);
  // Keep only last 100 alerts
  if (systemAlerts.length > 100) {
    systemAlerts.splice(0, systemAlerts.length - 100);
  }
  console.log('System Alert:', alert.message);
});

if (dbMonitor) {
  dbMonitor.on('alert', (alert: DatabaseAlert) => {
    databaseAlerts.push(alert);
    // Keep only last 100 alerts
    if (databaseAlerts.length > 100) {
      databaseAlerts.splice(0, databaseAlerts.length - 100);
    }
    console.log('Database Alert:', alert.message);
  });
}

/**
 * @swagger
 * /api/v1/monitoring/system/start:
 *   post:
 *     summary: Start system resource monitoring
 *     tags: [Monitoring]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               intervalMs:
 *                 type: number
 *                 default: 5000
 *                 description: Monitoring interval in milliseconds
 *     responses:
 *       200:
 *         description: Monitoring started successfully
 *       400:
 *         description: Monitoring already active
 */
router.post('/system/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { intervalMs = 5000 } = req.body;
    
    if (resourceMonitor.isActive()) {
      res.status(400).json({
        error: 'System monitoring is already active'
      });
      return;
    }

    await resourceMonitor.startMonitoring(intervalMs);
    
    res.json({
      message: 'System monitoring started',
      intervalMs,
      status: 'active'
    });
  } catch (error) {
    console.error('Error starting system monitoring:', error);
    res.status(500).json({
      error: 'Failed to start system monitoring',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/system/stop:
 *   post:
 *     summary: Stop system resource monitoring
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Monitoring stopped successfully
 */
router.post('/system/stop', (req: Request, res: Response): void => {
  resourceMonitor.stopMonitoring();
  
  res.json({
    message: 'System monitoring stopped',
    status: 'inactive'
  });
});

/**
 * @swagger
 * /api/v1/monitoring/system/metrics:
 *   get:
 *     summary: Get current system metrics
 *     tags: [Monitoring]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: number
 *         description: Number of historical metrics to return
 *       - name: average
 *         in: query
 *         schema:
 *           type: number
 *         description: Time window in milliseconds for average calculation
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 */
router.get('/system/metrics', (req: Request, res: Response): void => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const averageWindow = req.query.average ? parseInt(req.query.average as string) : undefined;

    let response: any = {
      isActive: resourceMonitor.isActive(),
      current: resourceMonitor.getLatestMetrics()
    };

    if (limit) {
      response.history = resourceMonitor.getMetricsHistory(limit);
    }

    if (averageWindow) {
      response.average = resourceMonitor.getAverageMetrics(averageWindow);
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting system metrics:', error);
    res.status(500).json({
      error: 'Failed to get system metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/system/alerts:
 *   get:
 *     summary: Get system alerts
 *     tags: [Monitoring]
 *     parameters:
 *       - name: severity
 *         in: query
 *         schema:
 *           type: string
 *           enum: [warning, critical]
 *         description: Filter alerts by severity
 *     responses:
 *       200:
 *         description: System alerts retrieved successfully
 */
router.get('/system/alerts', (req: Request, res: Response): void => {
  try {
    let alerts = [...systemAlerts];
    
    if (req.query.severity) {
      alerts = alerts.filter(alert => alert.severity === req.query.severity);
    }

    res.json({
      alerts,
      count: alerts.length,
      thresholds: resourceMonitor.getAlertThresholds()
    });
  } catch (error) {
    console.error('Error getting system alerts:', error);
    res.status(500).json({
      error: 'Failed to get system alerts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/system/thresholds:
 *   put:
 *     summary: Update system alert thresholds
 *     tags: [Monitoring]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cpu:
 *                 type: number
 *                 description: CPU usage threshold percentage
 *               memory:
 *                 type: number
 *                 description: Memory usage threshold percentage
 *               disk:
 *                 type: number
 *                 description: Disk usage threshold percentage
 *               temperature:
 *                 type: number
 *                 description: Temperature threshold in Celsius
 *     responses:
 *       200:
 *         description: Thresholds updated successfully
 */
router.put('/system/thresholds', (req: Request, res: Response): void => {
  try {
    const thresholds = req.body;
    resourceMonitor.updateAlertThresholds(thresholds);
    
    res.json({
      message: 'System alert thresholds updated',
      thresholds: resourceMonitor.getAlertThresholds()
    });
  } catch (error) {
    console.error('Error updating system thresholds:', error);
    res.status(500).json({
      error: 'Failed to update system thresholds',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database monitoring endpoints (if available)
if (dbMonitor) {
  /**
   * @swagger
   * /api/v1/monitoring/database/start:
   *   post:
   *     summary: Start database monitoring
   *     tags: [Monitoring]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               intervalMs:
   *                 type: number
   *                 default: 10000
   *                 description: Monitoring interval in milliseconds
   *     responses:
   *       200:
   *         description: Database monitoring started successfully
   */
  router.post('/database/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const { intervalMs = 10000 } = req.body;
      
      if (dbMonitor!.isActive()) {
        res.status(400).json({
          error: 'Database monitoring is already active'
        });
        return;
      }

      await dbMonitor!.startMonitoring(intervalMs);
      
      res.json({
        message: 'Database monitoring started',
        intervalMs,
        status: 'active'
      });
    } catch (error) {
      console.error('Error starting database monitoring:', error);
      res.status(500).json({
        error: 'Failed to start database monitoring',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * @swagger
   * /api/v1/monitoring/database/stop:
   *   post:
   *     summary: Stop database monitoring
   *     tags: [Monitoring]
   *     responses:
   *       200:
   *         description: Database monitoring stopped successfully
   */
  router.post('/database/stop', (req: Request, res: Response): void => {
    dbMonitor!.stopMonitoring();
    
    res.json({
      message: 'Database monitoring stopped',
      status: 'inactive'
    });
  });

  /**
   * @swagger
   * /api/v1/monitoring/database/metrics:
   *   get:
   *     summary: Get current database metrics
   *     tags: [Monitoring]
   *     parameters:
   *       - name: limit
   *         in: query
   *         schema:
   *           type: number
   *         description: Number of historical metrics to return
   *     responses:
   *       200:
   *         description: Database metrics retrieved successfully
   */
  router.get('/database/metrics', (req: Request, res: Response): void => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const response = {
        isActive: dbMonitor!.isActive(),
        current: dbMonitor!.getLatestMetrics(),
        history: limit ? dbMonitor!.getMetricsHistory(limit) : undefined
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting database metrics:', error);
      res.status(500).json({
        error: 'Failed to get database metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * @swagger
   * /api/v1/monitoring/database/alerts:
   *   get:
   *     summary: Get database alerts
   *     tags: [Monitoring]
   *     responses:
   *       200:
   *         description: Database alerts retrieved successfully
   */
  router.get('/database/alerts', (req: Request, res: Response): void => {
    try {
      let alerts = [...databaseAlerts];
      
      if (req.query.severity) {
        alerts = alerts.filter(alert => alert.severity === req.query.severity);
      }

      res.json({
        alerts,
        count: alerts.length,
        thresholds: dbMonitor!.getAlertThresholds()
      });
    } catch (error) {
      console.error('Error getting database alerts:', error);
      res.status(500).json({
        error: 'Failed to get database alerts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * @swagger
 * /api/v1/monitoring/status:
 *   get:
 *     summary: Get overall monitoring status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Monitoring status retrieved successfully
 */
router.get('/status', (req: Request, res: Response): void => {
  res.json({
    system: {
      active: resourceMonitor.isActive(),
      alertCount: systemAlerts.length,
      lastAlert: systemAlerts.length > 0 ? systemAlerts[systemAlerts.length - 1] : null
    },
    database: dbMonitor ? {
      available: true,
      active: dbMonitor.isActive(),
      alertCount: databaseAlerts.length,
      lastAlert: databaseAlerts.length > 0 ? databaseAlerts[databaseAlerts.length - 1] : null
    } : {
      available: false,
      reason: 'Database monitoring not configured'
    }
  });
});

export { router as monitoringRouter }; 