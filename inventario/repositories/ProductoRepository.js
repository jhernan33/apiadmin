'use strict';

const { Op } = require('sequelize');
const { Producto } = require('../models');
const { NotFoundError } = require('../utils/ApiError');

/**
 * ProductoRepository — Única capa de acceso a datos para Producto.
 *
 * DIP: los servicios dependen de esta abstracción, no del ORM directamente.
 * SRP: solo sabe acceder y persistir datos, sin lógica de negocio.
 */
class ProductoRepository {
  /**
   * Retorna todos los productos activos con paginación opcional.
   *
   * @param {object} opts
   * @param {number} [opts.page]      Página actual (1-based). Sin página = sin paginación.
   * @param {number} [opts.limit]     Registros por página.
   * @param {string} [opts.orderBy]   Columna de ordenamiento.
   * @param {string} [opts.order]     'ASC' | 'DESC'
   * @returns {Promise<{ rows: Producto[], count: number|null }>}
   */
  async findAll({ page, limit = 10, orderBy = 'codi_prod', order = 'ASC' } = {}) {
    const queryOptions = {
      order: [[orderBy, order]],
    };

    if (page) {
      queryOptions.limit = limit;
      queryOptions.offset = (page - 1) * limit;
      const result = await Producto.findAndCountAll(queryOptions);
      return result;
    }

    const rows = await Producto.findAll(queryOptions);
    return { rows, count: null };
  }

  /**
   * Busca un producto activo por su ID.
   * Lanza NotFoundError si no existe.
   *
   * @param {number} id
   * @returns {Promise<Producto>}
   */
  async findById(id) {
    const producto = await Producto.findByPk(id);
    if (!producto) throw new NotFoundError('Producto');
    return producto;
  }

  /**
   * Busca un producto activo por su código de producto.
   * Retorna null si no existe.
   *
   * @param {number} codiProd
   * @returns {Promise<Producto|null>}
   */
  async findByCode(codiProd) {
    return Producto.findOne({ where: { codi_prod: codiProd } });
  }

  /**
   * Crea un nuevo producto.
   *
   * @param {object} data
   * @returns {Promise<Producto>}
   */
  async create(data) {
    return Producto.create(data);
  }

  /**
   * Actualiza un producto por ID y retorna el registro actualizado.
   *
   * @param {number} id
   * @param {object} data  Solo los campos presentes se actualizan (PATCH behavior).
   * @returns {Promise<Producto>}
   */
  async update(id, data) {
    const producto = await this.findById(id);
    await producto.update(data);
    return producto.reload();
  }

  /**
   * Soft-delete: marca el producto como eliminado sin borrarlo de la BD.
   * Usa el scope 'withDeleted' para poder actualizar el campo deleted.
   *
   * @param {number} id
   * @returns {Promise<void>}
   */
  async softDelete(id) {
    const producto = await this.findById(id);
    await Producto.scope('withDeleted').update(
      { deleted: true },
      { where: { id: producto.id } }
    );
  }
}

// Singleton: una sola instancia compartida en toda la app (DRY)
module.exports = new ProductoRepository();
