'use strict';

const productoRepository = require('../repositories/ProductoRepository');
const { ConflictError } = require('../utils/ApiError');

/**
 * ProductoService — Lógica de negocio para Productos.
 *
 * SRP: coordina operaciones de negocio sin conocer Express (req/res).
 * DIP: depende del repository, no del ORM directamente.
 */
class ProductoService {
  /**
   * Lista productos con paginación opcional.
   *
   * @param {object} [params]
   * @param {number} [params.page]   Página (1-based). Omitir para traer todos.
   * @param {number} [params.limit]  Registros por página (default: 10).
   * @returns {Promise<{ productos: Producto[], meta?: object }>}
   */
  async list({ page, limit = 10 } = {}) {
    const { rows, count } = await productoRepository.findAll({ page, limit });

    if (!page) {
      return { productos: rows };
    }

    const pages = Math.ceil(count / limit);
    return {
      productos: rows,
      meta: {
        total: count,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Obtiene un producto por ID.
   *
   * @param {number} id
   * @returns {Promise<Producto>}
   */
  async getById(id) {
    return productoRepository.findById(id);
  }

  /**
   * Crea un producto verificando unicidad de código.
   *
   * @param {object} data
   * @returns {Promise<Producto>}
   * @throws {ConflictError} Si el código ya existe.
   */
  async create(data) {
    const existing = await productoRepository.findByCode(data.codi_prod);
    if (existing) {
      throw new ConflictError(
        `Ya existe un producto con el código ${data.codi_prod}`
      );
    }
    return productoRepository.create(data);
  }

  /**
   * Actualiza un producto. Solo modifica los campos recibidos (PATCH behavior).
   * Verifica unicidad de código si se está cambiando.
   *
   * @param {number} id
   * @param {object} data
   * @returns {Promise<Producto>}
   * @throws {ConflictError} Si el nuevo código ya pertenece a otro producto.
   */
  async update(id, data) {
    if (data.codi_prod !== undefined) {
      const existing = await productoRepository.findByCode(data.codi_prod);
      if (existing && existing.id !== id) {
        throw new ConflictError(
          `Ya existe un producto con el código ${data.codi_prod}`
        );
      }
    }

    // Remover campos undefined para no sobreescribir con null
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    return productoRepository.update(id, cleanData);
  }

  /**
   * Elimina un producto con soft-delete.
   * El registro permanece en BD con deleted=true y no aparece en listados.
   *
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    await productoRepository.softDelete(id);
  }
}

// Singleton (DRY)
module.exports = new ProductoService();
