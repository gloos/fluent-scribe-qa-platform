# Security Configuration Guide

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Authentication Configuration](#authentication-configuration)
4. [Database Security Configuration](#database-security-configuration)
5. [Security Headers Configuration](#security-headers-configuration)
6. [Monitoring and Logging Configuration](#monitoring-and-logging-configuration)
7. [API Security Configuration](#api-security-configuration)
8. [Production Hardening](#production-hardening)
9. [Development Environment Security](#development-environment-security)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide provides detailed instructions for configuring security features in the Fluent Scribe QA Platform. It covers environment setup, security controls configuration, and production hardening requirements.

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Supabase project setup
- Domain and SSL certificates (for production)
- Administrative access to deployment environment

### Security Configuration Checklist

#### Initial Setup
- [ ] Environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Database security enabled
- [ ] Authentication providers configured
- [ ] Security headers implemented
- [ ] Monitoring and logging configured
- [ ] API rate limiting enabled
- [ ] Backup and recovery procedures established

#### Production Hardening
- [ ] Security headers optimized
- [ ] Rate limiting tuned for production load
- [ ] Database hardening completed
- [ ] Security monitoring alerts configured
- [ ] Incident response procedures activated
- [ ] Regular security scans scheduled
- [ ] Compliance controls verified

## Environment Setup

### Environment Variables

Create environment configuration files for different deployment stages:

#### Development Environment (`.env.development`)
```bash
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/fluent_scribe_dev"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Authentication
JWT_SECRET="your-development-jwt-secret-at-least-32-characters"
JWT_EXPIRES_IN="8h"
SESSION_SECRET="your-session-secret-for-development"

# Security Settings
SECURITY_LEVEL="development"
ENABLE_SECURITY_HEADERS="true"
ENABLE_RATE_LIMITING="false"
ENABLE_AUDIT_LOGGING="true"

# Two-Factor Authentication
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
EMAIL_SERVICE_API_KEY="your-email-service-key"

# Monitoring
LOG_LEVEL="debug"
ENABLE_PERFORMANCE_MONITORING="true"
```

#### Production Environment (`.env.production`)
```bash
# Database Configuration
DATABASE_URL="postgresql://user:secure_password@prod-db:5432/fluent_scribe_prod"
SUPABASE_URL="https://your-prod-project.supabase.co"
SUPABASE_ANON_KEY="your-production-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-production-service-role-key"

# Authentication
JWT_SECRET="your-extremely-secure-production-jwt-secret-minimum-64-characters"
JWT_EXPIRES_IN="1h"
SESSION_SECRET="your-highly-secure-session-secret-for-production"

# Security Settings
SECURITY_LEVEL="production"
ENABLE_SECURITY_HEADERS="true"
ENABLE_RATE_LIMITING="true"
ENABLE_AUDIT_LOGGING="true"
ENABLE_DEVICE_FINGERPRINTING="true"

# Two-Factor Authentication
TWILIO_ACCOUNT_SID="your-production-twilio-sid"
TWILIO_AUTH_TOKEN="your-production-twilio-token"
EMAIL_SERVICE_API_KEY="your-production-email-service-key"

# Monitoring
LOG_LEVEL="warn"
ENABLE_PERFORMANCE_MONITORING="true"
SECURITY_ALERTS_WEBHOOK="https://your-alerting-system.com/webhook"

# Production Hardening
RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
RATE_LIMIT_MAX="100"           # requests per window
SESSION_TIMEOUT_MS="3600000"   # 1 hour
MAX_LOGIN_ATTEMPTS="5"
ACCOUNT_LOCKOUT_DURATION="1800000"  # 30 minutes
```

### Security Environment Variables

#### Required Security Variables
```bash
# Cryptographic Keys
JWT_SECRET=""              # Minimum 32 characters, 64+ for production
SESSION_SECRET=""          # Minimum 32 characters
ENCRYPTION_KEY=""          # For data encryption at rest

# External Service Authentication
TWILIO_ACCOUNT_SID=""      # For SMS 2FA
TWILIO_AUTH_TOKEN=""       # For SMS 2FA
EMAIL_SERVICE_API_KEY=""   # For email notifications

# Security Configuration
SECURITY_LEVEL="production"         # production|development|testing
ENABLE_SECURITY_HEADERS="true"     # Enable security headers
ENABLE_RATE_LIMITING="true"        # Enable API rate limiting
ENABLE_AUDIT_LOGGING="true"        # Enable comprehensive audit logging
ENABLE_DEVICE_FINGERPRINTING="true" # Enable device tracking

# Monitoring and Alerting
SECURITY_ALERTS_WEBHOOK=""         # Webhook for security alerts
LOG_RETENTION_DAYS="90"            # Log retention period
SECURITY_SCAN_INTERVAL="24"        # Hours between scans
```

#### Optional Security Variables
```bash
# Advanced Security Features
ENABLE_PENETRATION_TESTING="true"  # Enable automated pen testing
VULNERABILITY_SCAN_API_KEY=""      # External vulnerability scanning
THREAT_INTELLIGENCE_API_KEY=""     # Threat intelligence feeds

# Compliance and Auditing
COMPLIANCE_MODE="SOC2"             # SOC2|ISO27001|GDPR
AUDIT_EXPORT_ENDPOINT=""           # External audit log export
COMPLIANCE_REPORTING_WEBHOOK=""     # Compliance reporting endpoint

# Development and Testing
SECURITY_TEST_MODE="false"         # Enable security testing mode
MOCK_EXTERNAL_SERVICES="false"     # Mock external security services
DISABLE_SECURITY_IN_TESTS="false"  # Disable security for unit tests
```

## Authentication Configuration

### JWT Configuration

#### JWT Token Settings
```typescript
// src/lib/security/jwt-config.ts
export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  issuer: 'fluent-scribe-qa-platform',
  audience: 'fluent-scribe-users',
  algorithm: 'HS256' as const,
  
  // Security settings
  clockTolerance: 30, // seconds
  ignoreExpiration: false,
  ignoreNotBefore: false,
};

// Token refresh configuration
export const refreshTokenConfig = {
  expiresIn: '7d',
  rotateRefreshToken: true,
  revokeRefreshTokenOnUse: true,
};
```

#### Session Configuration
```typescript
// src/lib/security/session-config.ts
export const sessionConfig = {
  secret: process.env.SESSION_SECRET!,
  name: 'fluent-scribe-session',
  resave: false,
  saveUninitialized: false,
  
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,                                // Prevent XSS
    maxAge: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000'), // 1 hour
    sameSite: 'strict' as const,                   // CSRF protection
  },
  
  // Enhanced security
  rolling: true,        // Reset expiration on activity
  genid: () => crypto.randomUUID(), // Custom session ID generation
};
```

### Two-Factor Authentication Setup

#### TOTP Configuration
```typescript
// src/lib/security/totp-config.ts
export const totpConfig = {
  issuer: 'Fluent Scribe QA Platform',
  algorithm: 'sha1' as const,
  digits: 6,
  period: 30,
  window: 2, // Allow 1 step before and after current time
};

// QR Code configuration
export const qrCodeConfig = {
  errorCorrectionLevel: 'M' as const,
  type: 'image/png' as const,
  quality: 0.92,
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: 256
};
```

#### SMS Configuration (Twilio)
```typescript
// src/lib/security/sms-config.ts
export const smsConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: process.env.TWILIO_FROM_NUMBER!,
  
  // Message configuration
  messageTemplate: 'Your Fluent Scribe verification code is: {code}',
  codeLength: 6,
  codeExpiration: 300000, // 5 minutes
  
  // Rate limiting for SMS
  maxSmsPerHour: 5,
  maxSmsPerDay: 20,
};
```

#### Email Configuration
```typescript
// src/lib/security/email-config.ts
export const emailConfig = {
  serviceApiKey: process.env.EMAIL_SERVICE_API_KEY!,
  fromAddress: 'security@fluent-scribe.com',
  fromName: 'Fluent Scribe Security',
  
  // Email templates
  templates: {
    twoFactor: 'two-factor-verification',
    passwordReset: 'password-reset',
    securityAlert: 'security-alert',
    newDevice: 'new-device-login',
  },
  
  // Configuration
  codeExpiration: 600000, // 10 minutes
  maxEmailsPerHour: 10,
};
```

## Database Security Configuration

### Supabase Security Setup

#### Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- User data access policy
CREATE POLICY "Users can only access their own data" ON users
FOR ALL USING (auth.uid() = id);

-- Session data access policy
CREATE POLICY "Users can only access their own sessions" ON user_sessions
FOR ALL USING (auth.uid() = user_id);

-- Security events read-only policy
CREATE POLICY "Users can read their own security events" ON security_events
FOR SELECT USING (auth.uid() = user_id);

-- Audit logs are admin-only
CREATE POLICY "Only admins can access audit logs" ON audit_logs
FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

#### Database Connection Security
```typescript
// src/lib/database/security-config.ts
export const databaseSecurityConfig = {
  // Connection security
  ssl: {
    require: true,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
  
  // Connection pooling
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Query security
  statement_timeout: 30000, // 30 seconds
  query_timeout: 30000,     // 30 seconds
  idle_in_transaction_session_timeout: 60000, // 1 minute
};
```

### Database Backup Security
```bash
#!/bin/bash
# scripts/secure-backup.sh

# Encrypted database backup
pg_dump $DATABASE_URL | \
  gpg --cipher-algo AES256 --compress-algo 1 --s2k-digest-algo SHA512 \
      --symmetric --armor --output "backup-$(date +%Y%m%d).sql.gpg"

# Upload to secure storage
aws s3 cp "backup-$(date +%Y%m%d).sql.gpg" \
  s3://your-secure-backup-bucket/ \
  --server-side-encryption AES256 \
  --storage-class STANDARD_IA

# Remove local copy
rm "backup-$(date +%Y%m%d).sql.gpg"
```

## Security Headers Configuration

### Helmet.js Configuration
```typescript
// src/server/middleware/security-headers.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Only for development
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:"
      ],
      connectSrc: [
        "'self'",
        "https://api.fluent-scribe.com",
        "wss://api.fluent-scribe.com"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
    reportOnly: process.env.NODE_ENV === 'development',
  },

  // HTTP Strict Transport Security
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // Cross-Origin policies
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: { policy: "require-corp" },

  // Other security headers
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  
  // Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    notifications: ["'self'"],
    payment: [],
    usb: [],
  },

  // Hide X-Powered-By
  hidePoweredBy: true,
});

// Development-specific adjustments
if (process.env.NODE_ENV === 'development') {
  // Relax CSP for development
  securityHeaders.contentSecurityPolicy.directives.scriptSrc.push("'unsafe-eval'");
}
```

### Custom Security Headers
```typescript
// src/server/middleware/custom-headers.ts
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Custom application headers
  res.setHeader('X-Application-Version', process.env.npm_package_version || '1.0.0');
  res.setHeader('X-Security-Policy', 'https://fluent-scribe.com/security-policy');
  
  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  
  next();
};
```

## Monitoring and Logging Configuration

### Security Logger Configuration
```typescript
// src/lib/security/logger-config.ts
export const securityLoggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  
  // Log destinations
  transports: [
    // Console logging
    {
      type: 'console',
      level: 'debug',
      format: 'simple'
    },
    
    // File logging
    {
      type: 'file',
      filename: 'logs/security.log',
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: 'json'
    },
    
    // Error logging
    {
      type: 'file',
      filename: 'logs/security-errors.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: 'json'
    },
    
    // Audit logging
    {
      type: 'file',
      filename: 'logs/audit.log',
      level: 'info',
      maxsize: 52428800, // 50MB
      maxFiles: 20,
      format: 'json'
    }
  ],
  
  // Log rotation
  rotation: {
    frequency: 'daily',
    maxFiles: 30,
    auditFiles: 90
  },
  
  // Security event categories
  categories: {
    authentication: 'auth',
    authorization: 'authz',
    dataAccess: 'data',
    security: 'sec',
    audit: 'audit',
    incident: 'incident'
  }
};
```

### Monitoring Alerts Configuration
```typescript
// src/lib/security/alerts-config.ts
export const alertsConfig = {
  // Alert thresholds
  thresholds: {
    failedLoginAttempts: 5,
    suspiciousActivityScore: 80,
    vulnerabilitySeverity: 'high',
    apiErrorRate: 10, // percentage
    responseTimeMs: 5000
  },
  
  // Alert destinations
  destinations: {
    email: {
      enabled: true,
      recipients: ['security@fluent-scribe.com'],
      severityThreshold: 'medium'
    },
    
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: '#security-alerts',
      severityThreshold: 'high'
    },
    
    webhook: {
      enabled: process.env.SECURITY_ALERTS_WEBHOOK ? true : false,
      url: process.env.SECURITY_ALERTS_WEBHOOK,
      timeout: 5000,
      retries: 3
    }
  },
  
  // Alert rules
  rules: [
    {
      name: 'Multiple Failed Logins',
      condition: 'failed_login_attempts >= 5',
      severity: 'medium',
      cooldown: 300000 // 5 minutes
    },
    {
      name: 'New Device Login',
      condition: 'new_device_login',
      severity: 'low',
      cooldown: 3600000 // 1 hour
    },
    {
      name: 'Critical Vulnerability',
      condition: 'vulnerability_severity = critical',
      severity: 'critical',
      cooldown: 0 // Immediate
    }
  ]
};
```

## API Security Configuration

### Rate Limiting Configuration
```typescript
// src/server/middleware/rate-limiting.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

// Authentication endpoints rate limiting
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
});

// Security API rate limiting
export const securityRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit security operations
  message: {
    error: 'Too many security operations',
    retryAfter: '1 hour'
  },
});
```

### API Authentication Configuration
```typescript
// src/server/middleware/api-auth.ts
export const apiAuthConfig = {
  // JWT validation
  jwt: {
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256'],
    issuer: 'fluent-scribe-qa-platform',
    audience: 'fluent-scribe-users',
    clockTolerance: 30,
  },
  
  // API Key validation
  apiKey: {
    headerName: 'X-API-Key',
    queryParamName: 'api_key',
    prefix: 'fs_', // API key prefix
    length: 32,     // API key length
    expirationDays: 90, // API key expiration
  },
  
  // Session validation
  session: {
    validateDevice: true,
    requireMFA: false, // Can be overridden per endpoint
    maxConcurrentSessions: 5,
  },
  
  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400, // 24 hours
  }
};
```

## Production Hardening

### Production Security Checklist

#### Infrastructure Security
```bash
# 1. Server hardening
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp

# 2. SSL/TLS configuration
# Use Let's Encrypt or commercial certificates
certbot --nginx -d yourdomain.com

# 3. Fail2ban for intrusion prevention
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 4. Regular security updates
sudo apt-get update && sudo apt-get upgrade
```

#### Application Security
```typescript
// src/config/production-security.ts
export const productionSecurityConfig = {
  // Enhanced session security
  session: {
    cookie: {
      secure: true,      // HTTPS only
      httpOnly: true,    // No client-side access
      sameSite: 'strict' // CSRF protection
    },
    rolling: true,       // Reset expiration on activity
    maxAge: 3600000,     // 1 hour
  },
  
  // Strict CSP for production
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Minimize unsafe-inline
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  
  // Production rate limits
  rateLimiting: {
    windowMs: 900000,    // 15 minutes
    max: 100,            // requests per window
    delayMs: 0,          // No delay
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  },
  
  // Enhanced logging
  logging: {
    level: 'warn',       // Reduce log verbosity
    auditLevel: 'info',  // Keep audit logs detailed
    retention: 90,       // 90 days retention
    encryption: true,    // Encrypt sensitive logs
  }
};
```

### Security Monitoring Setup
```bash
#!/bin/bash
# scripts/setup-monitoring.sh

# Install security monitoring tools
npm install --save helmet express-rate-limit express-slow-down
npm install --save @elastic/elasticsearch winston

# Setup log rotation
sudo apt-get install logrotate

# Configure logrotate for application logs
cat > /etc/logrotate.d/fluent-scribe << EOF
/var/log/fluent-scribe/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload fluent-scribe
    endscript
}
EOF

# Setup automated security scans
crontab -e
# Add: 0 2 * * * /path/to/security-scan.sh
```

## Development Environment Security

### Development Security Configuration
```typescript
// src/config/development-security.ts
export const developmentSecurityConfig = {
  // Relaxed settings for development
  session: {
    cookie: {
      secure: false,     // Allow HTTP in development
      httpOnly: true,
      sameSite: 'lax'    // Allow cross-site requests
    },
    maxAge: 86400000,    // 24 hours for convenience
  },
  
  // Development CSP
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow hot reload
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:"], // Allow websockets
    },
    reportOnly: true, // Don't block in development
  },
  
  // Relaxed rate limiting
  rateLimiting: {
    windowMs: 60000,     // 1 minute
    max: 1000,           // High limit for development
    skip: (req) => req.ip === '127.0.0.1', // Skip localhost
  },
  
  // Verbose logging
  logging: {
    level: 'debug',
    console: true,
    auditLevel: 'debug',
  }
};
```

### Development Tools Security
```bash
#!/bin/bash
# scripts/dev-security-setup.sh

# Install development security tools
npm install --save-dev @types/helmet @types/express-rate-limit
npm install --save-dev eslint-plugin-security
npm install --save-dev audit-ci
npm install --save-dev snyk

# Setup pre-commit hooks for security
npx husky add .husky/pre-commit "npm run security-check"

# Create security check script
cat > scripts/security-check.sh << EOF
#!/bin/bash
echo "Running security checks..."

# Dependency audit
npm audit --audit-level moderate

# Security linting
npx eslint --ext .ts,.tsx . --config .eslintrc.security.js

# Secrets detection
npx detect-secrets scan --all-files

echo "Security checks completed."
EOF

chmod +x scripts/security-check.sh
```

## Troubleshooting

### Common Configuration Issues

#### SSL/TLS Certificate Issues
```bash
# Check certificate validity
openssl x509 -in certificate.crt -text -noout

# Test SSL configuration
curl -I https://yourdomain.com

# Check certificate chain
openssl s_client -connect yourdomain.com:443 -showcerts
```

#### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check SSL configuration
psql "$DATABASE_URL?sslmode=require" -c "SHOW ssl;"

# Verify RLS policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies;"
```

#### Authentication Issues
```javascript
// Debug JWT token issues
const jwt = require('jsonwebtoken');

// Decode token without verification (for debugging)
const decoded = jwt.decode(token, { complete: true });
console.log('Header:', decoded.header);
console.log('Payload:', decoded.payload);

// Verify token
try {
  const verified = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token verified:', verified);
} catch (error) {
  console.error('Token verification failed:', error.message);
}
```

### Security Health Checks
```bash
#!/bin/bash
# scripts/security-health-check.sh

echo "Running security health check..."

# Check environment variables
echo "Checking environment variables..."
[ -z "$JWT_SECRET" ] && echo "❌ JWT_SECRET not set" || echo "✅ JWT_SECRET configured"
[ -z "$SESSION_SECRET" ] && echo "❌ SESSION_SECRET not set" || echo "✅ SESSION_SECRET configured"

# Check database connectivity
echo "Checking database connectivity..."
psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1 && \
  echo "✅ Database connection successful" || \
  echo "❌ Database connection failed"

# Check SSL certificates
echo "Checking SSL certificates..."
if [ "$NODE_ENV" = "production" ]; then
  openssl s_client -connect $HOSTNAME:443 -servername $HOSTNAME < /dev/null 2>/dev/null | \
  openssl x509 -noout -dates 2>/dev/null && \
  echo "✅ SSL certificate valid" || \
  echo "❌ SSL certificate issues"
fi

# Check security headers
echo "Checking security headers..."
curl -I https://$HOSTNAME 2>/dev/null | grep -q "Strict-Transport-Security" && \
  echo "✅ HSTS header present" || \
  echo "❌ HSTS header missing"

echo "Security health check completed."
```

### Performance and Security Monitoring
```typescript
// src/lib/monitoring/security-metrics.ts
export class SecurityMetrics {
  private static metrics = {
    authenticationAttempts: 0,
    authenticationFailures: 0,
    securityEvents: 0,
    vulnerabilityScans: 0,
    apiRequests: 0,
    rateLimitExceeded: 0,
  };
  
  static incrementAuthAttempt() {
    this.metrics.authenticationAttempts++;
  }
  
  static incrementAuthFailure() {
    this.metrics.authenticationFailures++;
  }
  
  static getSecurityMetrics() {
    return {
      ...this.metrics,
      authFailureRate: this.metrics.authenticationFailures / this.metrics.authenticationAttempts,
      timestamp: new Date().toISOString(),
    };
  }
  
  static resetDailyMetrics() {
    // Reset daily counters
    this.metrics = {
      authenticationAttempts: 0,
      authenticationFailures: 0,
      securityEvents: 0,
      vulnerabilityScans: 0,
      apiRequests: 0,
      rateLimitExceeded: 0,
    };
  }
}
```

---

**Configuration Validation:**
- Test all security configurations in staging environment
- Verify environment variables are properly set
- Confirm SSL/TLS certificates are valid and properly configured
- Test authentication and authorization flows
- Validate rate limiting and security headers
- Verify monitoring and alerting systems

**Security Configuration Updates:**
- Review and update configurations quarterly
- Monitor security advisories for configuration changes
- Test configuration changes in development first
- Document all security configuration changes
- Maintain configuration backup and rollback procedures

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: March 2025 