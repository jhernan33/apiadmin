'use strict';

const { ApiError } = require('../utils/ApiError');
const { isDevelopment } = require('../config/environment');

/**
 * Mapea errores de Sequelize a ApiErrors con código HTTP apropiado.
 * SRP: solo transforma errores, no los maneja.
 *
 * @param {Error} err
 * @returns {ApiError|null}
 */
const mapSequelizeError = (err) => {
  const { name, errors = [] } = err;

  if (name === 'SequelizeUniqueConstraintError') {
    const field = errors[0]?.path || 'campo';
    return new ApiError(`El valor de '${field}' ya existe`, 409);
  }
  if (name === 'SequelizeValidationError') {
    const details = errors.map((e) => ({ field: e.path, message: e.message }));
    return new ApiError('Error de validación de datos', 422, details);
  }
  if (name === 'SequelizeForeignKeyConstraintError') {
    return new ApiError('Referencia a recurso inexistente', 400);
  }
  if (name === 'SequelizeConnectionError' || name === 'SequelizeConnectionRefusedError') {
    return new ApiError('Error de conexión con la base de datos', 503);
  }
  if (name === 'SequelizeDatabaseError') {
    return new ApiError('Error en la base de datos', 500);
  }
  return null;
};

/**
 * Middleware global de manejo de errores.
 * Debe registrarse ÚLTIMO en app.js (después de todas las rutas).
 *
 * OCP: detecta nuevos tipos de error sin modificar la lógica central.
 */
const errorHandler = (err, req, res, _next) => {
  // Mapear errores de Sequelize primero
  const mapped = err.name?.startsWith('Sequelize') ? mapSequelizeError(err) : null;
  const error = mapped || err;

  const statusCode = error.statusCode || error.status || 500;
  const isOperational = error.isOperational === true;

  // Loguear errores no operacionales (bugs reales)
  if (!isOperational) {
    console.error('[ERROR]', {
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      body: req.body,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: isOperational || isDevelopment
      ? error.message
      : 'Error interno del servidor',
    ...(error.errors && { errors: error.errors }),
    ...(isDevelopment && !isOperational && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
