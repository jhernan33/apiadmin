'use strict';

// environment.js ya invoca dotenv.config() — no duplicar aquí
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const morgan = require('morgan');

const { applySecurityMiddleware } = require('./middleware/security');
const { errorHandler } = require('./middleware/errorHandler');
const config = require('./config/environment');

// Routers
const apiRouter = require('./routes');

const app = express();

// ── Seguridad (Helmet, CORS, Rate Limit, sanitización) ───
applySecurityMiddleware(app);

// ── View engine (error.ejs) ──────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ── Logging HTTP ─────────────────────────────────────────
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));

// ── Parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));
app.use(cookieParser(config.security.sessionSecret));

// ── Archivos estáticos ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: false,
}));

// ── Health check profundo (verifica BD) ──────────────────
app.get('/health', async (req, res) => {
  try {
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    res.status(200).json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Página de bienvenida ─────────────────────────────────
app.get('/', (req, res) => {
  res.render('index', { title: 'Inventario API — Node.js · Express · PostgreSQL' });
});

// ── API (versionada) ─────────────────────────────────────
app.use('/', apiRouter);

// ── 404 ──────────────────────────────────────────────────
app.use((req, res, next) => next(createError(404, 'Ruta no encontrada')));

// ── Error handler global (siempre al final) ──────────────
app.use(errorHandler);

module.exports = app;
