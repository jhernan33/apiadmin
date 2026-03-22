'use strict';

const pino = require('pino');
const { isDevelopment, logging } = require('../config/environment');

/**
 * Logger estructurado con Pino.
 *
 * - Desarrollo: salida legible con colores (pino-pretty).
 * - Producción: salida JSON para ingestión en sistemas como CloudWatch / ELK.
 * - Redacta automáticamente datos sensibles (tokens, contraseñas).
 *
 * SRP: única responsabilidad de logging en toda la app.
 */
const logger = pino(
  {
    level: logging.level || 'info',
    // Nunca loguear datos sensibles
    redact: {
      paths: [
        'req.headers.authorization',
        'body.password',
        'body.token',
        'body.secret',
      ],
      censor: '[REDACTED]',
    },
  },
  isDevelopment
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      })
    : undefined
);

module.exports = logger;
