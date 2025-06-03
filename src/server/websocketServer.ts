import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { resourceMonitor, SystemMetrics, Alert } from '../services/resourceMonitoringService';
import { DatabaseMonitoringService, DatabaseMetrics, DatabaseAlert } from '../services/databaseMonitoringService';

export interface MonitoringWebSocketMessage {
  type: 'system_metrics' | 'database_metrics' | 'system_alert' | 'database_alert' | 'status_update';
  data: SystemMetrics | DatabaseMetrics | Alert | DatabaseAlert | any;
  timestamp: number;
}

export class MonitoringWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private dbMonitor: DatabaseMonitoringService | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/v1/monitoring/ws',
      clientTracking: true
    });

    // Initialize database monitoring if available
    if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
      this.dbMonitor = new DatabaseMonitoringService(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY
      );
    }

    this.setupWebSocketServer();
    this.setupMonitoringListeners();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('New monitoring WebSocket connection from:', request.socket.remoteAddress);
      
      this.clients.add(ws);

      // Send current status on connection
      this.sendMessage(ws, {
        type: 'status_update',
        data: {
          system: {
            active: resourceMonitor.isActive(),
            current: resourceMonitor.getLatestMetrics()
          },
          database: this.dbMonitor ? {
            available: true,
            active: this.dbMonitor.isActive(),
            current: this.dbMonitor.getLatestMetrics()
          } : {
            available: false
          }
        },
        timestamp: Date.now()
      });

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendError(ws, 'Invalid JSON message');
        }
      });

      // Handle connection close
      ws.on('close', (code: number, reason: Buffer) => {
        console.log('Monitoring WebSocket disconnected:', code, reason.toString());
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('Monitoring WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send periodic heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(heartbeat);
        }
      }, 30000); // 30 second heartbeat

      ws.on('pong', () => {
        // Client is alive
      });
    });

    this.wss.on('error', (error: Error) => {
      console.error('WebSocket Server error:', error);
    });

    console.log('Monitoring WebSocket server initialized on /api/v1/monitoring/ws');
  }

  private setupMonitoringListeners(): void {
    // System monitoring events
    resourceMonitor.on('metrics', (metrics: SystemMetrics) => {
      this.broadcast({
        type: 'system_metrics',
        data: metrics,
        timestamp: Date.now()
      });
    });

    resourceMonitor.on('alert', (alert: Alert) => {
      this.broadcast({
        type: 'system_alert',
        data: alert,
        timestamp: Date.now()
      });
    });

    // Database monitoring events (if available)
    if (this.dbMonitor) {
      this.dbMonitor.on('metrics', (metrics: DatabaseMetrics) => {
        this.broadcast({
          type: 'database_metrics',
          data: metrics,
          timestamp: Date.now()
        });
      });

      this.dbMonitor.on('alert', (alert: DatabaseAlert) => {
        this.broadcast({
          type: 'database_alert',
          data: alert,
          timestamp: Date.now()
        });
      });
    }
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'start_system_monitoring':
        if (!resourceMonitor.isActive()) {
          resourceMonitor.startMonitoring(message.interval || 5000);
          this.sendMessage(ws, {
            type: 'status_update',
            data: { system: { active: true, message: 'System monitoring started' } },
            timestamp: Date.now()
          });
        }
        break;

      case 'stop_system_monitoring':
        if (resourceMonitor.isActive()) {
          resourceMonitor.stopMonitoring();
          this.sendMessage(ws, {
            type: 'status_update',
            data: { system: { active: false, message: 'System monitoring stopped' } },
            timestamp: Date.now()
          });
        }
        break;

      case 'start_database_monitoring':
        if (this.dbMonitor && !this.dbMonitor.isActive()) {
          this.dbMonitor.startMonitoring(message.interval || 10000);
          this.sendMessage(ws, {
            type: 'status_update',
            data: { database: { active: true, message: 'Database monitoring started' } },
            timestamp: Date.now()
          });
        }
        break;

      case 'stop_database_monitoring':
        if (this.dbMonitor && this.dbMonitor.isActive()) {
          this.dbMonitor.stopMonitoring();
          this.sendMessage(ws, {
            type: 'status_update',
            data: { database: { active: false, message: 'Database monitoring stopped' } },
            timestamp: Date.now()
          });
        }
        break;

      case 'get_current_metrics':
        this.sendMessage(ws, {
          type: 'status_update',
          data: {
            system: {
              active: resourceMonitor.isActive(),
              current: resourceMonitor.getLatestMetrics(),
              history: resourceMonitor.getMetricsHistory(message.limit || 10)
            },
            database: this.dbMonitor ? {
              available: true,
              active: this.dbMonitor.isActive(),
              current: this.dbMonitor.getLatestMetrics(),
              history: this.dbMonitor.getMetricsHistory(message.limit || 10)
            } : {
              available: false
            }
          },
          timestamp: Date.now()
        });
        break;

      case 'update_thresholds':
        if (message.system) {
          resourceMonitor.updateAlertThresholds(message.system);
        }
        if (message.database && this.dbMonitor) {
          this.dbMonitor.updateAlertThresholds(message.database);
        }
        this.sendMessage(ws, {
          type: 'status_update',
          data: { message: 'Thresholds updated successfully' },
          timestamp: Date.now()
        });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private broadcast(message: MonitoringWebSocketMessage): void {
    const messageString = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });
  }

  private sendMessage(ws: WebSocket, message: MonitoringWebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message to client:', error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'status_update',
      data: { error },
      timestamp: Date.now()
    });
  }

  // Get connection statistics
  getStats(): { connectedClients: number; isActive: boolean } {
    return {
      connectedClients: this.clients.size,
      isActive: this.wss.clients.size > 0
    };
  }

  // Close all connections and shutdown
  close(): void {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    
    this.wss.close(() => {
      console.log('Monitoring WebSocket server closed');
    });
  }
} 