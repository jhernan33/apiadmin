'use strict';

const ProductoService = require('../../../services/ProductoService');
const productoRepository = require('../../../repositories/ProductoRepository');
const { ConflictError, NotFoundError } = require('../../../utils/ApiError');

// Mock del repository: los unit tests NO tocan la BD
jest.mock('../../../repositories/ProductoRepository');

describe('ProductoService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── list() ─────────────────────────────────────────────
  describe('list()', () => {
    it('retorna productos sin meta cuando no hay paginación', async () => {
      productoRepository.findAll.mockResolvedValue({
        rows: [{ id: 1, nomb_prod: 'Test' }],
        count: null,
      });

      const result = await ProductoService.list();

      expect(result.productos).toHaveLength(1);
      expect(result.meta).toBeUndefined();
      expect(productoRepository.findAll).toHaveBeenCalledWith({ page: undefined, limit: 10 });
    });

    it('retorna meta de paginación correcta con page y limit', async () => {
      productoRepository.findAll.mockResolvedValue({
        rows: [{ id: 1 }, { id: 2 }],
        count: 25,
      });

      const result = await ProductoService.list({ page: 2, limit: 10 });

      expect(result.productos).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        pages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('calcula hasNext=false en la última página', async () => {
      productoRepository.findAll.mockResolvedValue({ rows: [], count: 10 });

      const result = await ProductoService.list({ page: 1, limit: 10 });

      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
    });
  });

  // ── getById() ──────────────────────────────────────────
  describe('getById()', () => {
    it('retorna el producto cuando existe', async () => {
      const producto = { id: 1, nomb_prod: 'Laptop' };
      productoRepository.findById.mockResolvedValue(producto);

      const result = await ProductoService.getById(1);

      expect(result).toEqual(producto);
      expect(productoRepository.findById).toHaveBeenCalledWith(1);
    });

    it('propaga NotFoundError del repository', async () => {
      productoRepository.findById.mockRejectedValue(new NotFoundError('Producto'));

      await expect(ProductoService.getById(999)).rejects.toThrow(NotFoundError);
    });
  });

  // ── create() ───────────────────────────────────────────
  describe('create()', () => {
    const newProducto = { codi_prod: 100, nomb_prod: 'Laptop', prec_prod: 999.99 };

    it('crea el producto si el código no existe', async () => {
      productoRepository.findByCode.mockResolvedValue(null);
      productoRepository.create.mockResolvedValue({ id: 1, ...newProducto });

      const result = await ProductoService.create(newProducto);

      expect(productoRepository.findByCode).toHaveBeenCalledWith(100);
      expect(productoRepository.create).toHaveBeenCalledWith(newProducto);
      expect(result.id).toBe(1);
    });

    it('lanza ConflictError si el código ya existe', async () => {
      productoRepository.findByCode.mockResolvedValue({ id: 5, codi_prod: 100 });

      await expect(ProductoService.create(newProducto)).rejects.toThrow(ConflictError);
      expect(productoRepository.create).not.toHaveBeenCalled();
    });
  });

  // ── update() ───────────────────────────────────────────
  describe('update()', () => {
    it('actualiza sin conflicto si el código no cambia', async () => {
      productoRepository.findByCode.mockResolvedValue({ id: 1, codi_prod: 100 });
      productoRepository.update.mockResolvedValue({ id: 1, nomb_prod: 'Nuevo nombre' });

      const result = await ProductoService.update(1, { codi_prod: 100, nomb_prod: 'Nuevo nombre' });

      expect(result.nomb_prod).toBe('Nuevo nombre');
    });

    it('lanza ConflictError si el nuevo código pertenece a otro producto', async () => {
      productoRepository.findByCode.mockResolvedValue({ id: 99, codi_prod: 200 });

      await expect(
        ProductoService.update(1, { codi_prod: 200 })
      ).rejects.toThrow(ConflictError);
    });

    it('no llama findByCode si codi_prod no está en los datos', async () => {
      productoRepository.update.mockResolvedValue({ id: 1, nomb_prod: 'Solo nombre' });

      await ProductoService.update(1, { nomb_prod: 'Solo nombre' });

      expect(productoRepository.findByCode).not.toHaveBeenCalled();
    });

    it('filtra campos undefined antes de actualizar', async () => {
      productoRepository.update.mockResolvedValue({ id: 1 });

      await ProductoService.update(1, { nomb_prod: 'Test', desc_prod: undefined });

      expect(productoRepository.update).toHaveBeenCalledWith(1, { nomb_prod: 'Test' });
    });
  });

  // ── delete() ───────────────────────────────────────────
  describe('delete()', () => {
    it('invoca softDelete en el repository', async () => {
      productoRepository.softDelete.mockResolvedValue();

      await ProductoService.delete(1);

      expect(productoRepository.softDelete).toHaveBeenCalledWith(1);
    });

    it('propaga NotFoundError si el producto no existe', async () => {
      productoRepository.softDelete.mockRejectedValue(new NotFoundError('Producto'));

      await expect(ProductoService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
