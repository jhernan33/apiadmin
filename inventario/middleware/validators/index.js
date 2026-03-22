'use strict';

const { validationResult } = require('express-validator');

/**
 * handleValidationErrors — Middleware que intercepta errores de express-validator.
 * DRY: un único handler para todos los validators de la app.
 *
 * Retorna 400 con array de errores estructurado si hay fallas de validación.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array().map(({ path, msg, value }) => ({
        field: path,
        message: msg,
        value,
      })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
