const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const mongoose = require('mongoose');
const File = require('../models/File');
const FileVersion = require('../models/FileVersion');
const Log = require('../models/Log');
const Company = require('../models/Company');
const { getRemoteStorageService, ensureRemoteStorageConnection } = require('../services/remote-storage.service');
const {
  buildRemoteDirectoryPath,
  buildRemoteFilePath,
  buildRemoteFilename,
  deriveCompanyDirectory,
  deriveCompanyPrefix,
  sanitizeSegment
} = require('../utils/remote-file.util');
const { appendMetadataEntries } = require('../services/metadata.service');

// Configuración de multer para carga de archivos (usar memoria para luego subir al servidor remoto)
const storage = multer.memoryStorage();

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

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'si', 'sí', 'on'].includes(value.toLowerCase());
  }
  return false;
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
        return res.status(404).json({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'Archivo no encontrado o no tienes acceso a él'
          }
        });
      }
      
      const company = await Company.findById(req.user.companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: 'No se encontró la compañía del usuario'
          }
        });
      }
      
      // Guardar archivo temporalmente
      const tempDir = path.join(os.tmpdir(), 'excel-versions');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const extension = path.extname(req.file.originalname);
      const basename = path.basename(req.file.originalname, extension);
      const tempFilename = `${basename}_v${file.version + 1}_${timestamp}${extension}`;
      const tempFilePath = path.join(tempDir, tempFilename);

      // Escribir archivo temporal desde buffer
      fs.writeFileSync(tempFilePath, req.file.buffer);
      
      // Crear nueva versión con la versión actual del archivo
      const currentVersion = await FileVersion.create({
        fileId: file._id,
        version: file.version,
        name: file.name,
        size: file.size,
        storageLocation: file.storageLocation,
        uploadedBy: file.uploadedBy,
        metadata: file.remoteMetadata || null
      });
      
      console.log(`Versión ${file.version} guardada como histórico: ${currentVersion._id}`);
      
      // Determinar ruta de almacenamiento (remoto o local)
      // Intentar reconectar si no está conectado
      let remoteStorageService = await ensureRemoteStorageConnection();
      if (!remoteStorageService) {
        remoteStorageService = getRemoteStorageService();
      }
      const prefixInput = req.body.prefijo || req.body.prefix || file.remoteMetadata?.prefix;
      const groupNameInput = req.body.groupName || req.body.group || file.remoteMetadata?.groupName;
      const serieNameInput = req.body.serieName || req.body.seriesName || file.remoteMetadata?.serieName;
      const branchCodeInput = req.body.branchCode || req.body.branch_code || file.remoteMetadata?.branchCode;
      const requiresBranchCodeFlag = parseBoolean(req.body.requiresBranchCode || req.body.usesBranchCode);
      
      const derivedPrefix = deriveCompanyPrefix(company, prefixInput);
      const resolvedGroupName = groupNameInput || file.name || derivedPrefix;
      const resolvedSerieName = serieNameInput || resolvedGroupName;
      const sanitizedGroupName = sanitizeSegment(resolvedGroupName, { maxLength: 80 });
      const sanitizedSerieName = sanitizeSegment(resolvedSerieName, { maxLength: 80 });
      const sanitizedBranchCode = branchCodeInput ? sanitizeSegment(branchCodeInput, { maxLength: 40 }) : '';
      const requiresBranchCode = requiresBranchCodeFlag || Boolean(sanitizedBranchCode) || file.remoteMetadata?.requiresBranchCode;
      const companyDirectory = file.remoteMetadata?.companyDirectory || deriveCompanyDirectory(company, derivedPrefix);
      const remoteBaseDir = process.env.REMOTE_STORAGE_ROOT_DIR || '/lek-files';
      const remoteDirectory = file.remoteMetadata?.remoteDirectory || buildRemoteDirectoryPath({
        baseDir: remoteBaseDir,
        companyDir: companyDirectory,
        subdirectories: ['forecast-files', 'excel']
      });
      const remoteFilename = buildRemoteFilename({
        prefix: derivedPrefix,
        groupName: sanitizedGroupName,
        serieName: sanitizedSerieName,
        branchCode: sanitizedBranchCode,
        extension,
        useBranchCode: requiresBranchCode
      });
      const remoteFilePath = buildRemoteFilePath({
        baseDir: remoteBaseDir,
        companyDir: companyDirectory,
        subdirectories: ['forecast-files', 'excel'],
        filename: remoteFilename
      });
      
      let storageLocation;
      let appliedRemoteMetadata = file.remoteMetadata || null;
      
      if (remoteStorageService && remoteStorageService.isConnected()) {
        try {
          storageLocation = await remoteStorageService.uploadFile(tempFilePath, remoteFilePath);
          appliedRemoteMetadata = {
            prefix: derivedPrefix,
            groupName: sanitizedGroupName,
            serieName: sanitizedSerieName,
            branchCode: sanitizedBranchCode,
            requiresBranchCode: Boolean(requiresBranchCode),
            companyDirectory,
            remoteDirectory,
            remoteFilename
          };
          console.log('✅ Versión guardada en servidor remoto:', storageLocation);
          fs.unlinkSync(tempFilePath);
          
          try {
            await appendMetadataEntries(remoteStorageService, {
              prefix: derivedPrefix,
              groupName: sanitizedGroupName,
              serieName: sanitizedSerieName,
              branchCode: sanitizedBranchCode,
              remoteFilePath: storageLocation,
              user: req.user,
              company
            });
          } catch (metadataError) {
            console.warn('⚠️  No se pudo actualizar metadata CUE (versión):', metadataError.message);
          }
        } catch (uploadError) {
          console.error('❌ Error subiendo versión al servidor remoto, usando almacenamiento local:', uploadError);
          const uploadDir = process.env.UPLOAD_PATH || './uploads';
          const companyDir = path.join(uploadDir, req.user.companyId.toString(), 'versions');
          if (!fs.existsSync(companyDir)) {
            fs.mkdirSync(companyDir, { recursive: true });
          }
          storageLocation = path.join(companyDir, tempFilename);
          fs.renameSync(tempFilePath, storageLocation);
          storageLocation = path.normalize(storageLocation);
          console.log('⚠️  Versión guardada localmente (fallback):', storageLocation);
        }
      } else {
        const uploadDir = process.env.UPLOAD_PATH || './uploads';
        const companyDir = path.join(uploadDir, req.user.companyId.toString(), 'versions');
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }
        storageLocation = path.join(companyDir, tempFilename);
        fs.renameSync(tempFilePath, storageLocation);
        storageLocation = path.normalize(storageLocation);
        console.log('⚠️  Versión guardada localmente (sin servidor remoto):', storageLocation);
      }
      
      if (storageLocation && !storageLocation.startsWith('/')) {
        storageLocation = path.normalize(storageLocation);
      }
      
      // Actualizar el archivo principal con la nueva versión
      file.version += 1;
      file.name = req.file.originalname;
      file.originalName = req.file.originalname;
      file.size = req.file.size;
      file.storageLocation = storageLocation;
      file.uploadedBy = req.user._id;
      if (appliedRemoteMetadata) {
        file.remoteMetadata = appliedRemoteMetadata;
      }
      
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
      
      // Intentar eliminar el archivo temporal si hubo un error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (unlinkError) {
          console.error('Error al eliminar el archivo temporal:', unlinkError);
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
        
        // Determinar si el archivo está en servidor remoto o local
        // Intentar reconectar si no está conectado
        let remoteStorageService = await ensureRemoteStorageConnection();
        if (!remoteStorageService) {
          remoteStorageService = getRemoteStorageService();
        }
        const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
        const normalizedStorageLocation = (file.storageLocation || '').replace(/\\/g, '/');
        const isRemotePath = normalizedStorageLocation.startsWith(remoteRoot) ||
          normalizedStorageLocation.includes('/lek-files/');
        
        let filePath = file.storageLocation;
        
        // Si está en servidor remoto, descargarlo temporalmente
        if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
          try {
            const tempDir = path.join(os.tmpdir(), 'file-downloads');
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }
            const tempFilePath = path.join(tempDir, `download_${Date.now()}_${file.originalName || file.name}`);
            await remoteStorageService.downloadFile(file.storageLocation, tempFilePath);
            filePath = tempFilePath;
            console.log('Archivo descargado del servidor remoto a:', tempFilePath);
          } catch (downloadError) {
            console.error('Error descargando del servidor remoto:', downloadError);
            return res.status(500).json({
              success: false,
              error: {
                code: 'DOWNLOAD_ERROR',
                message: 'Error al descargar archivo del servidor remoto'
              }
            });
          }
        } else {
          // Verificar que el archivo existe localmente
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
        return res.download(filePath, file.originalName || file.name, (err) => {
          if (err) {
            console.error('Error al descargar archivo actual:', err);
          }
          // Limpiar archivo temporal si se descargó del servidor remoto
          if (filePath !== file.storageLocation && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (cleanupError) {
              console.error('Error eliminando archivo temporal:', cleanupError);
            }
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
    
    // Determinar si el archivo está en servidor remoto o local
    // Intentar reconectar si no está conectado
    let remoteStorageService = await ensureRemoteStorageConnection();
    if (!remoteStorageService) {
      remoteStorageService = getRemoteStorageService();
    }
    const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
    const normalizedVersionLocation = (version.storageLocation || '').replace(/\\/g, '/');
    const isRemotePath = normalizedVersionLocation.startsWith(remoteRoot) ||
      normalizedVersionLocation.includes('/lek-files/');
    
    let filePath = version.storageLocation;
    
    // Si está en servidor remoto, descargarlo temporalmente
    if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
      try {
        const tempDir = path.join(os.tmpdir(), 'file-downloads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, `download_${Date.now()}_${version.name}`);
        await remoteStorageService.downloadFile(version.storageLocation, tempFilePath);
        filePath = tempFilePath;
        console.log('Versión descargada del servidor remoto a:', tempFilePath);
      } catch (downloadError) {
        console.error('Error descargando versión del servidor remoto:', downloadError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: 'Error al descargar versión del servidor remoto'
          }
        });
      }
    } else {
      // Verificar que el archivo existe localmente
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
    res.download(filePath, version.name, (err) => {
      if (err) {
        console.error('Error al descargar versión:', err);
      }
      // Limpiar archivo temporal si se descargó del servidor remoto
      if (filePath !== version.storageLocation && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error('Error eliminando archivo temporal:', cleanupError);
        }
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
    
    // Determinar si el archivo de la versión está en servidor remoto o local
    // Intentar reconectar si no está conectado
    let remoteStorageService = await ensureRemoteStorageConnection();
    if (!remoteStorageService) {
      remoteStorageService = getRemoteStorageService();
    }
    const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
    const normalizedRevertLocation = (versionToRevert.storageLocation || '').replace(/\\/g, '/');
    const isRemotePath = normalizedRevertLocation.startsWith(remoteRoot) ||
      normalizedRevertLocation.includes('/lek-files/');
    
    // Si está en servidor remoto, descargarlo temporalmente
    let tempVersionPath = null;
    if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
      try {
        const tempDir = path.join(os.tmpdir(), 'file-revert');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        tempVersionPath = path.join(tempDir, `revert_${Date.now()}_${versionToRevert.name}`);
        await remoteStorageService.downloadFile(versionToRevert.storageLocation, tempVersionPath);
      } catch (downloadError) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: 'Error al descargar versión del servidor remoto para revertir'
          }
        });
      }
    } else {
      // Verificar que el archivo existe localmente
      if (!fs.existsSync(versionToRevert.storageLocation)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'VERSION_FILE_NOT_FOUND',
            message: 'El archivo físico de la versión no existe'
          }
        });
      }
      tempVersionPath = versionToRevert.storageLocation;
    }
    
    // Guardar la versión actual como histórico
    const currentVersion = await FileVersion.create({
      fileId: file._id,
      version: file.version,
      name: file.name,
      size: file.size,
      storageLocation: file.storageLocation,
      uploadedBy: file.uploadedBy,
      metadata: file.remoteMetadata || null
    });
    
    // Determinar ruta de almacenamiento para la nueva versión
    const extension = path.extname(versionToRevert.name) || path.extname(file.name) || '.xlsx';
    const revertPrefixInput = req.body.prefijo || req.body.prefix || versionToRevert.metadata?.prefix || file.remoteMetadata?.prefix;
    const revertGroupNameInput = req.body.groupName || versionToRevert.metadata?.groupName || file.remoteMetadata?.groupName || file.name;
    const revertSerieNameInput = req.body.serieName || versionToRevert.metadata?.serieName || versionToRevert.metadata?.groupName || file.remoteMetadata?.serieName || revertGroupNameInput;
    const revertBranchCodeInput = req.body.branchCode || versionToRevert.metadata?.branchCode || file.remoteMetadata?.branchCode;
    const revertRequiresBranch = parseBoolean(req.body.requiresBranchCode || req.body.usesBranchCode) ||
      versionToRevert.metadata?.requiresBranchCode || file.remoteMetadata?.requiresBranchCode;
    
    const derivedPrefix = deriveCompanyPrefix(company, revertPrefixInput);
    const sanitizedGroupName = sanitizeSegment(revertGroupNameInput, { maxLength: 80 });
    const sanitizedSerieName = sanitizeSegment(revertSerieNameInput || revertGroupNameInput, { maxLength: 80 });
    const sanitizedBranchCode = revertBranchCodeInput ? sanitizeSegment(revertBranchCodeInput, { maxLength: 40 }) : '';
    const companyDirectory = versionToRevert.metadata?.companyDirectory || file.remoteMetadata?.companyDirectory || deriveCompanyDirectory(company, derivedPrefix);
    const remoteBaseDir = process.env.REMOTE_STORAGE_ROOT_DIR || '/lek-files';
    const remoteDirectory = versionToRevert.metadata?.remoteDirectory || file.remoteMetadata?.remoteDirectory || buildRemoteDirectoryPath({
      baseDir: remoteBaseDir,
      companyDir: companyDirectory,
      subdirectories: ['forecast-files', 'excel']
    });
    const remoteFilename = buildRemoteFilename({
      prefix: derivedPrefix,
      groupName: sanitizedGroupName,
      serieName: sanitizedSerieName,
      branchCode: sanitizedBranchCode,
      extension,
      useBranchCode: revertRequiresBranch
    });
    const remoteFilePath = buildRemoteFilePath({
      baseDir: remoteBaseDir,
      companyDir: companyDirectory,
      subdirectories: ['forecast-files', 'excel'],
      filename: remoteFilename
    });

    let newPath;
    let newRemoteMetadata = file.remoteMetadata || null;
    
    if (remoteStorageService && remoteStorageService.isConnected()) {
      try {
        newPath = await remoteStorageService.uploadFile(tempVersionPath, remoteFilePath);
        console.log('✅ Versión revertida guardada en servidor remoto:', newPath);
        newRemoteMetadata = {
          prefix: derivedPrefix,
          groupName: sanitizedGroupName,
          serieName: sanitizedSerieName,
          branchCode: sanitizedBranchCode,
          requiresBranchCode: Boolean(revertRequiresBranch),
          companyDirectory,
          remoteDirectory,
          remoteFilename
        };
        try {
          await appendMetadataEntries(remoteStorageService, {
            prefix: derivedPrefix,
            groupName: sanitizedGroupName,
            serieName: sanitizedSerieName,
            branchCode: sanitizedBranchCode,
            remoteFilePath: newPath,
            user: req.user,
            company
          });
        } catch (metadataError) {
          console.warn('⚠️  No se pudo actualizar metadata CUE (revertir):', metadataError.message);
        }
        if (tempVersionPath !== versionToRevert.storageLocation && fs.existsSync(tempVersionPath)) {
          fs.unlinkSync(tempVersionPath);
        }
      } catch (uploadError) {
        console.error('❌ Error subiendo versión revertida al servidor remoto, usando almacenamiento local:', uploadError);
        const uploadDir = process.env.UPLOAD_PATH || './uploads';
        const companyDir = path.join(uploadDir, req.user.companyId.toString());
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }
        newPath = path.join(companyDir, remoteFilename);
        fs.copyFileSync(tempVersionPath, newPath);
        if (tempVersionPath !== versionToRevert.storageLocation && fs.existsSync(tempVersionPath)) {
          fs.unlinkSync(tempVersionPath);
        }
      }
    } else {
      // Guardar localmente
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      const companyDir = path.join(uploadDir, req.user.companyId.toString());
      if (!fs.existsSync(companyDir)) {
        fs.mkdirSync(companyDir, { recursive: true });
      }
      newPath = path.join(companyDir, remoteFilename);
      fs.copyFileSync(tempVersionPath, newPath);
      if (tempVersionPath !== versionToRevert.storageLocation && fs.existsSync(tempVersionPath)) {
        fs.unlinkSync(tempVersionPath);
      }
    }
    
    if (newPath && !newPath.startsWith('/')) {
      newPath = path.normalize(newPath);
    }
    
    // Actualizar el archivo principal
    file.version += 1;
    file.name = versionToRevert.name;
    file.size = versionToRevert.size;
    file.storageLocation = newPath;
    file.uploadedBy = req.user._id;
    if (newRemoteMetadata) {
      file.remoteMetadata = newRemoteMetadata;
    }
    
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