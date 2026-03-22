'use strict';

const { Router } = require('express');
const controller = require('../../controllers/v1/ProductoController');
const { authenticate } = require('../../middleware/auth');
const {
  validateList,
  validateGetById,
  validateCreate,
  validateUpdate,
  validateDelete,
} = require('../../middleware/validators/producto.validator');

const router = Router();

/**
 * Rutas de Productos — /api/v1/productos
 *
 * Rutas de lectura: públicas.
 * Rutas de escritura: requieren autenticación JWT.
 */

// GET    /api/v1/productos?page=1&limit=10
router.get('/', validateList, controller.list.bind(controller));

// GET    /api/v1/productos/:id
router.get('/:id', validateGetById, controller.getById.bind(controller));

// POST   /api/v1/productos
router.post('/', authenticate, validateCreate, controller.create.bind(controller));

// PUT    /api/v1/productos/:id
router.put('/:id', authenticate, validateUpdate, controller.update.bind(controller));

// DELETE /api/v1/productos/:id
router.delete('/:id', authenticate, validateDelete, controller.delete.bind(controller));

module.exports = router;
