'use strict';

const productoService = require('../../services/ProductoService');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * ProductoController v1 — Controller delgado.
 *
 * SRP: solo orquesta el flujo Request → Service → Response.
 * Sin lógica de negocio. Sin acceso directo a la BD.
 */
class ProductoController {
  /**
   * GET /api/v1/productos?page=1&limit=10
   */
  async list(req, res, next) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

      const { productos, meta } = await productoService.list({ page, limit });

      return ApiResponse.ok(res, productos, 'Productos obtenidos exitosamente', meta);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/productos/:id
   */
  async getById(req, res, next) {
    try {
      const producto = await productoService.getById(parseInt(req.params.id, 10));
      return ApiResponse.ok(res, producto, 'Producto encontrado');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/productos
   */
  async create(req, res, next) {
    try {
      const { codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod } = req.body;
      const producto = await productoService.create({
        codi_prod,
        nomb_prod,
        desc_prod,
        prec_prod,
        imag_prod,
      });
      return ApiResponse.created(res, producto, 'Producto creado exitosamente');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/productos/:id
   */
  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { codi_prod, nomb_prod, desc_prod, prec_prod, imag_prod } = req.body;

      const producto = await productoService.update(id, {
        codi_prod,
        nomb_prod,
        desc_prod,
        prec_prod,
        imag_prod,
      });
      return ApiResponse.ok(res, producto, 'Producto actualizado exitosamente');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/productos/:id
   */
  async delete(req, res, next) {
    try {
      await productoService.delete(parseInt(req.params.id, 10));
      return ApiResponse.noContent(res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProductoController();
