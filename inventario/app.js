// Load environment variables
require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Security imports
const { applySecurityMiddleware } = require('./middleware/security');
const config = require('./config/environment');

// Routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// ===== SECURITY CONFIGURATION =====
// Apply all security middleware
applySecurityMiddleware(app);

// ===== VIEW ENGINE =====
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ===== LOGGING =====
const morganFormat = config.isDevelopment ? 'dev' : 'combined';
app.use(logger(morganFormat));

// ===== REQUEST PARSING =====
// Limit request size to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));
app.use(cookieParser(config.security.sessionSecret));

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static assets for 1 day
  etag: false
}));

// ===== API ENDPOINTS =====
app.use('/', indexRouter);
app.use('/users', usersRouter);

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== 404 HANDLER =====
app.use(function(req, res, next) {
  next(createError(404, 'Resource not found'));
});

// ===== ERROR HANDLER =====
app.use(function(err, req, res, next) {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = config.isDevelopment ? err : {};

  // Log error details in production
  if (config.isProduction && err.status !== 404) {
    console.error('Error:', {
      status: err.status || 500,
      message: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Don't expose stack traces in production
  const statusCode = err.status || 500;

  // For API requests, return JSON
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(statusCode).json({
      success: false,
      error: {
        status: statusCode,
        message: config.isDevelopment ? err.message : 'Internal Server Error',
      }
    });
  }

  // For HTML requests, render error page
  res.status(statusCode);
  res.render('error');
});

module.exports = app;
