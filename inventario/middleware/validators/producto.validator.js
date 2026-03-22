'use strict';

const { body, query, param } = require('express-validator');
const { handleValidationErrors } = require('./index');

/**
 * Reglas de validación para la entidad Producto.
 *
 * DRY: reglas atómicas reutilizables, combinadas por operación.
 * OCP: agregar nuevas reglas sin modificar las existentes.
 */

// ── Reglas atómicas reutilizables ────────────────────────

const rules = {
  /** Valida el parámetro :id de la URL */
  paramId: param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un entero positivo')
    .toInt(),

  /** codi_prod requerido o opcional según la operación */
  codiProd: (required = true) => {
    const chain = body('codi_prod')
      .isInt({ min: 1 })
      .withMessage('El código debe ser un entero positivo')
      .toInt();
    return required
      ? chain.exists({ checkNull: true }).withMessage('El código es requerido')
      : chain.optional();
  },

  /** nomb_prod requerido o opcional */
  nombProd: (required = true) => {
    const chain = body('nomb_prod')
      .isString()
      .withMessage('El nombre debe ser texto')
      .trim()
      .isLength({ min: 2, max: 150 })
      .withMessage('El nombre debe tener entre 2 y 150 caracteres');
    return required
      ? chain.notEmpty().withMessage('El nombre es requerido')
      : chain.optional();
  },

  /** desc_prod siempre opcional */
  descProd: body('desc_prod')
    .optional({ nullable: true })
    .isString()
    .withMessage('La descripción debe ser texto')
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede superar 500 caracteres'),

  /** prec_prod requerido o opcional */
  precProd: (required = true) => {
    const chain = body('prec_prod')
      .isFloat({ min: 0 })
      .withMessage('El precio debe ser un número mayor o igual a 0')
      .toFloat();
    return required
      ? chain.exists({ checkNull: true }).withMessage('El precio es requerido')
      : chain.optional();
  },

  /** imag_prod siempre opcional — debe ser array */
  imagProd: body('imag_prod')
    .optional({ nullable: true })
    .isArray()
    .withMessage('imag_prod debe ser un array'),

  /** Paginación en query string */
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page debe ser un entero >= 1')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit debe estar entre 1 y 100')
      .toInt(),
  ],
};

// ── Middlewares compuestos por operación ─────────────────

/** GET /api/v1/productos */
const validateList = [...rules.pagination, handleValidationErrors];

/** GET /api/v1/productos/:id */
const validateGetById = [rules.paramId, handleValidationErrors];

/** POST /api/v1/productos */
const validateCreate = [
  rules.codiProd(true),
  rules.nombProd(true),
  rules.descProd,
  rules.precProd(true),
  rules.imagProd,
  handleValidationErrors,
];

/** PUT /api/v1/productos/:id */
const validateUpdate = [
  rules.paramId,
  rules.codiProd(false),
  rules.nombProd(false),
  rules.descProd,
  rules.precProd(false),
  rules.imagProd,
  handleValidationErrors,
];

/** DELETE /api/v1/productos/:id */
const validateDelete = [rules.paramId, handleValidationErrors];

module.exports = {
  validateList,
  validateGetById,
  validateCreate,
  validateUpdate,
  validateDelete,
};
