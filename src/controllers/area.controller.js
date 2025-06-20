const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
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

// @desc    Obtener todas las áreas de una compañía
// @route   GET /api/areas
// @access  Privado
exports.getAreas = async (req, res) => {
  try {
    let filter = { active: true };

    // Verificar si hay un filtro de compañía en la consulta
    const { companyId } = req.query;
    
    // Si el usuario es admin y se proporciona un companyId específico, filtrar por esa compañía
    if (req.user.role === 'admin' && companyId) {
      console.log('Administrador filtrando por compañía específica:', companyId);
      filter.companyId = companyId;
    } 
    // Si no es admin, siempre filtrar por su propia compañía
    else if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
      console.log('Usuario regular: filtrando áreas por companyId:', req.user.companyId);
    } else {
      console.log('Administrador: mostrando todas las áreas de todas las compañías');
    }
    
    console.log('Filtro aplicado:', filter);
    
    // Obtener todas las áreas según el filtro
    const areas = await Area.find(filter)
    .populate('responsibleUserId', 'name email')
    .populate('companyId', 'name') // Agregar info de la compañía para admins
    .sort({ order: 1, name: 1 });
    
    console.log(`Se encontraron ${areas.length} áreas para el usuario ${req.user.name} (${req.user.role})`);
    
    res.status(200).json({
      success: true,
      count: areas.length,
      data: areas
    });
  } catch (error) {
    console.error('Error al obtener áreas:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener las áreas'
      }
    });
  }
};

// @desc    Obtener un área por ID
// @route   GET /api/areas/:id
// @access  Privado
exports.getAreaById = async (req, res) => {
  try {
    console.log(`Solicitud para obtener área con ID: ${req.params.id}, Usuario: ${req.user._id} (${req.user.role}), Compañía: ${req.user.companyId} (${req.user.email})`);
    
    // Validar el formato del ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.error(`ID de área inválido: ${req.params.id}`);
      console.error(`Tipo de ID recibido: ${typeof req.params.id}, Longitud: ${req.params.id.length}`);
      console.error(`Valor completo recibido en req.params: ${JSON.stringify(req.params)}`);
      console.error(`Valor completo de la URL: ${req.originalUrl}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'El ID del área tiene un formato inválido',
          details: `ID recibido: "${req.params.id}" no es un ObjectId válido de MongoDB`
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
    
    console.log('Buscando área con filtro:', JSON.stringify(filter));
    
    try {
      const area = await Area.findOne(filter)
        .populate('responsibleUserId', 'name email')
        .populate('companyId', 'name'); // Agregar info de la compañía
      
      if (!area) {
        console.log(`Área no encontrada para el ID: ${req.params.id}`);
        
        // Verificar si el área existe pero para otra compañía o está inactiva
        const anyArea = await Area.findById(req.params.id);
        if (anyArea) {
          console.log(`El área existe pero no está accesible para este usuario. Compañía del área: ${anyArea.companyId}, Activa: ${anyArea.active}`);
          if (anyArea.companyId.toString() !== req.user.companyId && req.user.role !== 'admin') {
            console.log('El área pertenece a otra compañía');
          }
          if (!anyArea.active) {
            console.log('El área está inactiva');
          }
        } else {
          console.log('El área no existe en absoluto en la base de datos');
        }
        
        return res.status(404).json({
          success: false,
          error: {
            code: 'AREA_NOT_FOUND',
            message: 'Área no encontrada'
          }
        });
      }
      
      // Verificar que el área tenga los datos necesarios
      if (!area.companyId) {
        console.error(`Error: Área ${area._id} sin companyId asociado`);
      }
      
      const companyName = area.companyId && area.companyId.name ? area.companyId.name : 'Desconocida';
      console.log(`Área encontrada: ${area._id} - ${area.name} (Compañía: ${companyName})`);
      
      res.status(200).json({
        success: true,
        data: area
      });
    } catch (dbError) {
      console.error('Error en la consulta a MongoDB:', dbError);
      console.error('Detalles del error:', {
        name: dbError.name,
        message: dbError.message,
        code: dbError.code,
        keyValue: dbError.keyValue
      });
      console.error('Stack trace:', dbError.stack);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Error en la consulta a la base de datos',
          details: dbError.message
        }
      });
    }
  } catch (error) {
    console.error('Error al obtener área por ID:', error);
    console.error('Tipo de error:', error.name);
    console.error('Mensaje de error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener el área',
        details: error.message
      }
    });
  }
};

// @desc    Crear un área nueva
// @route   POST /api/areas
// @access  Privado (Admin o Admin de Compañía)
exports.createArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear áreas'
        }
      });
    }
    
    const { name, description, responsibleUserId, icon, color, companyId, defaultFileName, isDefaultFileRequired } = req.body;
    
    // Validar nombre
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'El nombre del área es obligatorio'
        }
      });
    }
    
    // Determinar qué companyId usar
    let targetCompanyId = req.user.companyId;
    
    // Si se proporciona un companyId y el usuario es admin, permitir crear área para otra compañía
    if (companyId && req.user.role === 'admin') {
      targetCompanyId = companyId;
      console.log('Creando área para compañía específica:', targetCompanyId);
    }
    
    console.log('Datos para crear área:', {
      name,
      companyId: targetCompanyId,
      userCompanyId: req.user.companyId
    });
    
    // Verificar si ya existe un área con el mismo nombre en esta compañía
    const existingArea = await Area.findOne({
      name,
      companyId: targetCompanyId,
      active: true
    });
    
    if (existingArea) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AREA_NAME_EXISTS',
          message: 'Ya existe un área con ese nombre en esta compañía'
        }
      });
    }
    
    // Crear carpeta asociada para el área
    const folder = await Folder.create({
      name,
      parentId: null, // Carpeta raíz para el área
      path: `/${name}`,
      companyId: targetCompanyId,
      createdBy: req.user._id
    });
    
    // Preparar datos para crear el área
    const areaData = {
      name,
      description,
      companyId: targetCompanyId,
      responsibleUserId: sanitizeResponsibleUserId(responsibleUserId),
      icon,
      color,
      folderId: folder._id,
      expectedFiles: req.body.expectedFiles || 0
    };
    
    // Agregar nombre de archivo por defecto si se proporciona
    if (defaultFileName) {
      areaData.defaultFileName = defaultFileName;
      areaData.isDefaultFileRequired = isDefaultFileRequired || false;
    }
    
    // Crear área
    const area = await Area.create(areaData);
    
    console.log('Área creada:', {
      id: area._id,
      name: area.name,
      companyId: area.companyId
    });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_area',
      entityType: 'area',
      entityId: area._id,
      details: {
        name: area.name,
        folderId: folder._id,
        hasDefaultFileName: !!defaultFileName
      }
    });
    
    res.status(201).json({
      success: true,
      data: area
    });
  } catch (error) {
    console.error('Error al crear área:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear el área'
      }
    });
  }
};

// @desc    Actualizar un área
// @route   PUT /api/areas/:id
// @access  Privado (Admin o Admin de Compañía)
exports.updateArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para editar áreas'
        }
      });
    }
    
    const { name, description, responsibleUserId, icon, color, active, companyId, expectedFiles, defaultFileName, isDefaultFileRequired } = req.body;
    
    // Buscar el área
    let area = await Area.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
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
    
    console.log('Datos del área antes de actualizar:', {
      id: area._id,
      currentCompanyId: area.companyId,
      requestedCompanyId: companyId
    });
    
    // Si cambia el nombre, verificar que no esté duplicado
    if (name && name !== area.name) {
      const existingArea = await Area.findOne({
        name,
        companyId: req.user.companyId,
        _id: { $ne: req.params.id },
        active: true
      });
      
      if (existingArea) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AREA_NAME_EXISTS',
            message: 'Ya existe un área con ese nombre en esta compañía'
          }
        });
      }
      
      // Actualizar también el nombre de la carpeta asociada
      if (area.folderId) {
        await Folder.findByIdAndUpdate(area.folderId, { name });
      }
    }
    
    // Verificar si se intenta cambiar la compañía y el usuario tiene permisos
    if (companyId && companyId !== area.companyId.toString()) {
      // Solo un admin puede cambiar la compañía de un área
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Solo administradores pueden cambiar la compañía de un área'
          }
        });
      }
      
      console.log('Cambiando compañía del área de', area.companyId, 'a', companyId);
    }
    
    // Preparar objeto de actualización
    const updateData = {
      name: name || area.name,
      description: description !== undefined ? description : area.description,
      responsibleUserId: responsibleUserId !== undefined ? sanitizeResponsibleUserId(responsibleUserId) : area.responsibleUserId,
      icon: icon || area.icon,
      color: color || area.color,
      active: active !== undefined ? active : area.active,
      expectedFiles: expectedFiles !== undefined ? expectedFiles : area.expectedFiles
    };
    
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
    
    // Añadir companyId solo si se proporciona y es diferente
    if (companyId && companyId !== area.companyId.toString()) {
      updateData.companyId = companyId;
    }
    
    console.log('Datos para actualizar:', updateData);
    
    // Actualizar área
    area = await Area.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    console.log('Área después de actualizar:', {
      id: area._id,
      companyId: area.companyId
    });
    
    // Si se cambió la compañía, actualizar también las subáreas
    if (companyId && companyId !== area.companyId.toString() && area.active) {
      try {
        // Actualizar la carpeta asociada
        if (area.folderId) {
          await Folder.findByIdAndUpdate(area.folderId, { companyId: companyId });
          console.log(`Carpeta ${area.folderId} actualizada a companyId: ${companyId}`);
        }
        
        // Buscar todas las subáreas asociadas a esta área
        const subareas = await SubArea.find({ areaId: area._id });
        console.log(`Actualizando companyId en ${subareas.length} subáreas asociadas`);
        
        // Actualizar cada subárea y su carpeta
        for (const subarea of subareas) {
          await SubArea.findByIdAndUpdate(
            subarea._id,
            { companyId: companyId }
          );
          console.log(`Subárea ${subarea._id} actualizada a companyId: ${companyId}`);
          
          // Actualizar la carpeta de la subárea si existe
          if (subarea.folderId) {
            await Folder.findByIdAndUpdate(subarea.folderId, { companyId: companyId });
            console.log(`Carpeta de subárea ${subarea.folderId} actualizada a companyId: ${companyId}`);
          }
        }
      } catch (subError) {
        console.error('Error al actualizar elementos asociados:', subError);
        // No interrumpimos el flujo por un error en la actualización
      }
    }
    
    // Preparar detalles para el log
    const logDetails = {
      name: area.name,
      active: area.active
    };
    
    // Si se cambió la compañía, añadir información al log
    if (companyId && companyId !== area.companyId.toString()) {
      logDetails.companyIdChanged = {
        from: area.companyId.toString(),
        to: companyId
      };
    }
    
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
      action: 'update_area',
      entityType: 'area',
      entityId: area._id,
      details: logDetails
    });
    
    res.status(200).json({
      success: true,
      data: area
    });
  } catch (error) {
    console.error('Error al actualizar área:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar el área'
      }
    });
  }
};

// @desc    Eliminar un área
// @route   DELETE /api/areas/:id
// @access  Privado (Admin o Admin de Compañía)
exports.deleteArea = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar áreas'
        }
      });
    }
    
    // Buscar el área
    const area = await Area.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
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
    
    // Verificar si tiene subáreas
    const subAreaCount = await SubArea.countDocuments({
      areaId: req.params.id,
      active: true
    });
    
    if (subAreaCount > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AREA_HAS_SUBAREAS',
          message: 'El área tiene subáreas asociadas. Elimina primero las subáreas.'
        }
      });
    }
    
    // Marcar como inactiva en lugar de eliminar (soft delete)
    await Area.findByIdAndUpdate(req.params.id, { active: false });
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'delete_area',
      entityType: 'area',
      entityId: area._id,
      details: {
        name: area.name
      }
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar área:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar el área'
      }
    });
  }
};

// @desc    Crear áreas predefinidas
// @route   POST /api/areas/default
// @access  Privado (Admin o Admin de Compañía)
exports.createDefaultAreas = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para crear áreas predefinidas'
        }
      });
    }
    
    // Áreas predefinidas
    const defaultAreas = [
      {
        name: 'Finanzas',
        description: 'Área financiera de la empresa',
        icon: 'money-bill-wave',
        color: '#2ecc71'
      },
      {
        name: 'Recursos Humanos',
        description: 'Gestión del personal',
        icon: 'users',
        color: '#3498db'
      },
      {
        name: 'Operaciones',
        description: 'Operaciones y logística',
        icon: 'cogs',
        color: '#e74c3c'
      },
      {
        name: 'Administración',
        description: 'Administración general',
        icon: 'building',
        color: '#f39c12'
      },
      {
        name: 'Ventas',
        description: 'Departamento de ventas',
        icon: 'chart-line',
        color: '#9b59b6'
      }
    ];
    
    const createdAreas = [];
    
    // Crear cada área predefinida
    for (const areaData of defaultAreas) {
      // Verificar si ya existe
      const existingArea = await Area.findOne({
        name: areaData.name,
        companyId: req.user.companyId,
        active: true
      });
      
      if (!existingArea) {
        // Crear carpeta asociada
        const folder = await Folder.create({
          name: areaData.name,
          parentId: null,
          path: `/${areaData.name}`,
          companyId: req.user.companyId,
          createdBy: req.user._id
        });
        
        // Crear área
        const area = await Area.create({
          ...areaData,
          companyId: req.user.companyId,
          isDefault: true,
          folderId: folder._id,
          // Sanitizar responsibleUserId si existe en areaData
          ...(areaData.responsibleUserId && { 
            responsibleUserId: sanitizeResponsibleUserId(areaData.responsibleUserId) 
          })
        });
        
        createdAreas.push(area);
      }
    }
    
    // Registrar log
    await Log.create({
      userId: req.user._id,
      companyId: req.user.companyId,
      action: 'create_default_areas',
      entityType: 'area',
      details: {
        count: createdAreas.length
      }
    });
    
    res.status(201).json({
      success: true,
      count: createdAreas.length,
      data: createdAreas
    });
  } catch (error) {
    console.error('Error al crear áreas predefinidas:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear áreas predefinidas'
      }
    });
  }
};

// @desc    Obtener áreas por compañía
// @route   GET /api/companies/:companyId/areas
// @access  Privado (para admin todas, para usuarios comunes solo su compañía)
exports.getAreasByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Verificar si el usuario tiene permiso para ver áreas de esta compañía
    if (req.user.role !== 'admin' && req.user.companyId.toString() !== companyId) {
      console.log('Acceso denegado: usuario intenta acceder a áreas de otra compañía');
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para ver áreas de esta compañía'
        }
      });
    }
    
    console.log(`Buscando áreas para la compañía ID: ${companyId}`);
    
    // Buscar áreas de la compañía
    const areas = await Area.find({
      companyId: companyId,
      active: true
    })
    .populate('responsibleUserId', 'name email')
    .populate('companyId', 'name')
    .sort({ order: 1, name: 1 });
    
    console.log(`Se encontraron ${areas.length} áreas para la compañía`);
    
    res.status(200).json({
      success: true,
      count: areas.length,
      data: areas
    });
  } catch (error) {
    console.error('Error al obtener áreas por compañía:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener las áreas'
      }
    });
  }
};

// @desc    Asignar plantilla Excel a un área
// @route   POST /api/areas/:id/excel-template
// @access  Privado (Admin o Admin de Compañía)
exports.assignExcelTemplate = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para asignar plantillas de Excel a áreas'
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
    
    // Verificar que el área existe y puede ser modificada por el usuario
    const filter = { 
      _id: req.params.id,
      active: true 
    };
    
    // Solo filtramos por compañía si NO es administrador del sistema
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    const area = await Area.findOne(filter);
    
    if (!area) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AREA_NOT_FOUND',
          message: 'Área no encontrada'
        }
      });
    }
    
    // Verificar que el archivo existe y es un Excel
    const file = await File.findOne({ 
      _id: fileId,
      companyId: area.companyId,
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
    
    // Asignar la plantilla Excel
    area.excelTemplate = {
      fileId: file._id,
      name: name || file.name,
      description: description || '',
      uploadedAt: new Date()
    };
    
    await area.save();
    
    // Registrar en el log
    await Log.create({
      userId: req.user._id,
      companyId: area.companyId,
      action: 'assign_excel_template',
      entityType: 'area',
      entityId: area._id,
      details: {
        areaName: area.name,
        fileId: file._id,
        fileName: file.name
      }
    });
    
    res.status(200).json({
      success: true,
      data: area
    });
  } catch (error) {
    console.error('Error al asignar plantilla Excel al área:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al asignar plantilla Excel al área'
      }
    });
  }
};

// @desc    Eliminar plantilla Excel de un área
// @route   DELETE /api/areas/:id/excel-template
// @access  Privado (Admin o Admin de Compañía)
exports.removeExcelTemplate = async (req, res) => {
  try {
    // Verificar permisos (solo admin o admin de compañía)
    if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'No tienes permisos para eliminar plantillas de Excel de áreas'
        }
      });
    }
    
    // Verificar que el área existe y puede ser modificada por el usuario
    const filter = { 
      _id: req.params.id,
      active: true 
    };
    
    // Solo filtramos por compañía si NO es administrador del sistema
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    }
    
    const area = await Area.findOne(filter);
    
    if (!area) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AREA_NOT_FOUND',
          message: 'Área no encontrada'
        }
      });
    }
    
    // Verificar que el área tiene una plantilla Excel
    if (!area.excelTemplate || !area.excelTemplate.fileId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_TEMPLATE',
          message: 'El área no tiene asignada ninguna plantilla Excel'
        }
      });
    }
    
    // Guardar info para el log
    const oldTemplateInfo = {
      fileId: area.excelTemplate.fileId,
      fileName: area.excelTemplate.name
    };
    
    // Eliminar la plantilla Excel
    area.excelTemplate = undefined;
    await area.save();
    
    // Registrar en el log
    await Log.create({
      userId: req.user._id,
      companyId: area.companyId,
      action: 'remove_excel_template',
      entityType: 'area',
      entityId: area._id,
      details: {
        areaName: area.name,
        oldTemplate: oldTemplateInfo
      }
    });
    
    res.status(200).json({
      success: true,
      data: area
    });
  } catch (error) {
    console.error('Error al eliminar plantilla Excel del área:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar plantilla Excel del área'
      }
    });
  }
}; 