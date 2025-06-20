const express = require('express');
const router = express.Router();
const subareaController = require('../controllers/subarea.controller');
const { protect } = require('../middlewares/auth.middleware');

// IMPORTANTE: Las rutas estáticas deben ir ANTES de las rutas con parámetros dinámicos
// Ruta para crear subáreas predefinidas
router.route('/:areaId/default')
  .post(protect, subareaController.createDefaultSubAreas);

// Rutas
router.route('/')
  .get(protect, subareaController.getSubAreas);

// Rutas para subáreas específicas
router.route('/:id')
  .get(protect, subareaController.getSubAreaById)
  .put(protect, subareaController.updateSubArea)
  .delete(protect, subareaController.deleteSubArea);

// Rutas para archivos de ejemplo
router.route('/:id/sample-files')
  .get(protect, subareaController.getSampleFiles)
  .post(protect, subareaController.addSampleFile);

router.route('/:id/sample-files/:fileId')
  .delete(protect, subareaController.removeSampleFile);

// Rutas para plantillas Excel
router.route('/:id/excel-template')
  .post(protect, subareaController.assignExcelTemplate);

router.route('/:id/excel-template/:fileId')
  .delete(protect, subareaController.removeExcelTemplate);

module.exports = router; 