var express = require('express');
var router = express.Router();  // Middleware de nivel de direccionador

const productoController = require('../controllers').producto;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Welcome Api Rest in NodeJs - Express - Sequelize - Postgresql' });
});

/* Classroom Router */
router.get('/api/productos/:page?', productoController.list);
router.get('/api/producto/:id', productoController.getById);
router.post('/api/productos', productoController.add);
router.put('/api/productos/:id', productoController.update);
router.delete('/api/productos/:id', productoController.delete);

module.exports = router;
