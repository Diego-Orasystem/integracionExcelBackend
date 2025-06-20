const Folder = require('../models/Folder');
const File = require('../models/File');
const Log = require('../models/Log');
const UserRole = require('../models/UserRole');
const Area = require('../models/Area');

// @desc    Crear carpeta
// @route   POST /api/folders
// @access  Privado
exports.createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    
    // Validar nombre
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'El nombre de la carpeta es obligatorio'
        }
      });
    }
    
    // Construir ruta de la carpeta
    let path = '';
    
    if (parentId) {
      // Verificar que la carpeta padre existe y pertenece a la empresa del usuario
      const parentFolder = await Folder.findOne({ 
        _id: parentId,
        companyId: req.user.companyId
      });
      
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PARENT_FOLDER_NOT_FOUND',
            message: 'La carpeta padre no existe o no tienes acceso a ella'
          }
        });
      }
      
      path = `${parentFolder.path}/${name}`;
      
      // Verificar que no existe otra carpeta con el mismo nombre en el mismo directorio
      const existingFolder = await Folder.findOne({
        name,
        parentId,
        companyId: req.user.companyId
      });
      
      if (existingFolder) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FOLDER_EXISTS',
            message: 'Ya existe una carpeta con ese nombre en ese directorio'
          }
        });
      }
    } else {
      // Carpeta raíz
      path = `/${name}`;
      
      // Verificar que no existe otra carpeta raíz con el mismo nombre
      const existingFolder = await Folder.findOne({
        name,
        parentId: null,
        companyId: req.user.companyId
      });
      
      if (existingFolder) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FOLDER_EXISTS',
            message: 'Ya existe una carpeta raíz con ese nombre'
          }
        });
      }
    }
    
    // Crear carpeta
    const folder = await Folder.create({
      name,
      parentId,
      path,
      companyId: req.user.companyId,
      createdBy: req.user._id
    });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_folder',
      entityType: 'folder',
      entityId: folder._id,
      details: {
        name: folder.name,
        path: folder.path,
        parentId: folder.parentId
      }
    });
    
    res.status(201).json({
      success: true,
      data: folder
    });
  } catch (error) {
    console.error('Error en createFolder:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear carpeta'
      }
    });
  }
};

// @desc    Listar carpetas
// @route   GET /api/folders
// @access  Privado
exports.listFolders = async (req, res) => {
  try {
    const { parentId } = req.query;
    // Obtener companyId como string y asegurarse de que es válido
    let companyId = req.query.companyId || null;
    // Detectar si estamos en modo gestión de carpetas (sin UI de explorador)
    const managementMode = req.query.management === 'true';
    
    // Validar que companyId sea un string no vacío
    if (companyId === '') {
      companyId = null;
    }
    
    console.log('Parámetros de listado de carpetas:', { 
      parentId, 
      companyId,
      managementMode,
      usuario: req.user ? { id: req.user._id, companyId: req.user.companyId, role: req.user.role } : 'Sin usuario'
    });
    
    // Construir filtro
    const filter = {};
    
    // Si es administrador, manejar el filtro de compañía
    if (req.user.role === 'admin') {
      if (companyId) {
        // Si se proporciona companyId, filtrar por esta compañía (modo explorador)
        console.log(`Admin solicitando carpetas de compañía específica: ${companyId}`);
        filter.companyId = companyId;
      } else if (!managementMode) {
        // Si estamos en modo explorador (no gestión) y no hay companyId, pedir seleccionar compañía
        console.log('Admin en explorador sin seleccionar compañía - DEBE SELECCIONAR UNA COMPAÑÍA');
        
        return res.status(200).json({
          success: true,
          message: 'Por favor seleccione una compañía para ver sus carpetas.',
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 50,
            pages: 0
          }
        });
      } else {
        // Estamos en modo gestión y somos admin, no aplicar filtro (ver todas las carpetas)
        console.log('Admin en modo gestión de carpetas - mostrando todas las carpetas');
      }
    } else {
      // Si no es admin, siempre filtrar por su propia compañía
      filter.companyId = req.user.companyId;
      console.log(`Usuario regular: filtrando carpetas por companyId: ${req.user.companyId}`);
    }
    
    // Si se especifica parentId, filtrar por él
    if (parentId) {
      filter.parentId = parentId;
    } else {
      // Carpetas raíz
      filter.parentId = null;
    }
    
    // Si el usuario es de tipo user_responsible, filtrar por su área asignada
    if (req.user.role === 'user_responsible' && req.query.noFilter !== 'true') {
      console.log('Usuario responsable - buscando UserRole para filtrar por área asignada');
      
      // Buscar asignación de área para el usuario responsable
      const userRoles = await UserRole.find({ 
        userId: req.user._id,
        active: true
      });
      
      if (userRoles && userRoles.length > 0) {
        // Obtener el ID de área del primer rol asignado al usuario
        const areaIds = userRoles
          .filter(role => role.areaId) // Filtrar roles con área asignada
          .map(role => role.areaId); // Extraer los IDs de área
        
        if (areaIds.length > 0) {
          // Buscar carpetas asociadas a las áreas del usuario
          const userAreas = await Area.find({ 
            _id: { $in: areaIds },
            companyId: req.user.companyId
          });
          
          if (userAreas && userAreas.length > 0) {
            const folderIds = userAreas
              .filter(area => area.folderId) // Filtrar áreas con carpeta asignada
              .map(area => area.folderId.toString()); // Extraer los IDs de carpeta
            
            console.log(`Usuario responsable: filtrando carpetas por áreas asignadas: ${JSON.stringify(folderIds)}`);
            
            if (folderIds.length > 0) {
              if (parentId) {
                // Si estamos dentro de una subcarpeta, verificar si pertenece a una de las áreas del usuario
                // Aquí mantenemos el filtro parentId pero verificamos que la carpeta actual esté en la jerarquía permitida
                let currentFolder = await Folder.findById(parentId);
                if (currentFolder) {
                  let isAllowed = false;
                  
                  // Verificar si la carpeta actual o alguna de sus ancestros está en las carpetas permitidas
                  while (currentFolder && !isAllowed) {
                    if (folderIds.includes(currentFolder._id.toString())) {
                      isAllowed = true;
                      break;
                    }
                    
                    if (!currentFolder.parentId) break;
                    currentFolder = await Folder.findById(currentFolder.parentId);
                  }
                  
                  if (!isAllowed) {
                    console.log('Usuario responsable: carpeta actual no pertenece a sus áreas asignadas');
                    return res.status(200).json({
                      success: true,
                      message: 'No tiene acceso a esta carpeta',
                      data: [],
                      pagination: {
                        total: 0,
                        page: 1,
                        limit: 50,
                        pages: 0
                      }
                    });
                  }
                }
              } else {
                // Si estamos en la raíz, solo mostrar las carpetas de área asignadas al usuario
                filter._id = { $in: folderIds };
                console.log('Usuario responsable en raíz - filtrando por IDs específicos de carpeta:', filter);
              }
            }
          }
        }
      }
    }
    
    console.log('Filtro final de búsqueda de carpetas:', JSON.stringify(filter));
    
    // Obtener carpetas
    const folders = await Folder.find(filter)
      .sort({ name: 1 });
    
    console.log(`Se encontraron ${folders.length} carpetas con el filtro aplicado`);
    
    // Para cada carpeta, contar archivos y subcarpetas
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const fileCount = await File.countDocuments({ folderId: folder._id });
        const subfolderCount = await Folder.countDocuments({ parentId: folder._id });
        
        return {
          _id: folder._id,
          name: folder.name,
          path: folder.path,
          createdAt: folder.createdAt,
          createdBy: folder.createdBy,
          companyId: folder.companyId, // Incluir companyId en la respuesta
          fileCount,
          subfolderCount,
          isFolder: true // Para que el frontend los muestre como carpetas
        };
      })
    );
    
    // Si es administrador viendo carpetas y no hay resultados, dar un mensaje explicativo
    if (foldersWithCounts.length === 0 && req.user.role === 'admin' && companyId) {
      const message = `No se encontraron carpetas para la compañía seleccionada (ID: ${companyId}). Puede que necesite crear carpetas primero.`;
      
      console.log(message);
      
      return res.status(200).json({
        success: true,
        message: message,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          pages: 0
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: foldersWithCounts,
      pagination: {
        total: foldersWithCounts.length,
        page: 1,
        limit: foldersWithCounts.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Error en listFolders:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al listar carpetas'
      }
    });
  }
};

// @desc    Obtener detalles de carpeta
// @route   GET /api/folders/:id
// @access  Privado
exports.getFolder = async (req, res) => {
  try {
    // Caso especial para "contents" - Listar carpetas raíz u otro contenido especial
    if (req.params.id === 'contents') {
      console.log('Petición especial para "contents" - Listando carpetas raíz');
      
      // Construir filtro para carpetas raíz (sin parentId)
      const filter = { parentId: null };
      
      // Si no es admin, restringir a la compañía del usuario
      if (req.user.role !== 'admin') {
        filter.companyId = req.user.companyId;
      } else if (req.query.companyId) {
        // Si es admin y se proporciona companyId en la consulta, usar esa compañía
        filter.companyId = req.query.companyId;
      }
      
      // Si el usuario es de tipo user_responsible, filtrar por su área asignada
      if (req.user.role === 'user_responsible' && req.query.noFilter !== 'true') {
        console.log('Usuario responsable en contents - buscando áreas asignadas');
        
        // Buscar asignación de área para el usuario responsable
        const userRoles = await UserRole.find({ 
          userId: req.user._id,
          active: true
        });
        
        if (userRoles && userRoles.length > 0) {
          // Obtener los IDs de área asignados al usuario
          const areaIds = userRoles
            .filter(role => role.areaId) // Filtrar roles con área asignada
            .map(role => role.areaId); // Extraer los IDs de área
          
          if (areaIds.length > 0) {
            // Buscar carpetas asociadas a las áreas del usuario
            const userAreas = await Area.find({ 
              _id: { $in: areaIds },
              companyId: req.user.companyId
            });
            
            if (userAreas && userAreas.length > 0) {
              const folderIds = userAreas
                .filter(area => area.folderId) // Filtrar áreas con carpeta asignada
                .map(area => area.folderId.toString()); // Extraer los IDs de carpeta
              
              console.log(`Usuario responsable en contents: filtrando por áreas: ${JSON.stringify(folderIds)}`);
              
              if (folderIds.length > 0) {
                // Solo mostrar las carpetas de área asignadas al usuario
                filter._id = { $in: folderIds };
              }
            }
          }
        }
      }
      
      console.log('Filtro final para contents:', JSON.stringify(filter));
      
      // Obtener las carpetas raíz para el usuario
      const rootFolders = await Folder.find(filter)
        .populate('createdBy', 'name email')
        .populate('companyId', 'name')
        .sort({ name: 1 });
        
      // Para cada carpeta, contar archivos y subcarpetas y buscar información del área asociada
      const foldersWithCounts = await Promise.all(
        rootFolders.map(async (folder) => {
          const fileCount = await File.countDocuments({ folderId: folder._id });
          const subfolderCount = await Folder.countDocuments({ parentId: folder._id });
          
          // Buscar área asociada a esta carpeta
          const area = await Area.findOne({ folderId: folder._id }).select('name defaultFileName isDefaultFileRequired');
          
          return {
            _id: folder._id,
            name: folder.name,
            path: folder.path,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
            createdBy: folder.createdBy,
            companyId: folder.companyId,
            parentId: folder.parentId,
            fileCount,
            subfolderCount,
            itemCount: fileCount + subfolderCount,
            isFolder: true, // Campo importante para el frontend
            // Incluir información del área si existe
            associatedArea: area ? {
              _id: area._id,
              name: area.name,
              defaultFileName: area.defaultFileName,
              isDefaultFileRequired: area.isDefaultFileRequired
            } : null
          };
        })
      );

      // Obtener archivos en carpetas raíz
      const parentId = req.query.parentId || null;
      const fileFilter = { folderId: parentId };
      if (req.user.role !== 'admin') {
        fileFilter.companyId = req.user.companyId;
      } else if (req.query.companyId) {
        fileFilter.companyId = req.query.companyId;
      }

      const files = await File.find(fileFilter)
        .sort({ createdAt: -1 });

      const filesProcessed = files.map(file => ({
        ...file.toObject(),
        isFolder: false // Marcar claramente como archivo, no carpeta
      }));
      
      // Devolver formato compatible con el frontend
      return res.status(200).json({
        success: true,
        count: foldersWithCounts.length + filesProcessed.length,
        // El frontend espera un array en data, no un objeto con folders y files
        data: [...foldersWithCounts, ...filesProcessed] 
      });
    }
    
    // Caso normal - buscar una carpeta específica por ID
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando carpeta con filtro:', filter);
    
    const folder = await Folder.findOne(filter)
      .populate('createdBy', 'name email')
      .populate('companyId', 'name'); // Añadir información de la compañía
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FOLDER_NOT_FOUND',
          message: 'Carpeta no encontrada o no tienes acceso a ella'
        }
      });
    }
    
    // Contar archivos y subcarpetas
    const fileCount = await File.countDocuments({ folderId: folder._id });
    const subfolderCount = await Folder.countDocuments({ parentId: folder._id });
    
    // Obtener información sobre la carpeta padre si existe
    let parentFolder = null;
    if (folder.parentId) {
      parentFolder = await Folder.findById(folder.parentId).select('name path');
    }
    
    // Buscar si esta carpeta está asociada a un área o subárea
    let associatedArea = await Area.findOne({ folderId: folder._id })
      .select('_id name defaultFileName isDefaultFileRequired');
    
    if (!associatedArea) {
      // Si no está asociada a un área, podría estar asociada a una subárea
      const SubArea = require('../models/SubArea');
      const associatedSubArea = await SubArea.findOne({ folderId: folder._id })
        .select('_id name areaId defaultFileName isDefaultFileRequired');
      
      if (associatedSubArea) {
        // Si está asociada a una subárea, buscar también el área padre
        const parentArea = await Area.findById(associatedSubArea.areaId)
          .select('_id name');
        
        associatedArea = {
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
    } else {
      // Si es un área, marcarla como tal
      associatedArea = {
        ...associatedArea.toObject(),
        isSubArea: false
      };
    }
    
    const folderData = {
      ...folder.toObject(),
      fileCount,
      subfolderCount,
      parentFolder,
      associatedArea
    };
    
    res.status(200).json({
      success: true,
      data: folderData
    });
  } catch (error) {
    console.error('Error en getFolder:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener información de la carpeta'
      }
    });
  }
};

// @desc    Eliminar carpeta
// @route   DELETE /api/folders/:id
// @access  Privado
exports.deleteFolder = async (req, res) => {
  try {
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando carpeta para eliminar con filtro:', filter);
    
    const folder = await Folder.findOne(filter);
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FOLDER_NOT_FOUND',
          message: 'Carpeta no encontrada o no tienes acceso a ella'
        }
      });
    }
    
    // Verificar que no tenga subcarpetas
    const subfolderCount = await Folder.countDocuments({ parentId: folder._id });
    if (subfolderCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FOLDER_NOT_EMPTY',
          message: 'No se puede eliminar una carpeta con subcarpetas'
        }
      });
    }
    
    // Verificar que no tenga archivos
    const fileCount = await File.countDocuments({ folderId: folder._id });
    if (fileCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FOLDER_HAS_FILES',
          message: 'No se puede eliminar una carpeta con archivos'
        }
      });
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_folder',
      entityType: 'folder',
      entityId: folder._id,
      details: {
        name: folder.name,
        path: folder.path
      }
    });
    
    // Eliminar carpeta
    await Folder.deleteOne({ _id: folder._id });
    
    console.log(`Carpeta eliminada correctamente: ${folder._id} (${folder.name})`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error en deleteFolder:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar carpeta'
      }
    });
  }
};

// @desc    Obtener ruta completa de carpetas
// @route   GET /api/folders/:id/path
// @access  Privado
exports.getFolderPath = async (req, res) => {
  try {
    // Construir filtro base
    const filter = { _id: req.params.id };
    
    // Si no es admin, restringir a la compañía del usuario
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando carpeta para obtener ruta con filtro:', filter);
    
    const folder = await Folder.findOne(filter);
    
    if (!folder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FOLDER_NOT_FOUND',
          message: 'Carpeta no encontrada o no tienes acceso a ella'
        }
      });
    }
    
    // Obtener la ruta completa (carpetas padres)
    const path = [];
    
    // Añadir la carpeta actual
    path.push({
      _id: folder._id,
      name: folder.name,
      path: folder.path
    });
    
    // Obtener carpetas padres
    let currentFolder = folder;
    while (currentFolder.parentId) {
      const parentFolder = await Folder.findById(currentFolder.parentId);
      if (!parentFolder) break;
      
      path.unshift({
        _id: parentFolder._id,
        name: parentFolder.name,
        path: parentFolder.path
      });
      
      currentFolder = parentFolder;
    }
    
    res.status(200).json({
      success: true,
      data: path
    });
  } catch (error) {
    console.error('Error en getFolderPath:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener ruta de carpeta'
      }
    });
  }
}; 