var express = require('express');
var router = express.Router();

const productoController = require('../controllers').producto;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Classroom Router */
router.get('/api/classroom', productoController.list);
router.get('/api/classroom/:id', productoController.getById);
router.post('/api/classroom', productoController.add);
router.put('/api/classroom/:id', productoController.update);
router.delete('/api/classroom/:id', productoController.delete);

module.exports = router;
