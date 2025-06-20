const SubArea = require('../models/SubArea');
const Area = require('../models/Area');
const Folder = require('../models/Folder');
const Log = require('../models/Log');
const File = require('../models/File');

/**
 * Función auxiliar para sanear el responsibleUserId
 * Si es una cadena vacía, retorna undefined para que MongoDB no intente convertirlo a ObjectId
 */
const sanitizeResponsibleUserId = (responsibleUserId) => {
  return responsibleUserId === '' ? undefined : responsibleUserId;
};

// @desc    Obtener todas las subáreas (con filtro opcional por área)
// @route   GET /api/subareas
// @access  Privado
exports.getSubAreas = async (req, res) => {
  try {
    // Iniciar filtro solo con active=true
    const filter = { active: true };
    
    // Obtener parámetros de consulta
    const { areaId, companyId } = req.query;
    
    // Si el usuario es admin y se proporciona un companyId específico, filtrar por esa compañía
    if (req.user.role === 'admin' && companyId) {
      console.log('Administrador filtrando por compañía específica:', companyId);
      filter.companyId = companyId;
    } 
    // Si no es admin, siempre filtrar por su propia compañía
    else if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
      console.log('Usuario regular: filtrando subáreas por companyId:', req.user.companyId);
    } else {
      console.log('Administrador: acceso a subáreas de todas las compañías');
    }
    
    // Si se proporciona un areaId como query param, filtrar por área
    if (areaId) {
      filter.areaId = areaId;
    }
    // Si la ruta tiene un parámetro areaId, usarlo (para compatibilidad con /areas/:areaId/subareas)
    else if (req.params.areaId) {
      filter.areaId = req.params.areaId;
      
      // Verificar que el área existe
      const areaFilter = {
        _id: req.params.areaId,
        active: true
      };
      
      // Añadir filtro de compañía para el área según la lógica anterior
      if (req.user.role === 'admin' && companyId) {
        areaFilter.companyId = companyId;
      } else if (req.user.role !== 'admin') {
        areaFilter.companyId = req.user.companyId;
      }
      
      const area = await Area.findOne(areaFilter);
      
      if (!area) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'AREA_NOT_FOUND',
            message: 'Área no encontrada'
          }
        });
      }
    }
    
    console.log('Buscando subáreas con filtro:', filter);
    
    // Obtener subáreas con el filtro aplicado
    const subareas = await SubArea.find(filter)
      .populate('responsibleUserId', 'name email')
      .populate('areaId', 'name')
      .populate('companyId', 'name') // Añadir info de compañía para admins
      .sort({ order: 1, name: 1 });
    
    console.log(`Se encontraron ${subareas.length} subáreas para el usuario ${req.user.name} (${req.user.role})`);
    
    res.status(200).json({
      success: true,
      count: subareas.length,
      data: subareas
    });
  } catch (error) {
    console.error('Error al obtener subáreas:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener las subáreas'
      }
    });
  }
};

// @desc    Obtener una subárea por ID
// @route   GET /api/subareas/:id
// @access  Privado
exports.getSubAreaById = async (req, res) => {
  try {
    console.log(`Solicitud para obtener subárea con ID: ${req.params.id}, Usuario: ${req.user._id} (${req.user.role})`);
    
    // Validar el formato del ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error(`ID de subárea inválido: ${req.params.id}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'El ID de la subárea tiene un formato inválido'
        }
      });
    }
    
    // Preparar el filtro de búsqueda
    const filter = { 
      _id: req.params.id,
      active: true 
    };
    
    // Solo filtramos por compañía si NO es administrador del sistema
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    console.log('Buscando subárea con filtro:', JSON.stringify(filter));
    
    try {
      const subarea = await SubArea.findOne(filter)
        .populate('responsibleUserId', 'name email')
        .populate('areaId', 'name')
        .populate('companyId', 'name'); // Añadir info de compañía para admins
      
      if (!subarea) {
        console.log(`Subárea no encontrada para el ID: ${req.params.id}`);
        return res.status(404).json({
          success: false,
          error: {
            code: 'SUBAREA_NOT_FOUND',
            message: 'Subárea no encontrada'
          }
        });
      }
      
      // Verificar que la subárea tenga los datos necesarios
      if (!subarea.companyId) {
        console.error(`Error: Subárea ${subarea._id} sin companyId asociado`);
      }
      
      if (!subarea.areaId) {
        console.error(`Error: Subárea ${subarea._id} sin areaId asociado`);
      }
      
      const companyName = subarea.companyId && subarea.companyId.name ? subarea.companyId.name : 'Desconocida';
      const areaName = subarea.areaId && subarea.areaId.name ? subarea.areaId.name : 'Desconocida';
      
      console.log(`Subárea encontrada: ${subarea._id} - ${subarea.name} (Área: ${areaName}, Compañía: ${companyName})`);
      
      res.status(200).json({
        success: true,
        data: subarea
      });
    } catch (dbError) {
      console.error('Error en la consulta a MongoDB:', dbError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Error en la consulta a la base de datos'
        }
      });
    }
  } catch (error) {
    console.error('Error al obtener subárea por ID:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener la subárea'
      }
    });
  }
};

// @desc    Crear una subárea nueva
// @route   POST /api/areas/:areaId/subareas o POST /api/subareas
// @access  Privado (Admin o Admin de Compañía)
exports.createSubArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear subáreas'
        }
      });
    }
    
    // Obtener areaId del parámetro de ruta o del cuerpo de la solicitud
    let areaId = req.params.areaId || req.body.areaId;
    
    if (!areaId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_AREA_ID',
          message: 'El ID del área es obligatorio'
        }
      });
    }
    
    const { name, description, responsibleUserId, icon, requiredFiles, defaultFileName, isDefaultFileRequired } = req.body;
    
    // Validar nombre
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'El nombre de la subárea es obligatorio'
        }
      });
    }
    
    // Verificar que el área existe y pertenece a la compañía del usuario
    const area = await Area.findOne({
      _id: areaId,
      companyId: req.user.companyId,
      active: true
    });
    
    if (!area) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AREA_NOT_FOUND',
          message: 'Área no encontrada'
        }
      });
    }
    
    // Verificar si ya existe una subárea con el mismo nombre en esta área
    const existingSubArea = await SubArea.findOne({
      name,
      areaId,
      companyId: req.user.companyId,
      active: true
    });
    
    if (existingSubArea) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBAREA_NAME_EXISTS',
          message: 'Ya existe una subárea con ese nombre en esta área'
        }
      });
    }
    
    // Crear subcarpeta para la subárea dentro de la carpeta del área
    const parentFolder = await Folder.findById(area.folderId);
    
    if (!parentFolder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PARENT_FOLDER_NOT_FOUND',
          message: 'No se encontró la carpeta del área'
        }
      });
    }
    
    const folder = await Folder.create({
      name,
      parentId: parentFolder._id,
      path: `${parentFolder.path}/${name}`,
      companyId: req.user.companyId,
      createdBy: req.user._id
    });
    
    // Sanear responsibleUserId - si es string vacío, establecerlo como undefined
    const sanitizedResponsibleUserId = sanitizeResponsibleUserId(responsibleUserId);
    
    // Preparar datos para crear subárea
    const subareaData = {
      name,
      description,
      areaId,
      companyId: req.user.companyId,
      responsibleUserId: sanitizedResponsibleUserId,
      icon,
      folderId: folder._id,
      requiredFiles: requiredFiles || [],
      expectedFiles: req.body.expectedFiles || 0
    };
    
    // Manejar el nombre de archivo por defecto
    if (defaultFileName) {
      // Si se proporciona un nombre específico, usarlo
      subareaData.defaultFileName = defaultFileName;
      subareaData.isDefaultFileRequired = isDefaultFileRequired !== undefined ? isDefaultFileRequired : false;
    } else if (area.defaultFileName) {
      // Heredar el nombre por defecto del área padre si existe
      subareaData.defaultFileName = area.defaultFileName;
      subareaData.isDefaultFileRequired = area.isDefaultFileRequired || false;
    }
    
    // Crear subárea
    const subarea = await SubArea.create(subareaData);
    
    // Registrar log
    try {
      await Log.create({
        userId: req.user._id,
        companyId: req.user.companyId,
        action: 'create_subarea',
        entityType: 'subarea',
        entityId: subarea._id,
        details: {
          name: subarea.name,
          areaId: areaId,
          folderId: folder._id,
          hasDefaultFileName: !!(defaultFileName || area.defaultFileName)
        }
      });
    } catch (logError) {
      console.warn('Error al registrar log de creación de subárea:', logError.message);
      // No interrumpimos el flujo por un error en el log
    }
    
    res.status(201).json({
      success: true,
      data: subarea
    });
  } catch (error) {
    console.error('Error al crear subárea:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear la subárea'
      }
    });
  }
};

// @desc    Actualizar una subárea
// @route   PUT /api/subareas/:id
// @access  Privado (Admin o Admin de Compañía)
exports.updateSubArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para editar subáreas'
        }
      });
    }
    
    const { name, description, responsibleUserId, icon, requiredFiles, active, expectedFiles, defaultFileName, isDefaultFileRequired } = req.body;
    
    // Buscar la subárea
    let subarea = await SubArea.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Si cambia el nombre, verificar que no esté duplicado
    if (name && name !== subarea.name) {
      const existingSubArea = await SubArea.findOne({
        name,
        areaId: subarea.areaId,
        companyId: req.user.companyId,
        _id: { $ne: req.params.id },
        active: true
      });
      
      if (existingSubArea) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'SUBAREA_NAME_EXISTS',
            message: 'Ya existe una subárea con ese nombre en esta área'
          }
        });
      }
      
      // Actualizar también el nombre de la carpeta asociada
      if (subarea.folderId) {
        await Folder.findByIdAndUpdate(subarea.folderId, { name });
      }
    }
    
    // Preparar objeto para actualizar
    const updateData = {
      name: name || subarea.name,
      description: description !== undefined ? description : subarea.description,
      responsibleUserId: responsibleUserId !== undefined ? sanitizeResponsibleUserId(responsibleUserId) : subarea.responsibleUserId,
      icon: icon || subarea.icon,
      active: active !== undefined ? active : subarea.active,
      expectedFiles: expectedFiles !== undefined ? expectedFiles : subarea.expectedFiles
    };
    
    // Si se envían archivos requeridos, actualizar el array completo
    if (requiredFiles) {
      updateData.requiredFiles = requiredFiles;
    }
    
    // Manejar el nombre de archivo por defecto
    if (defaultFileName !== undefined) {
      updateData.defaultFileName = defaultFileName;
      // Si se proporciona un nombre, podemos actualizar también el campo isRequired
      if (defaultFileName) {
        updateData.isDefaultFileRequired = isDefaultFileRequired !== undefined ? isDefaultFileRequired : false;
      } else {
        // Si se elimina el nombre (defaultFileName es null, undefined o ""), también eliminamos la configuración de requerido
        updateData.isDefaultFileRequired = false;
      }
    }
    
    // Actualizar subárea
    subarea = await SubArea.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    // Preparar detalles para el log
    const logDetails = {
      name: subarea.name,
      active: subarea.active
    };
    
    // Si se actualizó el nombre de archivo por defecto, añadir información al log
    if (defaultFileName !== undefined) {
      logDetails.defaultFileName = {
        updated: true,
        value: defaultFileName,
        isRequired: isDefaultFileRequired
      };
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'update_subarea',
      entityType: 'subarea',
      entityId: subarea._id,
      details: logDetails
    });
    
    res.status(200).json({
      success: true,
      data: subarea
    });
  } catch (error) {
    console.error('Error al actualizar subárea:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar la subárea'
      }
    });
  }
};

// @desc    Eliminar una subárea
// @route   DELETE /api/subareas/:id
// @access  Privado (Admin o Admin de Compañía)
exports.deleteSubArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar subáreas'
        }
      });
    }
    
    // Buscar la subárea
    const subarea = await SubArea.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Marcar como inactiva en lugar de eliminar (soft delete)
    await SubArea.findByIdAndUpdate(req.params.id, { active: false });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_subarea',
      entityType: 'subarea',
      entityId: subarea._id,
      details: {
        name: subarea.name,
        areaId: subarea.areaId
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar subárea:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar la subárea'
      }
    });
  }
};

// @desc    Crear subáreas predefinidas
// @route   POST /api/areas/:areaId/subareas/default
// @access  Privado (Admin o Admin de Compañía)
exports.createDefaultSubAreas = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear subáreas predefinidas'
        }
      });
    }
    
    const { areaId } = req.params;
    
    // Verificar que el área existe y pertenece a la compañía del usuario
    const area = await Area.findOne({
      _id: areaId,
      companyId: req.user.companyId,
      active: true
    });
    
    if (!area) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AREA_NOT_FOUND',
          message: 'Área no encontrada'
        }
      });
    }
    
    // Verificar que la carpeta del área existe
    const parentFolder = await Folder.findById(area.folderId);
    
    if (!parentFolder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PARENT_FOLDER_NOT_FOUND',
          message: 'No se encontró la carpeta del área'
        }
      });
    }
    
    // Definir subáreas predefinidas según el tipo de área
    let defaultSubAreas = [];
    
    switch (area.name) {
      case 'Finanzas':
        defaultSubAreas = [
          { name: 'Contabilidad', description: 'Registros contables y balances', icon: 'file-invoice-dollar' },
          { name: 'Presupuestos', description: 'Planificación y seguimiento presupuestario', icon: 'chart-pie' },
          { name: 'Tesorería', description: 'Gestión de flujo de efectivo', icon: 'cash-register' }
        ];
        break;
      case 'Recursos Humanos':
        defaultSubAreas = [
          { name: 'Reclutamiento', description: 'Selección de personal', icon: 'user-plus' },
          { name: 'Nómina', description: 'Gestión de salarios y compensaciones', icon: 'money-check-alt' },
          { name: 'Capacitación', description: 'Formación y desarrollo', icon: 'chalkboard-teacher' }
        ];
        break;
      case 'Operaciones':
        defaultSubAreas = [
          { name: 'Logística', description: 'Gestión de almacén y envíos', icon: 'truck' },
          { name: 'Producción', description: 'Procesos productivos', icon: 'industry' },
          { name: 'Control de Calidad', description: 'Aseguramiento de calidad', icon: 'clipboard-check' }
        ];
        break;
      case 'Administración':
        defaultSubAreas = [
          { name: 'Compras', description: 'Adquisiciones y proveedores', icon: 'shopping-cart' },
          { name: 'Informes Generales', description: 'Reportes administrativos', icon: 'file-alt' }
        ];
        break;
      case 'Ventas':
        defaultSubAreas = [
          { name: 'Marketing', description: 'Estrategias de mercadeo', icon: 'bullhorn' },
          { name: 'Comercial', description: 'Gestión comercial y ventas', icon: 'handshake' },
          { name: 'Atención al cliente', description: 'Soporte post-venta', icon: 'headset' }
        ];
        break;
      default:
        defaultSubAreas = [
          { name: 'General', description: 'Información general del área', icon: 'folder-open' }
        ];
    }
    
    const createdSubAreas = [];
    
    // Crear cada subárea predefinida
    for (const subareaData of defaultSubAreas) {
      // Verificar si ya existe
      const existingSubArea = await SubArea.findOne({
        name: subareaData.name,
        areaId,
        companyId: req.user.companyId,
        active: true
      });
      
      if (!existingSubArea) {
        // Crear subcarpeta
        const folder = await Folder.create({
          name: subareaData.name,
          parentId: parentFolder._id,
          path: `${parentFolder.path}/${subareaData.name}`,
          companyId: req.user.companyId,
          createdBy: req.user._id
        });
        
        // Crear subárea
        const subarea = await SubArea.create({
          ...subareaData,
          areaId,
          companyId: req.user.companyId,
          isDefault: true,
          folderId: folder._id,
          // Sanitizar responsibleUserId si existe en subareaData
          ...(subareaData.responsibleUserId && { 
            responsibleUserId: sanitizeResponsibleUserId(subareaData.responsibleUserId) 
          })
        });
        
        createdSubAreas.push(subarea);
      }
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_default_subareas',
      entityType: 'subarea',
      details: {
        areaId: areaId,
        count: createdSubAreas.length
      }
    });
    
    res.status(201).json({
      success: true,
      count: createdSubAreas.length,
      data: createdSubAreas
    });
  } catch (error) {
    console.error('Error al crear subáreas predefinidas:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear subáreas predefinidas'
      }
    });
  }
};

// @desc    Obtener archivos de ejemplo de una subárea
// @route   GET /api/subareas/:id/sample-files
// @access  Privado
exports.getSampleFiles = async (req, res) => {
  try {
    // Buscar la subárea
    const subarea = await SubArea.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      active: true
    }).populate({
      path: 'sampleFiles.fileId',
      select: 'name originalName size extension mimeType'
    });
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Verificar si la subárea tiene archivos de ejemplo
    const sampleFiles = subarea.sampleFiles || [];
    
    res.status(200).json({
      success: true,
      count: sampleFiles.length,
      data: sampleFiles
    });
  } catch (error) {
    console.error('Error al obtener archivos de ejemplo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener los archivos de ejemplo'
      }
    });
  }
};

// @desc    Añadir archivo de ejemplo a una subárea
// @route   POST /api/subareas/:id/sample-files
// @access  Privado (Admin o Admin de Compañía)
exports.addSampleFile = async (req, res) => {
  try {
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para añadir archivos de ejemplo'
        }
      });
    }
    
    const subarea = await SubArea.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      active: true
    });
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Verificar si ya tiene 3 archivos de ejemplo (límite del MVP)
    if (subarea.sampleFiles && subarea.sampleFiles.length >= 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_SAMPLE_FILES_REACHED',
          message: 'Ya se ha alcanzado el límite de 3 archivos de ejemplo por subárea'
        }
      });
    }
    
    // El archivo se debería subir usando multer u otro middleware
    // y el body debería contener la referencia al archivo subido
    const { fileId, name, description } = req.body;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'Se requiere un archivo'
        }
      });
    }
    
    // Verificar que el archivo existe
    const file = await File.findOne({
      _id: fileId,
      companyId: req.user.companyId
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
    
    // Verificar si el archivo ya está como ejemplo en esta subárea
    const fileExists = subarea.sampleFiles.some(f => f.fileId.toString() === fileId);
    if (fileExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_ALREADY_SAMPLE',
          message: 'Este archivo ya está añadido como ejemplo en esta subárea'
        }
      });
    }
    
    // Añadir archivo de ejemplo a la subárea
    subarea.sampleFiles.push({
      fileId,
      name: name || file.name,
      description: description || ''
    });
    
    await subarea.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'add_sample_file',
      entityType: 'subarea',
      entityId: subarea._id,
      details: {
        subareaName: subarea.name,
        fileName: file.name
      }
    });
    
    // Obtener la subárea actualizada con los archivos populados
    const updatedSubarea = await SubArea.findById(subarea._id).populate({
      path: 'sampleFiles.fileId',
      select: 'name originalName size extension mimeType'
    });
    
    res.status(200).json({
      success: true,
      data: updatedSubarea.sampleFiles
    });
  } catch (error) {
    console.error('Error al añadir archivo de ejemplo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al añadir archivo de ejemplo'
      }
    });
  }
};

// @desc    Eliminar archivo de ejemplo de una subárea
// @route   DELETE /api/subareas/:id/sample-files/:fileId
// @access  Privado (Admin o Admin de Compañía)
exports.removeSampleFile = async (req, res) => {
  try {
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar archivos de ejemplo'
        }
      });
    }
    
    const subarea = await SubArea.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
      active: true
    });
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Buscar el archivo de ejemplo en la subárea
    const sampleFileIndex = subarea.sampleFiles.findIndex(
      file => file._id.toString() === req.params.fileId
    );
    
    if (sampleFileIndex === -1) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SAMPLE_FILE_NOT_FOUND',
          message: 'Archivo de ejemplo no encontrado en esta subárea'
        }
      });
    }
    
    // Eliminar el archivo de ejemplo de la subárea (no elimina el archivo físico)
    const removedFile = subarea.sampleFiles.splice(sampleFileIndex, 1)[0];
    await subarea.save();
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'remove_sample_file',
      entityType: 'subarea',
      entityId: subarea._id,
      details: {
        subareaName: subarea.name,
        fileName: removedFile.name
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar archivo de ejemplo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar archivo de ejemplo'
      }
    });
  }
};

// @desc    Obtener subáreas por compañía
// @route   GET /api/companies/:companyId/subareas
// @access  Privado (para admin todas, para usuarios comunes solo su compañía)
exports.getSubAreasByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Verificar si el usuario tiene permiso para ver subáreas de esta compañía
    if (req.user.role !== 'admin' && req.user.companyId.toString() !== companyId) {
      console.log('Acceso denegado: usuario intenta acceder a subáreas de otra compañía');
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para ver subáreas de esta compañía'
        }
      });
    }
    
    console.log(`Buscando subáreas para la compañía ID: ${companyId}`);
    
    // Filtro opcional por área si se proporciona en la consulta
    const filter = {
      companyId: companyId,
      active: true
    };
    
    if (req.query.areaId) {
      filter.areaId = req.query.areaId;
      console.log(`Filtrando también por área ID: ${req.query.areaId}`);
    }
    
    // Buscar subáreas de la compañía
    const subareas = await SubArea.find(filter)
      .populate('responsibleUserId', 'name email')
      .populate('areaId', 'name')
      .populate('companyId', 'name')
      .sort({ order: 1, name: 1 });
    
    console.log(`Se encontraron ${subareas.length} subáreas para la compañía`);
    
    res.status(200).json({
      success: true,
      count: subareas.length,
      data: subareas
    });
  } catch (error) {
    console.error('Error al obtener subáreas por compañía:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener las subáreas'
      }
    });
  }
};

// @desc    Asignar plantilla Excel a una subárea
// @route   POST /api/subareas/:id/excel-template
// @access  Privado (Admin o Admin de Compañía)
exports.assignExcelTemplate = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para asignar plantillas de Excel a subáreas'
        }
      });
    }
    
    const { fileId, name, description } = req.body;
    
    // Validar datos requeridos
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILE_ID',
          message: 'El ID del archivo es obligatorio'
        }
      });
    }
    
    // Verificar que la subárea existe y puede ser modificada por el usuario
    const filter = { 
      _id: req.params.id,
      active: true 
    };
    
    // Solo filtramos por compañía si NO es administrador del sistema
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    const subarea = await SubArea.findOne(filter);
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    // Verificar que el archivo existe y es un Excel
    const file = await File.findOne({ 
      _id: fileId,
      companyId: subarea.companyId,
      mimeType: {
        $in: [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.oasis.opendocument.spreadsheet'
        ]
      }
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo Excel no encontrado o no es un archivo Excel válido'
        }
      });
    }
    
    // Verificar si ya existe una plantilla con el mismo archivo
    const existingTemplateIndex = subarea.sampleFiles.findIndex(
      template => template.fileId && template.fileId.toString() === fileId
    );
    
    if (existingTemplateIndex >= 0) {
      // Actualizar la plantilla existente
      subarea.sampleFiles[existingTemplateIndex] = {
        fileId: file._id,
        name: name || file.name,
        description: description || '',
        isExcelTemplate: true,
        uploadedAt: new Date()
      };
    } else {
      // Agregar una nueva plantilla
      subarea.sampleFiles.push({
        fileId: file._id,
        name: name || file.name,
        description: description || '',
        isExcelTemplate: true,
        uploadedAt: new Date()
      });
    }
    
    await subarea.save();
    
    // Registrar en el log
    await Log.create({
      userId: req.user._id,
      companyId: subarea.companyId,
      action: 'assign_excel_template',
      entityType: 'subarea',
      entityId: subarea._id,
      details: {
        subareaName: subarea.name,
        fileId: file._id,
        fileName: file.name
      }
    });
    
    res.status(200).json({
      success: true,
      data: subarea
    });
  } catch (error) {
    console.error('Error al asignar plantilla Excel a la subárea:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al asignar plantilla Excel a la subárea'
      }
    });
  }
};

// @desc    Eliminar plantilla Excel de una subárea
// @route   DELETE /api/subareas/:id/excel-template/:fileId
// @access  Privado (Admin o Admin de Compañía)
exports.removeExcelTemplate = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar plantillas de Excel de subáreas'
        }
      });
    }
    
    // Verificar que la subárea existe y puede ser modificada por el usuario
    const filter = { 
      _id: req.params.id,
      active: true 
    };
    
    // Solo filtramos por compañía si NO es administrador del sistema
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    const subarea = await SubArea.findOne(filter);
    
    if (!subarea) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBAREA_NOT_FOUND',
          message: 'Subárea no encontrada'
        }
      });
    }
    
    const fileId = req.params.fileId;
    
    // Verificar que la subárea tiene la plantilla Excel
    const templateIndex = subarea.sampleFiles.findIndex(
      file => file.fileId && file.fileId.toString() === fileId && file.isExcelTemplate
    );
    
    if (templateIndex === -1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'La plantilla Excel especificada no existe en esta subárea'
        }
      });
    }
    
    // Guardar info para el log
    const oldTemplateInfo = {
      fileId: subarea.sampleFiles[templateIndex].fileId,
      fileName: subarea.sampleFiles[templateIndex].name
    };
    
    // Eliminar la plantilla Excel
    subarea.sampleFiles.splice(templateIndex, 1);
    await subarea.save();
    
    // Registrar en el log
    await Log.create({
      userId: req.user._id,
      companyId: subarea.companyId,
      action: 'remove_excel_template',
      entityType: 'subarea',
      entityId: subarea._id,
      details: {
        subareaName: subarea.name,
        oldTemplate: oldTemplateInfo
      }
    });
    
    res.status(200).json({
      success: true,
      data: subarea
    });
  } catch (error) {
    console.error('Error al eliminar plantilla Excel de la subárea:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar plantilla Excel de la subárea'
      }
    });
  }
}; 