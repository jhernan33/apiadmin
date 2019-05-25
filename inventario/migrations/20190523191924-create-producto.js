'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Productos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      codi_prod: {
        type: Sequelize.INTEGER
      },
      nomb_prod: {
        type: Sequelize.STRING
      },
      desc_prod: {
        type: Sequelize.STRING
      },
      deleted: {
        type: Sequelize.BOOLEAN,
          defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Productos');
  }
};