const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const Log = require('../models/Log');
const { processExcelFile } = require('../services/sftp.service');
const { getRemoteStorageService, ensureRemoteStorageConnection } = require('../services/remote-storage.service');
const fileStatusController = require('./file-status.controller');
const FileVersion = require('../models/FileVersion');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
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

// Filtro para aceptar solo archivos Excel
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no soportado. Solo se permiten archivos Excel.'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite por defecto
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
          message: 'El archivo es demasiado grande. El límite es 10MB.'
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

// @desc    Subir archivo
// @route   POST /api/files/upload
// @access  Privado
exports.uploadFile = [
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    console.log('=== INICIO DE CARGA DE ARCHIVO ===');
    console.log('Datos de la petición:', {
      headers: req.headers,
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        filename: req.file.filename,
        destination: req.file.destination
      } : 'No hay archivo',
      user: req.user ? {
        id: req.user._id,
        companyId: req.user.companyId
      } : 'No hay usuario autenticado'
    });
    
    try {
      if (!req.file) {
        console.error('Error: No se proporcionó ningún archivo');
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No se ha proporcionado ningún archivo'
          }
        });
      }
      
      const { folderId, description, tags, initialStatus } = req.body;
      console.log('Datos procesados:', { folderId, description, tags, initialStatus });
      
      // Verificar que la carpeta existe y pertenece a la empresa del usuario
      console.log('Buscando carpeta:', folderId, 'para compañía:', req.user.companyId);
      const folder = await Folder.findOne({ 
        _id: folderId,
        companyId: req.user.companyId
      });
      
      if (!folder) {
        console.error('Error: Carpeta no encontrada o sin acceso');
        return res.status(404).json({
          success: false,
          error: {
            code: 'FOLDER_NOT_FOUND',
            message: 'La carpeta especificada no existe o no tienes acceso a ella'
          }
        });
      }
      
      console.log('Carpeta encontrada:', folder.name, folder._id);
      
      const company = await Company.findById(req.user.companyId);
      if (!company) {
        console.error('Error: Compañía no encontrada para el usuario');
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: 'La compañía asociada al usuario no existe'
          }
        });
      }
      
      // Guardar archivo temporalmente para procesarlo
      const tempDir = path.join(os.tmpdir(), 'excel-uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const extension = path.extname(req.file.originalname);
      const basename = path.basename(req.file.originalname, extension);
      const tempFilename = `${basename}_${timestamp}${extension}`;
      const tempFilePath = path.join(tempDir, tempFilename);

      // Escribir archivo temporal desde buffer
      fs.writeFileSync(tempFilePath, req.file.buffer);
      console.log('Archivo temporal creado:', tempFilePath);
      
      // Analizar el archivo Excel para extraer metadatos
      console.log('Procesando archivo Excel:', tempFilePath);
      try {
        const fileMetadata = await processExcelFile(tempFilePath);
        console.log('Metadatos extraídos:', fileMetadata);
        
        // Validar el estado inicial si se proporciona
        let status = 'pendiente';  // Estado por defecto
        let processingDetails = {};
        
        if (initialStatus && ['pendiente', 'procesando', 'procesado'].includes(initialStatus)) {
          status = initialStatus;
          
          // Si el estado es procesando o procesado, añadir detalles
          if (status === 'procesando') {
            processingDetails = {
              startDate: new Date(),
              processingNotes: 'Procesamiento iniciado automáticamente'
            };
          } else if (status === 'procesado') {
            const now = new Date();
            processingDetails = {
              startDate: now,
              endDate: now,
              duration: 0, // Instantáneo
              processingNotes: 'Archivo marcado como procesado al subir'
            };
          }
        }
        
        // Determinar ruta de almacenamiento (remoto o local)
        // Intentar reconectar si no está conectado
        let remoteStorageService = await ensureRemoteStorageConnection();
        if (!remoteStorageService) {
          remoteStorageService = getRemoteStorageService();
        }

        const prefixInput = req.body.prefijo || req.body.prefix || req.body.filePrefix;
        const groupNameInput = req.body.groupName || req.body.group || req.body.group_name;
        const serieNameInput = req.body.serieName || req.body.seriesName || req.body.serie_name;
        const branchCodeInput = req.body.branchCode || req.body.branch_code;
        const requiresBranchCodeFlag = parseBoolean(req.body.requiresBranchCode || req.body.usesBranchCode);

        const derivedPrefix = deriveCompanyPrefix(company, prefixInput);
        const resolvedGroupName = groupNameInput || folder.name || derivedPrefix;
        const resolvedSerieName = serieNameInput || resolvedGroupName;
        const sanitizedGroupName = sanitizeSegment(resolvedGroupName, { maxLength: 80 });
        const sanitizedSerieName = sanitizeSegment(resolvedSerieName, { maxLength: 80 });
        const sanitizedBranchCode = branchCodeInput ? sanitizeSegment(branchCodeInput, { maxLength: 40 }) : '';
        const requiresBranchCode = requiresBranchCodeFlag || Boolean(sanitizedBranchCode);
        const companyDirectory = deriveCompanyDirectory(company, derivedPrefix);
        const remoteBaseDir = process.env.REMOTE_STORAGE_ROOT_DIR || '/lek-files';
        const remoteDirectory = buildRemoteDirectoryPath({
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
        let appliedRemoteMetadata = null;

        if (remoteStorageService && remoteStorageService.isConnected()) {
          console.log('📤 Preparando subida al servidor remoto:');
          console.log('   Ruta remota generada:', remoteFilePath);
          console.log('   Nombre del archivo:', remoteFilename);
          console.log('   Directorio de la compañía:', companyDirectory);
          try {
            storageLocation = await remoteStorageService.uploadFile(tempFilePath, remoteFilePath);
            appliedRemoteMetadata = {
              prefix: derivedPrefix,
              groupName: sanitizedGroupName,
              serieName: sanitizedSerieName,
              branchCode: sanitizedBranchCode,
              requiresBranchCode,
              companyDirectory,
              remoteDirectory,
              remoteFilename
            };
            console.log('✅ Archivo guardado en servidor remoto:', storageLocation);
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
              console.warn('⚠️  No se pudo actualizar metadata CUE:', metadataError.message);
            }
          } catch (uploadError) {
            console.error('❌ Error subiendo al servidor remoto, usando almacenamiento local:', uploadError);
            const uploadDir = process.env.UPLOAD_PATH || './uploads';
            const companyDir = path.join(uploadDir, req.user.companyId.toString());
            if (!fs.existsSync(companyDir)) {
              fs.mkdirSync(companyDir, { recursive: true });
            }
            storageLocation = path.join(companyDir, tempFilename);
            fs.renameSync(tempFilePath, storageLocation);
            storageLocation = path.normalize(storageLocation);
            console.log('⚠️  Archivo guardado localmente (fallback):', storageLocation);
          }
        } else {
          // Fallback: guardar localmente si no hay servidor remoto
          const uploadDir = process.env.UPLOAD_PATH || './uploads';
          const companyDir = path.join(uploadDir, req.user.companyId.toString());
          if (!fs.existsSync(companyDir)) {
            fs.mkdirSync(companyDir, { recursive: true });
          }
          storageLocation = path.join(companyDir, tempFilename);
          fs.renameSync(tempFilePath, storageLocation);
          storageLocation = path.normalize(storageLocation);
          console.log('⚠️  Archivo guardado localmente (sin servidor remoto):', storageLocation);
        }
        
        // Normalizar la ruta de almacenamiento antes de guardarla en la BD
        if (storageLocation && !storageLocation.startsWith('/')) {
          storageLocation = path.normalize(storageLocation);
        }
        
        // Crear el registro del archivo
        console.log('Creando registro de archivo en la base de datos con datos:');
        const fileData = {
          name: req.file.originalname,
          originalName: req.file.originalname,
          description: description || '',
          folderId: folder._id,
          companyId: req.user.companyId,
          size: req.file.size,
          mimeType: req.file.mimetype,
          extension: extension,
          storageLocation: storageLocation,
          uploadedBy: req.user._id,
          uploadType: 'manual',
          status,
          processingDetails,
          metadata: fileMetadata,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          remoteMetadata: appliedRemoteMetadata
        };
        console.log(fileData);
        
        const newFile = await File.create(fileData);
        console.log('Archivo guardado en la base de datos con ID:', newFile._id);
        
        // Registrar log
        await Log.create({
          userId: req.user._id,
          companyId: req.user.companyId,
          action: 'upload_file',
          entityType: 'file',
          entityId: newFile._id,
          details: {
            path: folder.path,
            fileSize: req.file.size,
            fileName: req.file.originalname,
            status: newFile.status,
            storageType: appliedRemoteMetadata ? 'remote' : 'local'
          }
        });
        
        console.log('Log de actividad creado');
        console.log('=== FIN DE CARGA EXITOSA ===');
        
        res.status(201).json({
          success: true,
          data: {
            _id: newFile._id,
            name: newFile.name,
            size: newFile.size,
            mimeType: newFile.mimeType,
            status: newFile.status,
            metadata: newFile.metadata,
            remoteMetadata: newFile.remoteMetadata,
            createdAt: newFile.createdAt
          }
        });
      } catch (processError) {
        console.error('Error procesando archivo Excel:', processError);
        // Eliminar el archivo temporal si hay error en el procesamiento
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('Archivo temporal eliminado por error de procesamiento:', tempFilePath);
        }
        throw processError;
      }
    } catch (error) {
      console.error('Error en uploadFile:', error);
      
      // Intentar eliminar el archivo temporal si hubo un error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('Archivo temporal eliminado debido a error:', tempFilePath);
        } catch (unlinkError) {
          console.error('Error al eliminar el archivo temporal:', unlinkError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Error al subir el archivo: ' + error.message
        }
      });
    }
  }
];

// @desc    Listar archivos
// @route   GET /api/files
// @access  Privado
exports.listFiles = async (req, res) => {
  console.log('=== INICIO LISTADO DE ARCHIVOS ===');
  try {
    const { folderId, mimeType } = req.query;
    // Obtener companyId como string y asegurarse de que es válido
    let companyId = req.query.companyId || null;
    // Detectar si estamos en modo gestión de carpetas (sin UI de explorador)
    const managementMode = req.query.management === 'true';
    
    // Validar que companyId sea un string no vacío
    if (companyId === '') {
      companyId = null;
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    console.log('Parámetros de listado:', { 
      folderId, 
      companyId,
      managementMode,
      mimeType,
      page, 
      limit, 
      skip,
      usuario: req.user ? { id: req.user._id, companyId: req.user.companyId, role: req.user.role } : 'Sin usuario'
    });
    
    // Si se especifica mimeType pero no folderId, usar el filtro de tipo MIME
    if (mimeType && !folderId) {
      console.log(`Filtrando archivos por tipo MIME: ${mimeType}`);
      
      // Filtro base
      const filter = {};
      
      // Determinar qué companyId usar
      if (req.user.role === 'admin' && companyId) {
        // Admin puede filtrar por una compañía específica
        filter.companyId = companyId;
        console.log(`Admin filtrando por compañía específica: ${companyId}`);
      } else if (req.user.role !== 'admin') {
        // Usuarios no admin solo pueden ver archivos de su compañía
        filter.companyId = req.user.companyId;
        console.log(`Usuario regular: filtrando por su compañía: ${req.user.companyId}`);
      } else {
        console.log('Admin filtrando archivos sin restricción de compañía');
      }
      
      // Filtrar por tipo MIME
      if (mimeType === 'excel') {
        filter.mimeType = {
          $in: [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.oasis.opendocument.spreadsheet'
          ]
        };
      } else if (mimeType) {
        filter.mimeType = { $regex: mimeType, $options: 'i' };
      }
      
      console.log('Filtro aplicado para tipos MIME:', JSON.stringify(filter));
      
      // Contar total de archivos
      const total = await File.countDocuments(filter);
      
      // Obtener archivos paginados
      const files = await File.find(filter)
        .select('name originalName size mimeType extension metadata tags remoteMetadata createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      console.log(`Se encontraron ${files.length} archivos de tipo ${mimeType}`);
      
      return res.status(200).json({
        success: true,
        count: files.length,
        data: files,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }
    
    // Si no se especifica carpeta y es administrador,
    // buscar carpetas raíz de esa compañía
    if (!folderId) {
      if (req.user.role === 'admin') {
        console.log('Administrador explorando carpetas raíz');
        
        if (!companyId && !managementMode) {
          console.log('Admin solicitando carpetas sin especificar compañía - DEBE SELECCIONAR UNA COMPAÑÍA');
          
          return res.status(200).json({
            success: true,
            message: 'Seleccione una compañía para ver sus carpetas.',
            data: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 50,
              pages: 0
            }
          });
        }
        
        // Aplicar filtro de compañía para las carpetas raíz
        const carpetasFiltro = { parentId: null };
        
        if (companyId) {
          carpetasFiltro.companyId = companyId;
          console.log(`Buscando carpetas raíz de compañía específica: ${companyId}`);
        } else if (managementMode) {
          console.log('Admin en modo gestión, mostrando carpetas raíz de todas las compañías');
        }
        
        // Buscar carpetas raíz de la compañía seleccionada o todas si es modo gestión
        const carpetasRaiz = await Folder.find(carpetasFiltro).sort({ name: 1 });
        
        console.log(`Se encontraron ${carpetasRaiz.length} carpetas raíz`);
        
        // Transformar datos para frontend
        const carpetas = carpetasRaiz.map(carpeta => ({
          _id: carpeta._id,
          name: carpeta.name,
          path: carpeta.path,
          isFolder: true, // Para que el frontend los muestre como carpetas
          companyId: carpeta.companyId
        }));
        
        return res.status(200).json({
          success: true,
          message: 'Listando carpetas raíz. Seleccione una carpeta para ver archivos.',
          data: carpetas,
          pagination: {
            total: carpetasRaiz.length,
            page: 1,
            limit: carpetasRaiz.length,
            pages: 1
          }
        });
      } else {
        console.log('Error: No se especificó folderId');
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FOLDER',
            message: 'Debe especificar una carpeta para listar archivos'
          }
        });
      }
    }
    
    // Construir filtro base para archivos
    const filtroArchivos = { folderId };
    
    // Construir filtro para buscar la carpeta
    const carpetaFiltro = { _id: folderId };
    
    // Si es administrador, aplicar filtro de compañía si corresponde
    if (req.user.role === 'admin') {
      if (companyId && !managementMode) {
        carpetaFiltro.companyId = companyId;
        console.log(`Admin buscando carpeta ${folderId} de compañía específica: ${companyId}`);
      } else {
        console.log(`Admin buscando carpeta ${folderId} sin restricción de compañía`);
      }
    } else {
      // Si no es admin, siempre filtrar por su propia compañía
      carpetaFiltro.companyId = req.user.companyId;
      console.log(`Usuario regular: buscando carpeta de su compañía: ${req.user.companyId}`);
    }
    
    console.log('Filtro para buscar carpeta:', JSON.stringify(carpetaFiltro));
    const folder = await Folder.findOne(carpetaFiltro)
      .populate('companyId', 'name')
      .populate('createdBy', 'name email');
    
    if (!folder) {
      console.log('Error: Carpeta no encontrada o sin acceso');
      return res.status(404).json({
        success: false,
        error: {
          code: 'FOLDER_NOT_FOUND',
          message: 'La carpeta especificada no existe o no tienes acceso a ella'
        }
      });
    }
    
    // Asegurar que el filtro incluya la compañía de la carpeta encontrada
    filtroArchivos.companyId = folder.companyId;
    
    console.log('Carpeta encontrada:', folder.name, folder._id, 'Compañía:', folder.companyId);
    console.log('Filtro para buscar archivos:', JSON.stringify(filtroArchivos));
    
    // Buscar si esta carpeta está asociada a un área o subárea
    let folderInfo = {
      _id: folder._id,
      name: folder.name,
      path: folder.path,
      companyId: folder.companyId,
      createdBy: folder.createdBy
    };
    
    // Buscar área asociada
    const associatedArea = await Area.findOne({ folderId: folder._id })
      .select('_id name defaultFileName isDefaultFileRequired');
    
    if (associatedArea) {
      folderInfo.associatedArea = {
        _id: associatedArea._id,
        name: associatedArea.name,
        defaultFileName: associatedArea.defaultFileName,
        isDefaultFileRequired: associatedArea.isDefaultFileRequired,
        isSubArea: false
      };
    } else {
      // Si no está asociada a un área, podría estar asociada a una subárea
      const associatedSubArea = await SubArea.findOne({ folderId: folder._id })
        .select('_id name areaId defaultFileName isDefaultFileRequired');
      
      if (associatedSubArea) {
        // Si está asociada a una subárea, buscar también el área padre
        const parentArea = await Area.findById(associatedSubArea.areaId)
          .select('_id name');
        
        folderInfo.associatedArea = {
          _id: associatedSubArea._id,
          name: associatedSubArea.name,
          defaultFileName: associatedSubArea.defaultFileName,
          isDefaultFileRequired: associatedSubArea.isDefaultFileRequired,
          isSubArea: true,
          parentArea: parentArea ? {
            _id: parentArea._id,
            name: parentArea.name
          } : null
        };
      }
    }
    
    // Contar total de archivos
    const total = await File.countDocuments(filtroArchivos);
    
    // Obtener archivos paginados con su información detallada
    const files = await File.find(filtroArchivos)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    console.log(`Se encontraron ${files.length} archivos en la carpeta`);
    
    // Obtener subcarpetas para también mostrarlas
    const subcarpetas = await Folder.find({ parentId: folderId })
      .select('_id name path')
      .sort({ name: 1 });
    
    console.log(`Se encontraron ${subcarpetas.length} subcarpetas`);
    
    // Modificar subcarpetas para frontend
    const subcarpetasModificadas = subcarpetas.map(subcarpeta => ({
      ...subcarpeta.toObject(),
      isFolder: true // Para que el frontend las muestre como carpetas
    }));
    
    // Preparar respuesta combinando archivos y carpetas
    const filesAndFolders = [...subcarpetasModificadas, ...files];
    
    res.status(200).json({
      success: true,
      count: filesAndFolders.length,
      data: filesAndFolders,
      folderInfo: folderInfo,
      pagination: {
        total: total + subcarpetas.length, // Total de archivos más subcarpetas
        page,
        limit,
        pages: Math.ceil((total + subcarpetas.length) / limit)
      }
    });
  } catch (error) {
    console.error('Error en listFiles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al listar los archivos'
      }
    });
  }
};

// @desc    Obtener detalles de un archivo
// @route   GET /api/files/:id
// @access  Privado
exports.getFile = async (req, res) => {
  try {
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando archivo con filtro:', filter);
    
    const file = await File.findOne(filter)
      .populate('uploadedBy', 'name email')
      .populate('folderId', 'name path')
      .populate('companyId', 'name'); // Añadir información de la compañía
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o no tienes acceso a él'
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Error en getFile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener archivo'
      }
    });
  }
};

// @desc    Descargar archivo
// @route   GET /api/files/:id/download
// @access  Privado
exports.downloadFile = async (req, res) => {
  try {
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando archivo para descargar con filtro:', filter);
    
    const file = await File.findOne(filter);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o no tienes acceso a él'
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
    const normalizedStorageLocation = (file.storageLocation || '').replace(/\\/g, '/');
    const isRemotePath = normalizedStorageLocation.startsWith(remoteRoot) ||
      normalizedStorageLocation.includes('/lek-files/');
    
    console.log('=== INFORMACIÓN DE DESCARGA ===');
    console.log('Archivo ID:', file._id);
    console.log('Storage Location:', file.storageLocation);
    console.log('Remote Root:', remoteRoot);
    console.log('Es ruta remota?', isRemotePath);
    console.log('Servidor SFTP conectado?', remoteStorageService && remoteStorageService.isConnected());
    
    let filePath = file.storageLocation;
    
    // Si está en servidor remoto, descargarlo temporalmente
    if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
      console.log('Intentando descargar desde servidor remoto...');
      try {
        const tempDir = path.join(os.tmpdir(), 'file-downloads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `download_${Date.now()}_${file.originalName}`);
        await remoteStorageService.downloadFile(file.storageLocation, tempFilePath);
        filePath = tempFilePath;
        console.log('Archivo descargado del servidor remoto a:', tempFilePath);
      } catch (downloadError) {
        console.error('❌ Error descargando del servidor remoto:', downloadError);
        console.error('   Ruta intentada:', file.storageLocation);
        console.error('   Stack:', downloadError.stack);
        return res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: 'Error al descargar archivo del servidor remoto: ' + downloadError.message
          }
        });
      }
    } else {
      console.log('Buscando archivo localmente...');
      // Normalizar la ruta antes de verificar
      filePath = path.normalize(filePath);
      console.log('Ruta normalizada:', filePath);
      
      // Verificar que el archivo existe localmente
      if (!fs.existsSync(filePath)) {
        console.error('❌ Archivo no encontrado localmente en:', filePath);
        // Intentar con ruta absoluta si es relativa
        if (!path.isAbsolute(filePath)) {
          const uploadDir = process.env.UPLOAD_PATH || './uploads';
          const absolutePath = path.join(path.resolve(uploadDir), filePath);
          console.log('Intentando con ruta absoluta:', absolutePath);
          if (fs.existsSync(absolutePath)) {
            filePath = absolutePath;
            console.log('✅ Archivo encontrado en ruta absoluta');
          } else {
            return res.status(404).json({
              success: false,
              error: {
                code: 'FILE_NOT_FOUND',
                message: `El archivo no existe en el sistema. Ruta intentada: ${filePath}`
              }
            });
          }
        } else {
          return res.status(404).json({
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: `El archivo no existe en el sistema. Ruta intentada: ${filePath}`
            }
          });
        }
      } else {
        console.log('✅ Archivo encontrado localmente');
      }
    }
    
    // Registrar log de descarga
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'download_file',
      entityType: 'file',
      entityId: file._id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        storageType: isRemotePath ? 'remote' : 'local'
      }
    });
    
    // Enviar archivo
    res.download(filePath, file.originalName, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
      }
      // Limpiar archivo temporal si se descargó del servidor remoto
      if (filePath !== file.storageLocation && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Archivo temporal eliminado:', filePath);
        } catch (cleanupError) {
          console.error('Error eliminando archivo temporal:', cleanupError);
        }
      }
    });
  } catch (error) {
    console.error('Error en downloadFile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al descargar archivo'
      }
    });
  }
};

// @desc    Eliminar archivo
// @route   DELETE /api/files/:id
// @access  Privado
exports.deleteFile = async (req, res) => {
  try {
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando archivo para eliminar con filtro:', filter);
    
    const file = await File.findOne(filter);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o no tienes acceso a él'
        }
      });
    }
    
    // Eliminar archivo del sistema de archivos (remoto o local)
    // Intentar reconectar si no está conectado
    let remoteStorageService = await ensureRemoteStorageConnection();
    if (!remoteStorageService) {
      remoteStorageService = getRemoteStorageService();
    }
    const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
    const normalizedStorageLocation = (file.storageLocation || '').replace(/\\/g, '/');
    const isRemotePath = normalizedStorageLocation.startsWith(remoteRoot) || normalizedStorageLocation.includes('/lek-files/');
    
    if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
      try {
        await remoteStorageService.deleteFile(file.storageLocation);
        console.log('Archivo eliminado del servidor remoto:', file.storageLocation);
      } catch (deleteError) {
        console.error('Error eliminando archivo del servidor remoto:', deleteError);
        // Continuar con la eliminación del registro aunque falle la eliminación física
      }
    } else {
      // Eliminar archivo local
      if (fs.existsSync(file.storageLocation)) {
        fs.unlinkSync(file.storageLocation);
        console.log('Archivo eliminado localmente:', file.storageLocation);
      }
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_file',
      entityType: 'file',
      entityId: file._id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        folderId: file.folderId
      }
    });
    
    // Eliminar registro de la base de datos
    await File.deleteOne({ _id: file._id });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error en deleteFile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar archivo'
      }
    });
  }
};

// @desc    Buscar archivos
// @route   GET /api/files/search
// @access  Privado
exports.searchFiles = async (req, res) => {
  try {
    const { query, tags, companyId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    console.log('Parámetros de búsqueda:', { 
      query, 
      tags, 
      companyId,
      page, 
      limit,
      usuario: req.user ? { id: req.user._id, companyId: req.user.companyId, role: req.user.role } : 'Sin usuario'
    });
    
    // Construir filtro de búsqueda
    const filter = {};
    
    // Determinar qué companyId usar
    if (req.user.role === 'admin' && companyId) {
      // Admin puede filtrar por una compañía específica
      console.log(`Admin buscando archivos de compañía específica: ${companyId}`);
      filter.companyId = companyId;
    } else if (req.user.role !== 'admin') {
      // Usuarios no admin solo pueden ver archivos de su compañía
      filter.companyId = req.user.companyId;
    } else {
      console.log('Admin buscando archivos en todas las compañías');
    }
    
    // Buscar por nombre o descripción
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { originalName: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Filtrar por etiquetas
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }
    
    console.log('Filtro de búsqueda:', filter);
    
    // Contar total de archivos
    const total = await File.countDocuments(filter);
    
    // Obtener archivos paginados
    const files = await File.find(filter)
      .select('name originalName size mimeType extension metadata tags remoteMetadata createdAt updatedAt')
      .populate('folderId', 'name path')
      .populate('companyId', 'name') // Añadir info de la compañía
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    console.log(`Búsqueda completada: ${files.length} archivos encontrados de un total de ${total}`);
    
    res.status(200).json({
      success: true,
      data: files,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en searchFiles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al buscar archivos'
      }
    });
  }
};

// @desc    Obtener archivos por tipo MIME (por ejemplo, archivos Excel)
// @route   GET /api/files/by-type
// @access  Privado
exports.getFilesByMimeType = async (req, res) => {
  try {
    const { mimeType, companyId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    console.log('Buscando archivos por tipo MIME:', {
      mimeType,
      companyId,
      usuario: req.user ? { id: req.user._id, role: req.user.role } : 'Sin usuario'
    });
    
    // Filtro base
    const filter = {};
    
    // Determinar qué companyId usar
    if (req.user.role === 'admin' && companyId) {
      // Admin puede filtrar por una compañía específica
      filter.companyId = companyId;
    } else {
      // Usuarios no admin solo pueden ver archivos de su compañía
      filter.companyId = req.user.companyId;
    }
    
    // Filtrar por tipo MIME
    if (mimeType === 'excel') {
      filter.mimeType = {
        $in: [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.oasis.opendocument.spreadsheet'
        ]
      };
    } else if (mimeType) {
      filter.mimeType = { $regex: mimeType, $options: 'i' };
    }
    
    console.log('Filtro aplicado:', filter);
    
    // Contar total de archivos
    const total = await File.countDocuments(filter);
    
    // Obtener archivos paginados
    const files = await File.find(filter)
      .select('name originalName size mimeType extension metadata remoteMetadata createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    console.log(`Se encontraron ${files.length} archivos de tipo ${mimeType}`);
    
    res.status(200).json({
      success: true,
      count: files.length,
      data: files,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener archivos por tipo MIME:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener archivos por tipo'
      }
    });
  }
};

/**
 * @desc    Obtener métricas para visualización de archivos
 * @route   GET /api/files/metrics
 * @access  Privado
 */
exports.getFileMetricsData = fileStatusController.getFileMetrics;

/**
 * @desc    Obtener estadísticas detalladas por áreas
 * @route   GET /api/files/area-stats
 * @access  Privado
 */
exports.getAreaFileStatsData = fileStatusController.getAreaFileStats;

// @desc    Crear una versión de prueba de un archivo
// @route   POST /api/files/:id/test-version
// @access  Privado
exports.createTestVersion = async (req, res) => {
  try {
    const fileId = req.params.id;
    console.log(`Creando versión de prueba para archivo: ${fileId}`);
    
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
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(file.storageLocation)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'El archivo físico no existe en el sistema'
        }
      });
    }
    
    // Crear una copia del archivo para la versión
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const versionsDir = path.join(uploadDir, req.user.companyId.toString(), 'versions');
    
    // Crear directorio de versiones si no existe
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const extension = path.extname(file.name);
    const basename = path.basename(file.name, extension);
    const versionFileName = `${basename}_v${file.version}_${timestamp}${extension}`;
    const versionPath = path.join(versionsDir, versionFileName);
    
    // Copiar el archivo
    fs.copyFileSync(file.storageLocation, versionPath);
    
    // Crear registro de la versión actual
    const fileVersion = await FileVersion.create({
      fileId: file._id,
      version: file.version,
      name: file.name,
      size: file.size,
      storageLocation: file.storageLocation,
      uploadedBy: file.uploadedBy
    });
    
    console.log(`Versión ${file.version} creada con ID: ${fileVersion._id}`);
    
    // Incrementar la versión del archivo
    file.version += 1;
    file.storageLocation = versionPath;
    await file.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_test_version',
      entityType: 'file',
      entityId: file._id,
      details: {
        fileName: file.name,
        fileSize: file.size,
        version: file.version,
        previousVersionId: fileVersion._id
      }
    });
    
    res.status(200).json({
      success: true,
      data: {
        file: {
          _id: file._id,
          name: file.name,
          version: file.version
        },
        version: {
          _id: fileVersion._id,
          version: fileVersion.version,
          name: fileVersion.name
        },
        message: 'Versión de prueba creada exitosamente'
      }
    });
  } catch (error) {
    console.error('Error al crear versión de prueba:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear versión de prueba',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

// @desc    Diagnóstico de archivos - Verificar dónde se guardan y si existen
// @route   GET /api/files/diagnose
// @access  Público (sin autenticación)
exports.diagnoseFiles = async (req, res) => {
  try {
    const File = require('../models/File');
    const { getRemoteStorageService, ensureRemoteStorageConnection } = require('../services/remote-storage.service');
    
    // Obtener configuración
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const absoluteUploadDir = path.resolve(uploadDir);
    const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
    
    // Verificar estado del almacenamiento remoto
    let remoteStorageService = await ensureRemoteStorageConnection();
    if (!remoteStorageService) {
      remoteStorageService = getRemoteStorageService();
    }
    
    const remoteStorageConnected = remoteStorageService && remoteStorageService.isConnected();
    const remoteStorageConfig = {
      host: process.env.REMOTE_STORAGE_HOST,
      port: process.env.REMOTE_STORAGE_PORT || 22,
      rootDirectory: remoteRoot,
      connected: remoteStorageConnected
    };
    
    // Obtener archivos recientes (todos, sin filtrar por compañía)
    const recentFiles = await File.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id name storageLocation size createdAt companyId');
    
    // Verificar cada archivo
    const fileDiagnostics = await Promise.all(recentFiles.map(async (file) => {
      // Normalizar la ruta leída de la BD
      let storageLocation = file.storageLocation;
      if (storageLocation) {
        storageLocation = path.normalize(storageLocation);
      }
      
      const normalizedStorage = (storageLocation || '').replace(/\\/g, '/');
      const isRemotePath = normalizedStorage.startsWith(remoteRoot) ||
                           normalizedStorage.includes('/lek-files/');
      
      let exists = false;
      let existsError = null;
      let storageType = isRemotePath ? 'remote' : 'local';
      
      if (isRemotePath && remoteStorageConnected) {
        // Verificar en servidor remoto
        try {
          exists = await remoteStorageService.fileExists(storageLocation);
        } catch (error) {
          existsError = error.message;
        }
      } else if (!isRemotePath) {
        // Verificar localmente
        try {
          // Intentar con la ruta normalizada
          exists = fs.existsSync(storageLocation);
          if (!exists) {
            // Intentar con ruta absoluta si es relativa
            const uploadDir = process.env.UPLOAD_PATH || './uploads';
            const absolutePath = path.isAbsolute(storageLocation) 
              ? storageLocation 
              : path.join(path.resolve(uploadDir), storageLocation);
            exists = fs.existsSync(absolutePath);
            if (exists) {
              storageLocation = absolutePath;
            }
          }
          if (exists) {
            const stats = fs.statSync(storageLocation);
            exists = stats.isFile();
          }
        } catch (error) {
          existsError = error.message;
        }
      } else {
        existsError = 'Servidor remoto no conectado';
      }
      
      return {
        _id: file._id,
        name: file.name,
        storageLocation,
        storageType,
        exists,
        existsError,
        size: file.size,
        companyId: file.companyId,
        createdAt: file.createdAt
      };
    }));
    
    // Verificar directorio local
    const localDirExists = fs.existsSync(absoluteUploadDir);
    
    let allLocalFiles = [];
    let companyDirs = [];
    
    if (localDirExists) {
      try {
        // Listar todos los directorios de compañías
        const entries = fs.readdirSync(absoluteUploadDir, { withFileTypes: true });
        companyDirs = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);
        
        // Listar archivos en el directorio raíz
        allLocalFiles = entries
          .filter(entry => entry.isFile())
          .map(entry => entry.name)
          .slice(0, 20);
      } catch (error) {
        // Ignorar error
      }
    }
    
    // Estadísticas generales
    const totalFiles = await File.countDocuments({});
    const filesInDB = await File.find({}).select('storageLocation').limit(100); // Limitar para no sobrecargar
    
    let remoteFilesCount = 0;
    let localFilesCount = 0;
    let missingFilesCount = 0;
    
    for (const file of filesInDB) {
      // Normalizar la ruta leída de la BD
      let storageLocation = file.storageLocation;
      if (storageLocation) {
        storageLocation = path.normalize(storageLocation);
      }
      
      const normalizedStorage = (storageLocation || '').replace(/\\/g, '/');
      const isRemote = normalizedStorage.startsWith(remoteRoot) ||
                       normalizedStorage.includes('/lek-files/');
      
      if (isRemote) {
        remoteFilesCount++;
        if (remoteStorageConnected) {
          try {
            const exists = await remoteStorageService.fileExists(storageLocation);
            if (!exists) missingFilesCount++;
          } catch (error) {
            missingFilesCount++;
          }
        }
      } else {
        localFilesCount++;
        // Intentar verificar con ruta normalizada
        let fileExists = fs.existsSync(storageLocation);
        if (!fileExists && !path.isAbsolute(storageLocation)) {
          // Intentar con ruta absoluta
          const uploadDir = process.env.UPLOAD_PATH || './uploads';
          const absolutePath = path.join(path.resolve(uploadDir), storageLocation);
          fileExists = fs.existsSync(absolutePath);
        }
        if (!fileExists) {
          missingFilesCount++;
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        configuration: {
          uploadDir,
          absoluteUploadDir,
          remoteRoot,
          remoteStorage: remoteStorageConfig
        },
        directories: {
          localDirExists,
          companyDirs: companyDirs.slice(0, 20), // Limitar a 20 directorios
          localFilesCount: allLocalFiles.length,
          localFiles: allLocalFiles
        },
        statistics: {
          totalFilesInDB: totalFiles,
          remoteFilesCount,
          localFilesCount,
          missingFilesCount,
          checkedFiles: filesInDB.length
        },
        recentFiles: fileDiagnostics
      }
    });
  } catch (error) {
    console.error('Error en diagnoseFiles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al diagnosticar archivos',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

module.exports = exports; 