const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const Log = require('../models/Log');

// Configuración de multer para carga de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    console.log('Directorio base de uploads para versiones:', uploadDir);
    
    const companyDir = path.join(uploadDir, req.user.companyId.toString(), 'versions');
    console.log('Directorio para versiones de la empresa:', companyDir);
    
    // Crear directorio si no existe
    if (!fs.existsSync(companyDir)) {
      console.log('Creando directorio de versiones ya que no existe');
      try {
        fs.mkdirSync(companyDir, { recursive: true });
        console.log('Directorio creado con éxito');
      } catch (dirError) {
        console.error('Error al crear directorio:', dirError);
        return cb(new Error(`No se pudo crear el directorio: ${dirError.message}`));
      }
    }
    
    cb(null, companyDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único
    const timestamp = Date.now();
    const originalname = file.originalname;
    const extension = path.extname(originalname);
    const basename = path.basename(originalname, extension);
    const uniqueFilename = `${basename}_v${req.body.version || 'new'}_${timestamp}${extension}`;
    
    console.log('Nombre original:', originalname);
    console.log('Nombre único generado para versión:', uniqueFilename);
    
    cb(null, uniqueFilename);
  }
});

// Filtro para aceptar solo archivos permitidos
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no soportado. Solo se permiten archivos Excel, CSV, PDF y Word.'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB límite
  }
});

// Middleware para manejar errores de carga
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'El archivo es demasiado grande. El límite es 20MB.'
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message
      }
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_ERROR',
        message: err.message
      }
    });
  }
  next();
};

// @desc    Obtener el historial de versiones de un archivo
// @route   GET /api/files/:id/versions
// @access  Privado
exports.getFileVersions = async (req, res) => {
  try {
    const fileId = req.params.id;
    
    // Verificar que el archivo existe y pertenece a la compañía del usuario
    const file = await File.findOne({
      _id: fileId,
      companyId: req.user.companyId
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o no tienes acceso a él'
        }
      });
    }
    
    // Buscar todas las versiones
    const versions = await FileVersion.find({ fileId })
      .sort({ version: -1 })
      .populate('uploadedBy', 'name email');
    
    // Agregar información de la versión actual del archivo principal
    const currentVersion = {
      _id: file._id,
      fileId: file._id,
      version: file.version,
      name: file.name,
      size: file.size,
      storageLocation: file.storageLocation,
      uploadedBy: file.uploadedBy,
      isCurrent: true,
      createdAt: file.updatedAt || file.createdAt
    };
    
    // Combinar con las versiones anteriores
    const allVersions = [currentVersion, ...versions.map(v => ({
      ...v.toObject(),
      isCurrent: false
    }))];
    
    // Ordenar por versión (descendente)
    allVersions.sort((a, b) => b.version - a.version);
    
    return res.status(200).json({
      success: true,
      data: allVersions
    });
  } catch (error) {
    console.error('Error al obtener versiones de archivo:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener el historial de versiones'
      }
    });
  }
};

// @desc    Subir nueva versión de un archivo
// @route   POST /api/files/versions
// @access  Privado
exports.uploadNewVersion = [
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No se ha proporcionado ningún archivo'
          }
        });
      }
      
      const { fileId, description } = req.body;
      
      if (!fileId) {
        // Eliminar el archivo subido si no hay ID
        fs.unlinkSync(req.file.path);
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FILE_ID',
            message: 'Debe especificar el ID del archivo al que se añadirá la versión'
          }
        });
      }
      
      // Verificar que el archivo existe y pertenece a la compañía del usuario
      const file = await File.findOne({
        _id: fileId,
        companyId: req.user.companyId
      });
      
      if (!file) {
        // Eliminar el archivo subido
        fs.unlinkSync(req.file.path);
        
        return res.status(404).json({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Archivo no encontrado o no tienes acceso a él'
          }
        });
      }
      
      // Crear nueva versión con la versión actual del archivo
      const currentVersion = await FileVersion.create({
        fileId: file._id,
        version: file.version,
        name: file.name,
        size: file.size,
        storageLocation: file.storageLocation,
        uploadedBy: file.uploadedBy
      });
      
      console.log(`Versión ${file.version} guardada como histórico: ${currentVersion._id}`);
      
      // Actualizar el archivo principal con la nueva versión
      file.version += 1;
      file.name = req.file.originalname;
      file.originalName = req.file.originalname;
      file.size = req.file.size;
      file.storageLocation = req.file.path;
      file.uploadedBy = req.user._id;
      
      if (description) {
        file.description = description;
      }
      
      await file.save();
      
      // Registrar log
      await Log.create({
        userId: req.user._id,
        companyId: req.user.companyId,
        action: 'upload_file_version',
        entityType: 'file',
        entityId: file._id,
        details: {
          fileName: file.name,
          fileSize: req.file.size,
          version: file.version,
          previousVersionId: currentVersion._id
        }
      });
      
      return res.status(200).json({
        success: true,
        data: {
          _id: file._id,
          fileId: file._id,
          version: file.version,
          name: file.name,
          size: file.size,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error al subir nueva versión:', error);
      
      // Intentar eliminar el archivo si hubo un error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error al eliminar el archivo:', unlinkError);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Error al subir nueva versión'
        }
      });
    }
  }
];

// @desc    Descargar una versión específica
// @route   GET /api/files/versions/:versionId/download
// @access  Privado
exports.downloadVersion = async (req, res) => {
  try {
    const versionId = req.params.versionId;
    console.log(`Intentando descargar versión con ID: ${versionId}`);
    
    if (!versionId || !mongoose.Types.ObjectId.isValid(versionId)) {
      console.error(`ID de versión inválido: ${versionId}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VERSION_ID',
          message: 'ID de versión inválido'
        }
      });
    }
    
    // Buscar la versión
    const version = await FileVersion.findById(versionId);
    console.log('Resultado de búsqueda de versión:', version ? 'Encontrada' : 'No encontrada');
    
    if (!version) {
      // Si no encuentra la versión, verificar si el ID corresponde a un archivo (versión actual)
      console.log('Verificando si el ID corresponde a un archivo (versión actual)...');
      const file = await File.findById(versionId);
      
      if (file && file.companyId.toString() === req.user.companyId.toString()) {
        console.log('El ID corresponde a un archivo principal. Descargando versión actual.', file._id);
        
        // Verificar que el archivo existe en el sistema
        if (!fs.existsSync(file.storageLocation)) {
          console.error(`Archivo físico no encontrado en: ${file.storageLocation}`);
          return res.status(404).json({
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'El archivo físico no existe en el sistema'
            }
          });
        }
        
        // Registrar log
        await Log.create({
          userId: req.user._id,
          companyId: req.user.companyId,
          action: 'download_file',
          entityType: 'file',
          entityId: file._id,
          details: {
            fileName: file.name,
            fileSize: file.size,
            version: file.version
          }
        });
        
        // Enviar archivo
        return res.download(file.storageLocation, file.originalName || file.name, (err) => {
          if (err) {
            console.error('Error al descargar archivo actual:', err);
          }
        });
      }
      
      // Si no es un archivo ni una versión, retornar 404 con mensaje específico
      console.error(`Versión no encontrada con ID: ${versionId}`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Esta versión no existe. Es posible que aún no se haya creado ninguna versión para este archivo.'
        }
      });
    }
    
    // Verificar que el archivo pertenece a la compañía del usuario
    console.log(`Verificando archivo con ID ${version.fileId} para compañía ${req.user.companyId}`);
    const file = await File.findOne({
      _id: version.fileId,
      companyId: req.user.companyId
    });
    
    if (!file) {
      console.error(`Archivo no encontrado o usuario sin acceso: ${version.fileId}`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'No tienes acceso a este archivo'
        }
      });
    }
    
    // Verificar que el archivo existe en el sistema
    if (!fs.existsSync(version.storageLocation)) {
      console.error(`Archivo físico de versión no encontrado en: ${version.storageLocation}`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'El archivo físico no existe en el sistema'
        }
      });
    }
    
    console.log(`Descargando versión ${version.version} del archivo ${version.name} desde ${version.storageLocation}`);
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'download_file_version',
      entityType: 'file_version',
      entityId: version._id,
      details: {
        fileName: version.name,
        fileSize: version.size,
        version: version.version,
        fileId: version.fileId
      }
    });
    
    // Enviar archivo
    res.download(version.storageLocation, version.name, (err) => {
      if (err) {
        console.error('Error al descargar versión:', err);
      }
    });
  } catch (error) {
    console.error('Error en downloadVersion:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al descargar la versión',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

// @desc    Revertir a una versión anterior
// @route   POST /api/files/:id/revert/:versionId
// @access  Privado
exports.revertToVersion = async (req, res) => {
  try {
    const { id: fileId, versionId } = req.params;
    
    // Verificar que el archivo existe y pertenece a la compañía del usuario
    const file = await File.findOne({
      _id: fileId,
      companyId: req.user.companyId
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o no tienes acceso a él'
        }
      });
    }
    
    // Buscar la versión a la que se quiere revertir
    const versionToRevert = await FileVersion.findById(versionId);
    
    if (!versionToRevert || versionToRevert.fileId.toString() !== fileId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Versión no encontrada o no corresponde al archivo'
        }
      });
    }
    
    // Verificar que el archivo de la versión existe
    if (!fs.existsSync(versionToRevert.storageLocation)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'VERSION_FILE_NOT_FOUND',
          message: 'El archivo físico de la versión no existe'
        }
      });
    }
    
    // Guardar la versión actual como histórico
    const currentVersion = await FileVersion.create({
      fileId: file._id,
      version: file.version,
      name: file.name,
      size: file.size,
      storageLocation: file.storageLocation,
      uploadedBy: file.uploadedBy
    });
    
    // Crear copia del archivo de la versión a revertir
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const companyDir = path.join(uploadDir, req.user.companyId.toString());
    const timestamp = Date.now();
    const extension = path.extname(versionToRevert.name);
    const basename = path.basename(versionToRevert.name, extension);
    const newFileName = `${basename}_reverted_v${versionToRevert.version}_${timestamp}${extension}`;
    const newPath = path.join(companyDir, newFileName);
    
    // Copiar el archivo
    fs.copyFileSync(versionToRevert.storageLocation, newPath);
    
    // Actualizar el archivo principal
    file.version += 1;
    file.name = versionToRevert.name;
    file.size = versionToRevert.size;
    file.storageLocation = newPath;
    file.uploadedBy = req.user._id;
    
    await file.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'revert_file_version',
      entityType: 'file',
      entityId: file._id,
      details: {
        fileName: file.name,
        revertedToVersion: versionToRevert.version,
        newVersion: file.version,
        previousVersionId: currentVersion._id
      }
    });
    
    return res.status(200).json({
      success: true,
      data: {
        _id: file._id,
        name: file.name,
        version: file.version,
        message: `Archivo revertido a la versión ${versionToRevert.version}`
      }
    });
  } catch (error) {
    console.error('Error al revertir versión:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al revertir a la versión anterior'
      }
    });
  }
}; 