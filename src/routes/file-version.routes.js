const express = require('express');
const { 
  getFileVersions, 
  uploadNewVersion, 
  downloadVersion, 
  revertToVersion 
} = require('../controllers/file-version.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Estas rutas tienen que estar en orden específico - las más específicas primero

// Ruta para descargar una versión específica
// IMPORTANTE: Esta ruta debe ir ANTES de las rutas con parámetros /:id/ para evitar conflictos
router.get('/versions/:versionId/download', downloadVersion);

// Ruta para subir nueva versión
router.post('/versions', uploadNewVersion);

// Ruta para obtener versiones de un archivo
router.get('/:id/versions', getFileVersions);

// Ruta para revertir a una versión anterior
router.post('/:id/revert/:versionId', revertToVersion);

module.exports = router; 