const express = require('express');
const { 
  createFolder, 
  listFolders, 
  getFolder, 
  deleteFolder,
  getFolderPath
} = require('../controllers/folder.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de carpetas
router.post('/', createFolder);
router.get('/', listFolders);
router.get('/:id', getFolder);
router.delete('/:id', deleteFolder);
router.get('/:id/path', getFolderPath);

module.exports = router; 