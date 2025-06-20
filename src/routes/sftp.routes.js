const express = require('express');
const { 
  testConnection, 
  updateSettings, 
  syncFiles, 
  listJobs, 
  getJob 
} = require('../controllers/sftp.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas modificadas para permitir acceso a cualquier usuario autenticado
router.post('/test-connection', testConnection);
router.put('/settings', updateSettings);
router.post('/sync', syncFiles);
router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);

module.exports = router; 