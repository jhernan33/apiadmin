'use strict';

/**
 * Migración: Agrega constraints NOT NULL, UNIQUE e índices de rendimiento.
 * Ejecutar en transacción para garantizar atomicidad.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. NOT NULL en columnas críticas
      await queryInterface.changeColumn(
        'Productos',
        'codi_prod',
        { type: Sequelize.INTEGER, allowNull: false },
        { transaction }
      );

      await queryInterface.changeColumn(
        'Productos',
        'nomb_prod',
        { type: Sequelize.STRING(150), allowNull: false },
        { transaction }
      );

      await queryInterface.changeColumn(
        'Productos',
        'prec_prod',
        { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        { transaction }
      );

      // 2. Migrar imag_prod de JSON a JSONB (más eficiente en PostgreSQL)
      await queryInterface.changeColumn(
        'Produtos',
        'imag_prod',
        { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
        { transaction }
      );

      // 3. Restricción UNIQUE en codi_prod
      await queryInterface.addConstraint('Productos', {
        fields: ['codi_prod'],
        type: 'unique',
        name: 'unique_codi_prod',
        transaction,
      });

      // 4. Índices de rendimiento
      await queryInterface.addIndex('Productos', ['codi_prod'], {
        unique: true,
        name: 'idx_productos_codi_prod',
        transaction,
      });

      await queryInterface.addIndex('Productos', ['nomb_prod'], {
        name: 'idx_productos_nomb_prod',
        transaction,
      });

      await queryInterface.addIndex('Productos', ['createdAt'], {
        name: 'idx_productos_created_at',
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeIndex('Productos', 'idx_productos_codi_prod', { transaction });
      await queryInterface.removeIndex('Productos', 'idx_productos_nomb_prod', { transaction });
      await queryInterface.removeIndex('Productos', 'idx_productos_created_at', { transaction });
      await queryInterface.removeConstraint('Productos', 'unique_codi_prod', { transaction });

      await queryInterface.changeColumn(
        'Productos',
        'codi_prod',
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction }
      );
      await queryInterface.changeColumn(
        'Productos',
        'nomb_prod',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      );
      await queryInterface.changeColumn(
        'Productos',
        'prec_prod',
        { type: Sequelize.DOUBLE, allowNull: true },
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
