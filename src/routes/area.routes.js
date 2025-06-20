const express = require('express');
const router = express.Router();
const areaController = require('../controllers/area.controller');
const subareaController = require('../controllers/subarea.controller');
const { protect } = require('../middlewares/auth.middleware');

// IMPORTANTE: Las rutas estáticas deben ir ANTES de las rutas con parámetros dinámicos
// Rutas para áreas
router.route('/')
  .get(protect, areaController.getAreas)
  .post(protect, areaController.createArea);

// Ruta para crear áreas predefinidas
router.route('/default')
  .post(protect, areaController.createDefaultAreas);

// Ruta para operaciones sobre un área específica
router.route('/:id')
  .get(protect, areaController.getAreaById)
  .put(protect, areaController.updateArea)
  .delete(protect, areaController.deleteArea);

// Rutas para subáreas asociadas a un área
router.route('/:areaId/subareas/default')
  .post(protect, subareaController.createDefaultSubAreas);

router.route('/:areaId/subareas')
  .get(protect, subareaController.getSubAreas)
  .post(protect, subareaController.createSubArea);

// Rutas para plantillas Excel
router.route('/:id/excel-template')
  .post(protect, areaController.assignExcelTemplate)
  .delete(protect, areaController.removeExcelTemplate);

module.exports = router; 