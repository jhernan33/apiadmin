/**
 * Security Middleware Module
 * Centralizes all security-related middleware for the application
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { security } = require('../config/environment');

/**
 * Helmet middleware - Sets various HTTP headers for security
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  noSniff: true,
  // xssFilter queda en el default de helmet (X-XSS-Protection: 0). El filtro
  // XSS de los navegadores legacy está deprecado y era explotable por sí mismo.
});

/**
 * CORS middleware - Allows cross-origin requests from specified origins
 */
const corsMiddleware = cors({
  origin: security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
});

/**
 * Rate limiting middleware - Prevents abuse and brute force attacks
 */
const rateLimiter = rateLimit({
  windowMs: security.rateLimitWindowMs,
  limit: security.rateLimitMaxRequests, // `max` está deprecado desde v7

  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Request sanitization middleware - Removes potentially dangerous characters
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize query parameters
  Object.keys(req.query).forEach(key => {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].trim().substring(0, 1000);
    }
  });

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim().substring(0, 1000);
      }
    });
  }

  next();
};

/**
 * Security headers middleware - Custom security headers
 */
const securityHeaders = (req, res, next) => {
  // no-store solo para respuestas de la API: aplicarlo globalmente anulaba el
  // `maxAge: '1d'` de express.static y forzaba a revalidar cada asset.
  // X-Content-Type-Options y X-Frame-Options ya los emite helmet.
  if (req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-store');
  }

  next();
};

/**
 * Apply all security middleware
 */
const applySecurityMiddleware = (app) => {
  // Sin esto, detrás de un load balancer todas las peticiones comparten la IP
  // del proxy y el rate limit se aplica al conjunto en lugar de por cliente.
  app.set('trust proxy', security.trustProxy);

  // Apply helmet first
  app.use(helmetMiddleware);

  // Apply custom security headers
  app.use(securityHeaders);

  // Apply CORS
  app.use(corsMiddleware);

  // Apply rate limiting
  app.use(rateLimiter);

  // Apply input sanitization
  app.use(sanitizeInput);
};

module.exports = {
  applySecurityMiddleware,
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  sanitizeInput,
  securityHeaders,
};
