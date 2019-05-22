'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('productos', {
      codi_prod: {
        allowNull:false,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nomb_prod: {
        type: Sequelize.STRING
      },
      desc_prod: {
        type: Sequelize.STRING
      },
      dele_prod: {
        type: Sequelize.BOOLEAN
      },
      crea_prod: {
        type: Sequelize.DATEONLY
      },
      upda_prod: {
        type: Sequelize.DATEONLY
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Productos');
  }
};