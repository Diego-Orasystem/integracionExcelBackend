const express = require('express');
const fs = require('fs');
const path = require('path');
const { 
  uploadFile, 
  listFiles, 
  getFile, 
  downloadFile, 
  deleteFile, 
  searchFiles,
  getFilesByMimeType,
  getFileMetricsData,
  getAreaFileStatsData,
  createTestVersion
} = require('../controllers/file.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// Crear una ruta pública para descargar archivos antes de la autenticación
router.get('/:id/download', async (req, res) => {
  try {
    // Importar modelos directamente
    const File = require('../models/File');
    const Log = require('../models/Log');
    const mongoose = require('mongoose');
    
    const file = await File.findOne({
      _id: req.params.id
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado'
        }
      });
    }
    
    // Verificar que el archivo existe en el sistema de archivos
    if (!fs.existsSync(file.storageLocation)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'El archivo no existe en el sistema'
        }
      });
    }
    
    // Registrar log de descarga aunque sea anónima
    try {
      await Log.create({
        userId: new mongoose.Types.ObjectId('000000000000000000000000'), // ID genérico para usuario anónimo
        companyId: file.companyId,
        action: 'download_file',
        entityType: 'file',
        entityId: file._id,
        details: {
          fileName: file.name,
          fileSize: file.size,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          message: 'Descarga pública sin autenticación'
        }
      });
    } catch (logError) {
      console.error('Error al registrar log de descarga:', logError);
      // Continuamos con la descarga aunque falle el log
    }
    
    // Enviar archivo
    res.download(file.storageLocation, file.originalName, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
      }
    });
  } catch (error) {
    console.error('Error en downloadFile público:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al descargar archivo'
      }
    });
  }
});

// Todas las rutas siguientes requieren autenticación
router.use(protect);

// Ruta para verificar la configuración del servidor y directorios
router.get('/check-uploads', (req, res) => {
  try {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const absolutePath = path.resolve(uploadDir);
    
    // Verificar existencia del directorio
    const exists = fs.existsSync(absolutePath);
    
    // Verificar permisos si existe
    let writable = false;
    if (exists) {
      try {
        fs.accessSync(absolutePath, fs.constants.W_OK);
        writable = true;
      } catch (err) {}
    }
    
    // Verificar directorio específico para el usuario
    const companyDir = path.join(absolutePath, req.user.companyId.toString());
    const companyDirExists = fs.existsSync(companyDir);
    
    // Crear directorio de la compañía si no existe
    let companyDirCreated = false;
    if (!companyDirExists) {
      try {
        fs.mkdirSync(companyDir, { recursive: true });
        companyDirCreated = true;
      } catch (err) {}
    }
    
    // Lista de archivos en el directorio de la compañía
    let companyFiles = [];
    if (companyDirExists || companyDirCreated) {
      try {
        companyFiles = fs.readdirSync(companyDir);
      } catch (err) {}
    }
    
    res.json({
      success: true,
      data: {
        uploadDir,
        absolutePath,
        exists,
        writable,
        companyDir,
        companyDirExists: companyDirExists || companyDirCreated,
        companyDirCreated,
        companyFiles,
        user: {
          id: req.user._id,
          companyId: req.user.companyId
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// Rutas de archivos
router.post('/upload', uploadFile);
// Añadir también la misma ruta en la raíz para compatibilidad
router.post('/', uploadFile);
router.get('/', listFiles);
router.get('/search', searchFiles);
router.get('/by-type', getFilesByMimeType);

// Rutas para métricas y estadísticas (deben ir antes de la ruta con parámetro /:id)
router.get('/metrics', getFileMetricsData);
router.get('/area-stats', getAreaFileStatsData);

// Ruta para obtener un archivo específico por ID
router.get('/:id', getFile);
// Comentamos la ruta protegida de descarga ya que ahora usamos la pública
// router.get('/:id/download', downloadFile);
router.delete('/:id', deleteFile);

// Añadir la nueva ruta para crear versiones de prueba
router.post('/:id/test-version', createTestVersion);

module.exports = router; 