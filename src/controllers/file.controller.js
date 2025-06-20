const fs = require('fs');
const path = require('path');
const multer = require('multer');
const File = require('../models/File');
const Folder = require('../models/Folder');
const Log = require('../models/Log');
const { processExcelFile } = require('../services/sftp.service');
const fileStatusController = require('./file-status.controller');
const FileVersion = require('../models/FileVersion');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');

// Configuración de multer para carga de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    console.log('Directorio base de uploads:', uploadDir);
    
    const companyDir = path.join(uploadDir, req.user.companyId.toString());
    console.log('Directorio para la empresa:', companyDir);
    
    // Crear directorio si no existe
    if (!fs.existsSync(companyDir)) {
      console.log('Creando directorio de empresa ya que no existe');
      try {
        fs.mkdirSync(companyDir, { recursive: true });
        console.log('Directorio creado con éxito');
      } catch (dirError) {
        console.error('Error al crear directorio:', dirError);
        // Asegurarse de que el error se propague correctamente
        return cb(new Error(`No se pudo crear el directorio: ${dirError.message}`));
      }
    } else {
      console.log('El directorio de empresa ya existe');
      
      // Verificar permisos de escritura
      try {
        fs.accessSync(companyDir, fs.constants.W_OK);
        console.log('El directorio tiene permisos de escritura');
      } catch (accessError) {
        console.error('ERROR: El directorio no tiene permisos de escritura');
        return cb(new Error(`No hay permisos de escritura: ${accessError.message}`));
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
    const uniqueFilename = `${basename}_${timestamp}${extension}`;
    
    console.log('Nombre original:', originalname);
    console.log('Nombre único generado:', uniqueFilename);
    
    cb(null, uniqueFilename);
  }
});

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
        // Eliminar el archivo subido
        fs.unlinkSync(req.file.path);
        console.log('Archivo eliminado:', req.file.path);
        
        return res.status(404).json({
          success: false,
          error: {
            code: 'FOLDER_NOT_FOUND',
            message: 'La carpeta especificada no existe o no tienes acceso a ella'
          }
        });
      }
      
      console.log('Carpeta encontrada:', folder.name, folder._id);
      
      // Analizar el archivo Excel para extraer metadatos
      console.log('Procesando archivo Excel:', req.file.path);
      try {
        const metadata = await processExcelFile(req.file.path);
        console.log('Metadatos extraídos:', metadata);
        
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
          extension: path.extname(req.file.originalname),
          storageLocation: req.file.path,
          uploadedBy: req.user._id,
          uploadType: 'manual',
          status,
          processingDetails,
          metadata,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        };
        console.log(fileData);
        
        const newFile = await File.create(fileData);
        console.log('Archivo guardado en la base de datos con ID:', newFile._id);
        
        // Verificar que el archivo existe físicamente después de guardar
        if (fs.existsSync(req.file.path)) {
          const fileStats = fs.statSync(req.file.path);
          console.log(`Verificación: El archivo existe en disco (tamaño: ${fileStats.size} bytes)`);
        } else {
          console.error('ADVERTENCIA: El archivo no está en la ubicación esperada después de guardarlo');
        }
        
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
            status: newFile.status
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
            createdAt: newFile.createdAt
          }
        });
      } catch (processError) {
        console.error('Error procesando archivo Excel:', processError);
        // Eliminar el archivo si hay error en el procesamiento
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('Archivo eliminado por error de procesamiento:', req.file.path);
        }
        throw processError;
      }
    } catch (error) {
      console.error('Error en uploadFile:', error);
      
      // Intentar eliminar el archivo si hubo un error y el archivo existe
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('Archivo eliminado debido a error:', req.file.path);
        } catch (unlinkError) {
          console.error('Error al eliminar el archivo:', unlinkError);
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
        .select('name originalName size mimeType extension metadata tags createdAt updatedAt')
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
    
    // Registrar log de descarga
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'download_file',
      entityType: 'file',
      entityId: file._id,
      details: {
        fileName: file.name,
        fileSize: file.size
      }
    });
    
    // Enviar archivo
    res.download(file.storageLocation, file.originalName, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
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
    
    // Eliminar archivo del sistema de archivos
    if (fs.existsSync(file.storageLocation)) {
      fs.unlinkSync(file.storageLocation);
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
      .select('name originalName size mimeType extension metadata tags createdAt updatedAt')
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
      .select('name originalName size mimeType extension metadata createdAt')
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

module.exports = exports; 