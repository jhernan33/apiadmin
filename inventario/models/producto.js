'use strict';
module.exports = (sequelize, DataTypes) => {
  const Producto = sequelize.define('Producto', {
    codi_prod: DataTypes.INTEGER,
    nomb_prod: DataTypes.STRING,
    desc_prod: DataTypes.STRING,
    dele_prod: DataTypes.BOOLEAN,
    crea_prod: DataTypes.DATEONLY,
    upda_prod: DataTypes.DATEONLY
  }, {});
  return Producto;
};