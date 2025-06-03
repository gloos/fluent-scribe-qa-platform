import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cluster from 'cluster';
import { ApiAuthMiddleware, AuthenticatedRequest } from '../lib/middleware/apiAuthMiddleware';
import { RateLimitMiddleware } from '../lib/middleware/rateLimitMiddleware';
import { ApiKeyService } from '../lib/services/apiKeyService';
import { ApiVersionMiddleware, VersionedRequest } from '../lib/middleware/apiVersionMiddleware';
import { ApiVersionConfiguration } from '../lib/config/apiVersionConfig';
import { securityRouter } from './routes/security';
import { monitoringRouter } from './routes/monitoring';
import { cdnRouter } from './routes/cdn';
import { MonitoringWebSocketServer } from './websocketServer';
import { createServer } from 'http';
import { autoscalingIntegration } from '../services/autoscalingIntegration';
import { cdnService } from '../services/cdnService';

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server instance
const server = createServer(app);

// Initialize WebSocket server for monitoring
let wsServer: MonitoringWebSocketServer | null = null;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for processing
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept XLIFF, TMX, and CSV files
    const allowedTypes = [
      'application/xml', 
      'text/xml', 
      'application/x-xliff+xml',
      'text/csv',
      'application/csv',
      'text/plain'
    ];
    const allowedExtensions = ['.xliff', '.xlf', '.mxliff', '.tmx', '.csv'];
    
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (allowedTypes.includes(file.mimetype) || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Allowed types: ${allowedExtensions.join(', ')}`));
    }
  }
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AI-Powered Linguistic QA Platform API',
      version: '1.0.0',
      description: `
        RESTful API for the AI-Powered Linguistic QA Platform, enabling external integrations for XLIFF file processing, 
        quality assessment workflows, and MQM (Multidimensional Quality Metrics) scoring.
        
        This platform processes translation files using advanced LLMs to provide detailed quality assessment reports.
        
        ## Authentication
        
        The API supports two authentication methods:
        
        ### JWT Bearer Token
        Include the JWT token in the Authorization header:
        \`\`\`
        Authorization: Bearer <your-jwt-token>
        \`\`\`
        
        ### API Key
        Include your API key in the X-API-Key header:
        \`\`\`
        X-API-Key: <your-api-key>
        \`\`\`
        
        ## Rate Limiting
        
        The API implements comprehensive rate limiting:
        - **Global**: 1000 requests/hour per IP
        - **Auth endpoints**: 10 requests/15min per IP
        - **User endpoints**: 1000 requests/hour per user
        - **API keys**: Custom limits per key + usage tracking
      `,
      contact: {
        name: 'QA Platform Support',
        email: 'support@qa-platform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://staging-api.qa-platform.com/v1',
        description: 'Staging server'
      },
      {
        url: 'https://api.qa-platform.com/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'validation_error'
                },
                message: {
                  type: 'string',
                  example: 'Request validation failed'
                },
                details: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Email is required']
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z'
            }
          }
        },
        RateLimitError: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'rate_limit_exceeded'
                },
                message: {
                  type: 'string',
                  example: 'Too many requests. Please try again later.'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            retryAfter: {
              type: 'integer',
              example: 60,
              description: 'Seconds to wait before retrying'
            }
          }
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'key-uuid-here'
            },
            name: {
              type: 'string',
              example: 'Production API Key'
            },
            description: {
              type: 'string',
              example: 'API key for production integration'
            },
            permissions: {
              type: 'array',
              items: { type: 'string' },
              example: ['read:files', 'write:assessments']
            },
            rate_limit_per_minute: {
              type: 'integer',
              example: 100
            },
            rate_limit_per_hour: {
              type: 'integer',
              example: 5000
            },
            rate_limit_per_day: {
              type: 'integer',
              example: 100000
            },
            usage_count: {
              type: 'integer',
              example: 1250
            },
            last_used_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T09:30:00Z'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              nullable: true
            }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] }
    ]
  },
  apis: ['./src/server/app.ts', './docs/api-specification.yaml'] // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(swaggerOptions);

// Security middleware
// Enhanced security headers configuration with comprehensive CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite in development and some React functionality
        "'unsafe-eval'", // Required for development builds and some libraries
        "https://cdn.gpteng.co", // Required for Lovable platform integration
        "https://cdn.jsdelivr.net", // CDN for libraries
        "https://unpkg.com" // CDN for libraries
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and dynamic styles
        "https://fonts.googleapis.com" // Google Fonts
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com" // Google Fonts
      ],
      imgSrc: [
        "'self'",
        "data:", // Data URLs for images
        "https:", // Allow HTTPS images
        "blob:", // Blob URLs for generated images/documents
        "https://lovable.dev" // OpenGraph images
      ],
      connectSrc: [
        "'self'",
        "https://*.supabase.co", // Supabase backend
        "wss://*.supabase.co", // Supabase WebSocket connections
        "https://api.openai.com", // OpenAI API
        "https://api.anthropic.com", // Anthropic API
        "https://generativelanguage.googleapis.com", // Google Gemini API
        "https://api.pwnedpasswords.com", // Password breach checking
        "https://api.ipify.org", // IP address detection
        "https://invoice.stripe.com", // Stripe invoice URLs
        "https://pay.stripe.com", // Stripe payment URLs
        process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : '' // Vite HMR in development
      ].filter(Boolean),
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      basUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent embedding in frames
      ...(process.env.NODE_ENV === 'production' && { upgradeInsecureRequests: [] })
    }
  },
  crossOriginEmbedderPolicy: false, // Disabled to allow external resources
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));

// Additional modern security headers
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ].join(', '));

  // Cross-Origin-Embedder-Policy for enhanced security (disabled above in helmet for compatibility)
  // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Security-focused headers
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Clear potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
});

// CORS configuration with enhanced security
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent'
  ],
  exposedHeaders: [
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Response-Time'
  ],
  maxAge: 86400 // 24 hours for preflight cache
}));

// Basic middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize and configure CDN service
cdnService.initialize();

// Add CDN middleware for static asset delivery and caching
app.use(cdnService.createStaticMiddleware());

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'QA Platform API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true
  }
}));

// Redirect root docs path to the full docs
app.get('/docs', (req, res) => {
  res.redirect('/api/docs');
});

// Global rate limiting for all requests (protection against DDoS)
app.use(RateLimitMiddleware.create(RateLimitMiddleware.presets.lenient));

// Security headers and response recording
app.use(ApiAuthMiddleware.securityHeaders());
app.use(ApiAuthMiddleware.recordResponse());

// API Versioning middleware - applies to all /api/* routes
app.use('/api', ApiVersionMiddleware.extractVersion);

// Initialize autoscaling integration
autoscalingIntegration.initialize();

// Add autoscaling middleware for load balancing and response time tracking
app.use(autoscalingIntegration.createMiddleware());

// Add autoscaling management routes
autoscalingIntegration.addRoutes(app);

// API routes
// app.use('/api/v1/qa', qaSessionRouter);
// app.use('/api/v1/files', fileUploadRouter);
// app.use('/api/v1/transcription', transcriptionRouter);
app.use('/api/v1/security', securityRouter);
app.use('/api/v1/monitoring', monitoringRouter);
app.use('/api/v1/cdn', cdnRouter);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API and its dependent services
 *     tags:
 *       - System
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T10:30:00Z
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       example: healthy
 *                     llm_provider:
 *                       type: string
 *                       example: healthy
 *                     file_storage:
 *                       type: string
 *                       example: healthy
 *             examples:
 *               healthy:
 *                 summary: Healthy API response
 *                 value:
 *                   status: healthy
 *                   timestamp: 2024-01-15T10:30:00Z
 *                   version: 1.0.0
 *                   services:
 *                     database: healthy
 *                     llm_provider: healthy
 *                     file_storage: healthy
 */
// Health check endpoint (no auth required, but with moderate rate limiting)
app.get('/api/v1/health', 
  RateLimitMiddleware.forEndpoint('health', RateLimitMiddleware.presets.standard),
  (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'healthy', // TODO: Add actual health checks
        llm_provider: 'healthy',
        file_storage: 'healthy'
      }
    });
  }
);

/**
 * @swagger
 * /version:
 *   get:
 *     summary: API version information
 *     description: Returns comprehensive information about API versions, deprecation policies, and migration paths
 *     tags:
 *       - System
 *     security: []
 *     responses:
 *       200:
 *         description: API version information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 current:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 *                     isLatest:
 *                       type: boolean
 *                       example: true
 *                     isDeprecated:
 *                       type: boolean
 *                       example: false
 *                 configuration:
 *                   type: object
 *                   properties:
 *                     strategy:
 *                       type: object
 *                     supported:
 *                       type: array
 *                       items:
 *                         type: object
 *                     planned:
 *                       type: array
 *                       items:
 *                         type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// API version information endpoint
app.get('/api/v1/version', 
  RateLimitMiddleware.forEndpoint('version', RateLimitMiddleware.presets.standard),
  (req: VersionedRequest, res) => {
    const config = ApiVersionConfiguration.getConfiguration();
    const currentVersion = req.apiVersion || { 
      full: '1.0.0', 
      isLatest: true, 
      isDeprecated: false 
    };

    const response: any = {
      current: {
        version: currentVersion.full,
        isLatest: currentVersion.isLatest,
        isDeprecated: currentVersion.isDeprecated
      },
      configuration: {
        strategy: config.strategy,
        supported: config.supported,
        planned: config.planned,
        migrations: config.migrations,
        endpoints: config.endpoints
      },
      timestamp: new Date().toISOString()
    };

    // Add optional deprecation dates if they exist
    if ('deprecationDate' in currentVersion && currentVersion.deprecationDate) {
      response.current.deprecationDate = currentVersion.deprecationDate;
    }
    if ('sunsetDate' in currentVersion && currentVersion.sunsetDate) {
      response.current.sunsetDate = currentVersion.sunsetDate;
    }

    res.json(response);
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User authentication
 *     description: Authenticate user with email and password. Returns JWT tokens for API access.
 *     tags:
 *       - Authentication
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: your-secure-password
 *           examples:
 *             login:
 *               summary: Login request
 *               value:
 *                 email: user@example.com
 *                 password: your-secure-password
 *     responses:
 *       200:
 *         description: Successful authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refresh_token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: user-uuid-here
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       501:
 *         description: Not yet implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Authentication endpoints (strict rate limiting to prevent brute force)
app.post('/api/v1/auth/login', 
  RateLimitMiddleware.forEndpoint('auth-login', RateLimitMiddleware.presets.auth),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          error: {
            code: 'validation_error',
            message: 'Email and password are required',
            details: [
              ...(email ? [] : ['Email is required']),
              ...(password ? [] : ['Password is required'])
            ]
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: {
            code: 'validation_error',
            message: 'Invalid email format',
            details: ['Please provide a valid email address']
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Import AuthService dynamically to avoid circular dependencies
      const { AuthService } = await import('../lib/authService');
      
      // Attempt secure login
      const result = await AuthService.prototype.secureLogin(email, password);

      if (!result.success) {
        const statusCode = result.securityInfo?.locked ? 423 : 401;
        res.status(statusCode).json({
          error: {
            code: result.securityInfo?.locked ? 'account_locked' : 'authentication_failed',
            message: result.error?.message || 'Invalid credentials'
          },
          timestamp: new Date().toISOString(),
          ...(result.securityInfo?.lockout_duration && {
            retryAfter: result.securityInfo.lockout_duration
          })
        });
        return;
      }

      // Success - return tokens and user info
      const { session, user } = result.data;
      
      res.json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: {
          id: user.id,
          email: user.email,
          ...(user.user_metadata && { metadata: user.user_metadata })
        },
        expires_at: session.expires_at,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Login failed due to server error'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     description: Invalidate current user session and JWT token
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully logged out
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/v1/auth/logout', 
  ApiAuthMiddleware.authenticate(), 
  RateLimitMiddleware.forUser(),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Import supabase for auth operations
      const { supabase } = await import('../lib/supabase');
      
      // If user is authenticated via JWT token, sign them out
      if (req.auth?.authMethod === 'jwt' && req.auth.session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('Supabase signOut error:', error.message);
          // Continue with successful response even if signOut fails
          // as the client-side token will be discarded anyway
        }
      }

      res.json({
        message: 'Successfully logged out',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Logout failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api-keys:
 *   get:
 *     summary: List API keys
 *     description: Retrieve all API keys for the authenticated user, including usage statistics and metadata
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             examples:
 *               api_keys_list:
 *                 summary: List of API keys
 *                 value:
 *                   api_keys:
 *                     - id: "key-123e4567-e89b-12d3-a456-426614174000"
 *                       name: "Production API Key"
 *                       description: "API key for production integration"
 *                       permissions: ["read:files", "write:assessments"]
 *                       rate_limit_per_minute: 100
 *                       rate_limit_per_hour: 5000
 *                       rate_limit_per_day: 100000
 *                       usage_count: 1250
 *                       last_used_at: "2024-01-15T09:30:00Z"
 *                       created_at: "2024-01-01T00:00:00Z"
 *                       expires_at: null
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// API Key Management endpoints (authenticated users only with user-specific rate limits)
app.get('/api/v1/api-keys', 
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

      const result = await ApiKeyService.listApiKeys(req.auth.userId);
      if (result.success) {
        res.json({
          api_keys: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'api_keys_error',
            message: 'Failed to retrieve API keys'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('API keys list error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to retrieve API keys'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api-keys:
 *   post:
 *     summary: Create API key
 *     description: Generate a new API key with specified permissions and rate limits. The API key value is only returned once and cannot be retrieved again.
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Human-readable name for the API key
 *                 example: "Production Integration"
 *               description:
 *                 type: string
 *                 description: Optional description of the API key's purpose
 *                 example: "API key for production environment integration"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permission strings
 *                 example: ["read:files", "write:assessments", "read:reports"]
 *               rate_limit_per_minute:
 *                 type: integer
 *                 description: Requests allowed per minute
 *                 example: 100
 *                 minimum: 1
 *                 maximum: 1000
 *               rate_limit_per_hour:
 *                 type: integer
 *                 description: Requests allowed per hour
 *                 example: 5000
 *                 minimum: 60
 *                 maximum: 100000
 *               rate_limit_per_day:
 *                 type: integer
 *                 description: Requests allowed per day
 *                 example: 100000
 *                 minimum: 1440
 *                 maximum: 1000000
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date for the API key
 *                 example: "2025-01-15T00:00:00Z"
 *           examples:
 *             create_api_key:
 *               summary: Create production API key
 *               value:
 *                 name: "Production API Key"
 *                 description: "API key for production integration"
 *                 permissions: ["read:files", "write:assessments"]
 *                 rate_limit_per_minute: 100
 *                 rate_limit_per_hour: 5000
 *                 rate_limit_per_day: 100000
 *                 expires_at: "2025-12-31T23:59:59Z"
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   type: string
 *                   description: The actual API key value (only shown once)
 *                   example: "qa_live_1234567890abcdef..."
 *                 key_info:
 *                   $ref: '#/components/schemas/ApiKey'
 *                 message:
 *                   type: string
 *                   example: "API key created successfully. Save this key - it will not be shown again."
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error or creation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/v1/api-keys', 
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

      const { name, description, permissions, rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day, expires_at } = req.body;

      if (!name) {
        res.status(400).json({
          error: {
            code: 'validation_error',
            message: 'API key name is required'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const result = await ApiKeyService.createApiKey(req.auth.userId, {
        name,
        description,
        permissions,
        rate_limit_per_minute,
        rate_limit_per_hour,
        rate_limit_per_day,
        expires_at
      });

      if (result.success) {
        res.status(201).json({
          api_key: result.apiKey, // Only time the actual key is returned
          key_info: result.data,
          message: 'API key created successfully. Save this key - it will not be shown again.',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'creation_error',
            message: 'Failed to create API key'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('API key creation error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to create API key'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api-keys/{keyId}:
 *   get:
 *     summary: Get API key details
 *     description: Retrieve detailed information about a specific API key including usage statistics
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique API key identifier
 *         example: "key-123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: API key details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   $ref: '#/components/schemas/ApiKey'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             examples:
 *               api_key_details:
 *                 summary: API key details
 *                 value:
 *                   api_key:
 *                     id: "key-123e4567-e89b-12d3-a456-426614174000"
 *                     name: "Production API Key"
 *                     description: "API key for production integration"
 *                     permissions: ["read:files", "write:assessments"]
 *                     rate_limit_per_minute: 100
 *                     rate_limit_per_hour: 5000
 *                     rate_limit_per_day: 100000
 *                     usage_count: 1250
 *                     last_used_at: "2024-01-15T09:30:00Z"
 *                     created_at: "2024-01-01T00:00:00Z"
 *                     expires_at: null
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/v1/api-keys/:keyId', 
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

      const { keyId } = req.params;
      const result = await ApiKeyService.getApiKey(keyId, req.auth.userId);

      if (result.success) {
        res.json({
          api_key: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          error: {
            code: 'not_found',
            message: 'API key not found'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('API key get error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to retrieve API key'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api-keys/{keyId}:
 *   patch:
 *     summary: Update API key
 *     description: Update API key configuration including name, description, permissions, and rate limits
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique API key identifier
 *         example: "key-123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated name for the API key
 *                 example: "Updated Production Key"
 *               description:
 *                 type: string
 *                 description: Updated description
 *                 example: "Updated description for production API key"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated permission array
 *                 example: ["read:files", "write:assessments", "read:reports"]
 *               rate_limit_per_minute:
 *                 type: integer
 *                 description: Updated per-minute rate limit
 *                 example: 150
 *               rate_limit_per_hour:
 *                 type: integer
 *                 description: Updated per-hour rate limit
 *                 example: 7500
 *               rate_limit_per_day:
 *                 type: integer
 *                 description: Updated per-day rate limit
 *                 example: 150000
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Updated expiration date
 *                 nullable: true
 *                 example: "2025-12-31T23:59:59Z"
 *           examples:
 *             update_api_key:
 *               summary: Update API key limits
 *               value:
 *                 name: "Updated Production Key"
 *                 rate_limit_per_minute: 150
 *                 rate_limit_per_hour: 7500
 *                 permissions: ["read:files", "write:assessments", "read:reports"]
 *     responses:
 *       200:
 *         description: API key updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_key:
 *                   $ref: '#/components/schemas/ApiKey'
 *                 message:
 *                   type: string
 *                   example: "API key updated successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Update validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.patch('/api/v1/api-keys/:keyId', 
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

      const { keyId } = req.params;
      const updates = req.body;

      const result = await ApiKeyService.updateApiKey(keyId, req.auth.userId, updates);

      if (result.success) {
        res.json({
          api_key: result.data,
          message: 'API key updated successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'update_error',
            message: 'Failed to update API key'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('API key update error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to update API key'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /api-keys/{keyId}:
 *   delete:
 *     summary: Delete API key
 *     description: Permanently delete an API key. This action cannot be undone and will immediately invalidate the key.
 *     tags:
 *       - API Keys
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique API key identifier
 *         example: "key-123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "API key deleted successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             examples:
 *               api_key_deleted:
 *                 summary: Successful deletion
 *                 value:
 *                   message: "API key deleted successfully"
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Deletion failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.delete('/api/v1/api-keys/:keyId', 
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

      const { keyId } = req.params;
      const result = await ApiKeyService.deleteApiKey(keyId, req.auth.userId);

      if (result.success) {
        res.json({
          message: 'API key deleted successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: {
            code: 'deletion_error',
            message: 'Failed to delete API key'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('API key deletion error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to delete API key'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @swagger
 * /files:
 *   get:
 *     summary: List uploaded files
 *     description: Retrieve a paginated list of uploaded files with their processing status and metadata
 *     tags:
 *       - Files
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of files per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by processing status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [xliff, tmx, csv]
 *         description: Filter by file type
 *     responses:
 *       200:
 *         description: Successfully retrieved files list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       filename:
 *                         type: string
 *                       size:
 *                         type: integer
 *                       type:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, processing, completed, failed]
 *                       uploaded_at:
 *                         type: string
 *                         format: date-time
 *                       processed_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       501:
 *         description: Endpoint not yet implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: Upload file
 *     description: Upload a translation file (XLIFF, TMX, or CSV) for quality assessment processing
 *     tags:
 *       - Files
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload (XLIFF, TMX, or CSV)
 *               description:
 *                 type: string
 *                 description: Optional description of the file
 *               auto_process:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to automatically start processing after upload
 *               webhook_url:
 *                 type: string
 *                 format: uri
 *                 description: Optional webhook URL for processing notifications
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 file:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     filename:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     type:
 *                       type: string
 *                     status:
 *                       type: string
 *                     uploaded_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "File uploaded successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid file or upload error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       501:
 *         description: Endpoint not yet implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Protected API endpoints (require authentication)
app.get('/api/v1/files', 
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

      const {
        page = 1,
        limit = 20,
        status,
        type
      } = req.query;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100); // Max 100 per page
      const offset = (pageNum - 1) * limitNum;

      const { supabase } = await import('../lib/supabase');

      // Build query
      let query = supabase
        .from('file_uploads')
        .select('*', { count: 'exact' })
        .eq('user_id', req.auth.userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (status && typeof status === 'string') {
        query = query.eq('upload_status', status);
      }

      if (type && typeof type === 'string') {
        query = query.eq('file_type', type);
      }

      // Apply pagination
      query = query.range(offset, offset + limitNum - 1);

      const { data: files, error, count } = await query;

      if (error) {
        console.error('Database error listing files:', error);
        res.status(500).json({
          error: {
            code: 'database_error',
            message: 'Failed to retrieve files'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Transform files for response
      const transformedFiles = (files || []).map(file => ({
        id: file.id,
        filename: file.original_filename,
        size: file.file_size,
        type: file.file_type,
        status: file.upload_status,
        uploaded_at: file.created_at,
        processed_at: file.processed_at,
        description: file.description,
        auto_process: file.auto_process
      }));

      const totalPages = Math.ceil((count || 0) / limitNum);

      res.json({
        files: transformedFiles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          pages: totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Files list error:', error);
      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Failed to list files'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.post('/api/v1/files', 
  ApiAuthMiddleware.authenticate(),
  RateLimitMiddleware.forUser(),
  upload.single('file'), // Handle single file upload
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'unauthorized', message: 'Authentication required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: {
            code: 'validation_error',
            message: 'No file provided',
            details: ['File is required for upload']
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { description, auto_process = true, webhook_url } = req.body;
      const userId = req.auth.userId;

      // Import required services
      const { supabase } = await import('../lib/supabase');
      const { uploadFile } = await import('../lib/storage');

      // Validate file content (basic validation)
      const fileContent = req.file.buffer.toString('utf8');
      const isXLIFF = fileContent.includes('<xliff') || fileContent.includes('<?xml');
      const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
      const isTMX = fileContent.includes('<tmx') || req.file.originalname.toLowerCase().endsWith('.tmx');

      if (!isXLIFF && !isCSV && !isTMX) {
        res.status(400).json({
          error: {
            code: 'validation_error',
            message: 'Invalid file format',
            details: ['File must be a valid XLIFF, TMX, or CSV file']
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Create File object for upload
      const file = new File([req.file.buffer], req.file.originalname, {
        type: req.file.mimetype
      });

      // Upload to storage
      const uploadResult = await uploadFile(file, 'qa-files', `user-${userId}`);
      
      if (uploadResult.error) {
        res.status(500).json({
          error: {
            code: 'upload_error',
            message: 'Failed to upload file to storage',
            details: [uploadResult.error.message]
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Determine file type
      let fileType = 'unknown';
      if (isXLIFF) fileType = 'xliff';
      else if (isCSV) fileType = 'csv';
      else if (isTMX) fileType = 'tmx';

      // Create database record
      const { data: fileRecord, error: dbError } = await supabase
        .from('file_uploads')
        .insert({
          user_id: userId,
          original_filename: req.file.originalname,
          stored_filename: uploadResult.data?.path || '',
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          file_type: fileType,
          storage_bucket: 'qa-files',
          storage_path: uploadResult.data?.path || '',
          upload_status: 'uploaded',
          description: description || null,
          auto_process: auto_process,
          webhook_url: webhook_url || null,
          metadata: {
            contentType: req.file.mimetype,
            encoding: req.file.encoding || 'utf8'
          }
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error creating file record:', dbError);
        res.status(500).json({
          error: {
            code: 'database_error',
            message: 'Failed to create file record'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // If auto_process is enabled, queue for processing
      if (auto_process) {
        // TODO: Add to processing queue
        console.log('File queued for processing:', fileRecord.id);
      }

      res.status(201).json({
        file: {
          id: fileRecord.id,
          filename: fileRecord.original_filename,
          size: fileRecord.file_size,
          type: fileRecord.file_type,
          status: fileRecord.upload_status,
          uploaded_at: fileRecord.created_at,
          description: fileRecord.description,
          auto_process: fileRecord.auto_process
        },
        message: 'File uploaded successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('File upload error:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: {
              code: 'file_too_large',
              message: 'File size exceeds maximum limit of 50MB'
            },
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'File upload failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Endpoint not found'
    },
    timestamp: new Date().toISOString()
  });
});

// Start server (check if this file is being run directly)
const isMain = process.argv[1] && process.argv[1].endsWith('app.ts');
if ((isMain || process.env.NODE_ENV !== 'test') && cluster.isPrimary) {
  server.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🔐 Authentication: JWT Bearer tokens and X-API-Key headers supported`);
    console.log(`🛡️  Rate limiting: Comprehensive rate limiting active for all endpoints`);
    console.log(`   • Global: 1000 requests/hour per IP`);
    console.log(`   • Auth endpoints: 10 requests/15min per IP`);
    console.log(`   • User endpoints: 1000 requests/hour per user`);
    console.log(`   • API keys: Custom limits per key + usage tracking`);
    console.log(`📊 Monitoring: Resource monitoring API available at /api/v1/monitoring`);
    
    // Initialize WebSocket server for real-time monitoring
    try {
      wsServer = new MonitoringWebSocketServer(server);
      console.log(`🔄 WebSocket: Real-time monitoring available at ws://localhost:${PORT}/api/v1/monitoring/ws`);
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
    }
  });
} else if (!cluster.isPrimary) {
  console.log(`🔧 Worker process ${process.pid} initialized (cluster worker ${cluster.worker?.id})`);
}

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  
  // Shutdown autoscaling system
  try {
    await autoscalingIntegration.gracefulShutdown();
    console.log('Autoscaling system shut down');
  } catch (error) {
    console.error('Error shutting down autoscaling system:', error);
  }
  
  if (wsServer) {
    wsServer.close();
  }
  
  if (cluster.isPrimary) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
export { server };