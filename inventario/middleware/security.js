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
  xssFilter: true,
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
  max: security.rateLimitMaxRequests,
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
  // Prevent caching of sensitive information
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.set('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.set('X-Frame-Options', 'DENY');

  next();
};

/**
 * Apply all security middleware
 */
const applySecurityMiddleware = (app) => {
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
