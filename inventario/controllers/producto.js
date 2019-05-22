const Producto = require('../models').Producto;

/**
 * Listar todos los productos registrados 
 */
module.exports = {
  list(req, res) {
    return Producto
      .findAll({
        include: [{
          model: Producto,
          as: 'productos'
        }],
        order: [
          ['crea_prod', 'DESC'],
          [{ model: Producto, as: 'productos' }, 'crea_prod', 'DESC'],
        ],
      })
      .then((producto) => res.status(200).send(producto))
      .catch((error) => { res.status(400).send(error); });
  },
/**
 * Funcion para listar un Producto
 * @param {*} req 
 * @param {*} res 
 */
  getById(req, res) {
    return Producto
      .findById(req.params.id, {
        include: [{
          model: Producto,
          as: 'productos'
        }],
      })
      .then((producto) => {
        if (!producto) {
          return res.status(404).send({
            message: 'Producto no Encontrado',
          });
        }
        return res.status(200).send(producto);
      })
      .catch((error) => res.status(400).send(error));
  },
/**
 * Funcion para Registrar un Producto
 * @param {*} req 
 * @param {*} res 
 */
  add(req, res) {
    return Producto
      .create({
        nomb_prod: req.body.nomb_prod,
      })
      .then((producto) => res.status(201).send(producto))
      .catch((error) => res.status(400).send(error));
  },
/**
 * Actualizar un Producto
 * @param {*} req 
 * @param {*} res 
 */
  update(req, res) {
    return Producto
      .findById(req.params.id, {
        include: [{
          model: Producto,
          as: 'productos'
        }],
      })
      .then(producto => {
        if (!producto) {
          return res.status(404).send({
            message: 'Producto no Registrado',
          });
        }
        return producto
          .update({
            nomb_prod: req.body.nomb_prod || producto.nomb_prod,
          })
          .then(() => res.status(200).send(producto))
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(400).send(error));
  },
/**
 * Funcion para Eliminar un Producto
 * @param {*} req 
 * @param {*} res 
 */
  delete(req, res) {
    return Producto
      .findById(req.params.id)
      .then(producto => {
        if (!producto) {
          return res.status(400).send({
            message: 'Producto no Encontrado',
          });
        }
        return producto
          .destroy()
          .then(() => res.status(204).send())
          .catch((error) => res.status(400).send(error));
      })
      .catch((error) => res.status(400).send(error));
  },
};