var express = require('express');
var router = express.Router();

const productoController = require('../controllers').producto;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Classroom Router */
router.get('/api/productos', productoController.list);
router.get('/api/productos/:id', productoController.getById);
router.post('/api/productos', productoController.add);
router.put('/api/productos/:id', productoController.update);
router.delete('/api/productos/:id', productoController.delete);

module.exports = router;
