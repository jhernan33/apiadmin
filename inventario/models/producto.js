'use strict';

const { Model } = require('sequelize');

/**
 * Modelo Producto con constraints, validaciones y soft-delete.
 *
 * defaultScope: excluye registros eliminados en TODAS las queries por defecto.
 * Scope 'withDeleted': permite ver registros eliminados cuando sea necesario.
 */
module.exports = (sequelize, DataTypes) => {
  class Producto extends Model {
    static associate(_models) {
      // Definir asociaciones futuras aquí
      // Ejemplo: Producto.belongsTo(models.Categoria, { foreignKey: 'categoria_id' });
    }
  }

  Producto.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      codi_prod: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: {
          name: 'unique_codi_prod',
          msg: 'El código de producto ya existe',
        },
        validate: {
          isInt: { msg: 'El código debe ser un número entero' },
          min: { args: [1], msg: 'El código debe ser mayor a 0' },
        },
      },
      nomb_prod: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'El nombre no puede estar vacío' },
          len: {
            args: [2, 150],
            msg: 'El nombre debe tener entre 2 y 150 caracteres',
          },
        },
      },
      desc_prod: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prec_prod: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          isDecimal: { msg: 'El precio debe ser un número decimal' },
          min: { args: [0], msg: 'El precio no puede ser negativo' },
        },
      },
      imag_prod: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Producto',
      tableName: 'Productos',
      timestamps: true,

      // Scope por defecto: siempre filtrar registros eliminados
      defaultScope: {
        where: { deleted: false },
        attributes: { exclude: ['deleted'] },
      },

      scopes: {
        // Usar cuando se requiera acceder a registros eliminados
        withDeleted: { where: {} },
        active: { where: { deleted: false } },
      },
    }
  );

  return Producto;
};
