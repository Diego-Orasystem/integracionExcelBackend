const File = require('../models/File');
const Folder = require('../models/Folder');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
const mongoose = require('mongoose');
const asyncHandler = require('../middlewares/async.middleware');

/**
 * @desc    Obtener estado agregado de los archivos
 * @route   GET /api/files/status
 * @access  Privado
 */
exports.getFileStatus = async (req, res) => {
  try {
    const { groupBy = 'folder' } = req.query;
    
    // Asegurarse que el usuario solo ve archivos de su empresa
    const companyId = req.user.companyId;
    
    let aggregationPipeline = [];
    let groupByField;
    
    // Filtrar por compañía
    aggregationPipeline.push({
      $match: { companyId: new mongoose.Types.ObjectId(companyId) }
    });
    
    // Determinar el campo de agrupación
    switch (groupBy) {
      case 'folder':
        groupByField = '$folderId';
        // Incluir información de la carpeta
        aggregationPipeline.push({
          $lookup: {
            from: 'folders',
            localField: 'folderId',
            foreignField: '_id',
            as: 'folderInfo'
          }
        });
        aggregationPipeline.push({
          $unwind: '$folderInfo'
        });
        break;
      case 'date':
        // Agrupar por día de creación
        aggregationPipeline.push({
          $addFields: {
            creationDate: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            }
          }
        });
        groupByField = '$creationDate';
        break;
      case 'type':
        groupByField = '$extension';
        break;
      default:
        groupByField = '$folderId';
    }
    
    // Agregación para contar archivos por estado
    aggregationPipeline.push({
      $group: {
        _id: groupByField,
        total: { $sum: 1 },
        pendiente: {
          $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
        },
        procesando: {
          $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
        },
        procesado: {
          $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
        },
        error: {
          $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
        },
        // Tamaño total acumulado
        totalSize: { $sum: '$size' },
        // Añadir información adicional según el tipo de agrupación
        groupInfo: {
          $first: groupBy === 'folder' ? '$folderInfo.name' : 
                 (groupBy === 'date' ? '$creationDate' : '$extension')
        }
      }
    });
    
    // Obtener resultados
    const statusData = await File.aggregate(aggregationPipeline);
    
    // Si se agrupó por carpeta, añadir información adicional
    if (groupBy === 'folder') {
      // Añadir el ID de la carpeta explícitamente
      statusData.forEach(item => {
        item.folderId = item._id;
        item.folderName = item.groupInfo;
        delete item.groupInfo;
      });
    } else if (groupBy === 'date') {
      statusData.forEach(item => {
        item.date = item._id;
        item.formattedDate = item.groupInfo;
        delete item.groupInfo;
      });
    } else if (groupBy === 'type') {
      statusData.forEach(item => {
        item.extension = item._id;
        item.fileType = item.groupInfo;
        delete item.groupInfo;
      });
    }
    
    // Devolver datos
    res.status(200).json({
      success: true,
      data: statusData,
      meta: {
        groupBy
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de archivos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener estado de archivos'
      }
    });
  }
};

/**
 * @desc    Obtener métricas para visualización de archivos
 * @route   GET /api/files/metrics
 * @access  Privado
 */
exports.getFileMetrics = async (req, res) => {
  try {
    const { timeFrame = 'week' } = req.query;
    const companyId = req.user.companyId;
    
    // Definir el rango de fechas para la consulta
    let dateFilter = {};
    const now = new Date();
    
    if (timeFrame === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (timeFrame === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }
    
    // Pipeline base para todas las métricas
    const basePipeline = [
      {
        $match: { 
          companyId: new mongoose.Types.ObjectId(companyId),
          ...dateFilter
        }
      }
    ];
    
    // Obtener recuento de archivos por estado
    const statusCountPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];
    
    // Obtener recuento de archivos por tipo (extensión)
    const typeCountPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: '$extension',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10 // Limitar a los 10 tipos más comunes
      }
    ];
    
    // Obtener el tamaño total y promedio de archivos
    const sizeMetricsPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$size' },
          avgSize: { $avg: '$size' },
          minSize: { $min: '$size' },
          maxSize: { $max: '$size' },
          count: { $sum: 1 }
        }
      }
    ];
    
    // Obtener tendencia de carga por día
    const uploadTrendPipeline = [
      ...basePipeline,
      {
        $addFields: {
          uploadDate: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          }
        }
      },
      {
        $group: {
          _id: '$uploadDate',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];
    
    // Ejecutar todas las consultas en paralelo
    const [statusCounts, typeCounts, sizeMetrics, uploadTrend] = await Promise.all([
      File.aggregate(statusCountPipeline),
      File.aggregate(typeCountPipeline),
      File.aggregate(sizeMetricsPipeline),
      File.aggregate(uploadTrendPipeline)
    ]);
    
    // Procesar y formatear los datos para la visualización tipo puzzle
    const puzzleData = statusCounts.map(status => ({
      id: status._id,
      label: status._id,
      value: status.count,
      color: status._id === 'procesado' ? '#2ecc71' : 
             status._id === 'pendiente' ? '#e74c3c' : 
             status._id === 'procesando' ? '#3498db' : '#f39c12'
    }));
    
    // Enviar todas las métricas
    res.status(200).json({
      success: true,
      data: {
        puzzle: puzzleData,
        statusCounts,
        typeCounts,
        sizeMetrics: sizeMetrics[0] || { totalSize: 0, avgSize: 0, count: 0 },
        uploadTrend,
      },
      meta: {
        timeFrame,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error al obtener métricas de archivos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener métricas de archivos'
      }
    });
  }
};

/**
 * @desc    Actualizar estado de un archivo
 * @route   PATCH /api/files/:id/status
 * @access  Privado
 */
exports.updateFileStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Validar el estado
    if (!['pendiente', 'procesando', 'procesado', 'error'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Estado no válido. Los estados permitidos son: pendiente, procesando, procesado, error'
        }
      });
    }
    
    // Buscar el archivo y verificar que pertenezca a la empresa del usuario
    const file = await File.findOne({ 
      _id: id,
      companyId: req.user.companyId 
    });
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Archivo no encontrado o sin permisos de acceso'
        }
      });
    }
    
    // Actualizar detalles de procesamiento según el nuevo estado
    const now = new Date();
    const updateData = { status };
    
    // Gestionar los detalles de procesamiento según el nuevo estado
    if (status === 'procesando' && file.status !== 'procesando') {
      // Iniciar procesamiento
      updateData.processingDetails = {
        ...file.processingDetails,
        startDate: now,
        processingNotes: notes || 'Procesamiento iniciado'
      };
    } else if (status === 'procesado' && file.status !== 'procesado') {
      // Finalizar procesamiento con éxito
      const startDate = file.processingDetails?.startDate || now;
      const duration = now - startDate;
      
      updateData.processingDetails = {
        ...file.processingDetails,
        endDate: now,
        duration,
        processingNotes: notes || 'Procesamiento completado con éxito'
      };
    } else if (status === 'error') {
      // Finalizar procesamiento con error
      const startDate = file.processingDetails?.startDate || now;
      const duration = now - startDate;
      
      updateData.processingDetails = {
        ...file.processingDetails,
        endDate: now,
        duration,
        errorMessage: notes || 'Error durante el procesamiento',
        processingNotes: 'Procesamiento fallido'
      };
    } else if (notes) {
      // Si solo actualizamos las notas
      updateData.processingDetails = {
        ...file.processingDetails,
        processingNotes: notes
      };
    }
    
    // Actualizar el archivo
    const updatedFile = await File.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: {
        _id: updatedFile._id,
        name: updatedFile.name,
        status: updatedFile.status,
        processingDetails: updatedFile.processingDetails
      }
    });
  } catch (error) {
    console.error('Error al actualizar estado del archivo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar estado del archivo'
      }
    });
  }
};

/**
 * @desc    Obtiene datos agregados sobre el estado de los archivos
 * @route   GET /api/files/status
 * @access  Private
 */
exports.getFileStatusData = asyncHandler(async (req, res) => {
  const { groupBy } = req.query;
  let aggregationPipeline = [];
  
  // Filtro por compañía del usuario
  aggregationPipeline.push({
    $match: { companyId: req.user.companyId }
  });
  
  // Agrupar según parámetro
  if (groupBy === 'folder') {
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'folders',
          localField: 'folderId',
          foreignField: '_id',
          as: 'folder'
        }
      },
      {
        $unwind: '$folder'
      },
      {
        $group: {
          _id: '$folderId',
          folderName: { $first: '$folder.name' },
          folderPath: { $first: '$folder.path' },
          totalFiles: { $sum: 1 },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
          },
          procesando: {
            $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
          },
          procesados: {
            $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
          },
          errores: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          tamanioTotal: { $sum: '$size' },
          archivos: { $push: { id: '$_id', nombre: '$name', estado: '$status' } }
        }
      }
    );
  } else if (groupBy === 'date') {
    aggregationPipeline.push(
      {
        $addFields: {
          fechaCreacion: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          }
        }
      },
      {
        $group: {
          _id: '$fechaCreacion',
          fecha: { $first: '$fechaCreacion' },
          totalFiles: { $sum: 1 },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
          },
          procesando: {
            $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
          },
          procesados: {
            $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
          },
          errores: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          tamanioTotal: { $sum: '$size' },
          archivos: { $push: { id: '$_id', nombre: '$name', estado: '$status' } }
        }
      },
      {
        $sort: { _id: -1 }
      }
    );
  } else if (groupBy === 'type') {
    aggregationPipeline.push(
      {
        $group: {
          _id: '$extension',
          tipoArchivo: { $first: '$extension' },
          totalFiles: { $sum: 1 },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
          },
          procesando: {
            $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
          },
          procesados: {
            $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
          },
          errores: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          tamanioTotal: { $sum: '$size' },
          archivos: { $push: { id: '$_id', nombre: '$name', estado: '$status' } }
        }
      }
    );
  } else {
    // Sin agrupación, sólo contar por estados
    aggregationPipeline.push(
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          pendientes: {
            $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
          },
          procesando: {
            $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
          },
          procesados: {
            $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
          },
          errores: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
          },
          tamanioTotal: { $sum: '$size' }
        }
      }
    );
  }
  
  const statusData = await File.aggregate(aggregationPipeline);
  
  return res.status(200).json({
    success: true,
    data: statusData
  });
});

/**
 * @desc    Obtiene métricas para la visualización del rompecabezas
 * @route   GET /api/files/metrics
 * @access  Private
 */
exports.getFileMetrics = asyncHandler(async (req, res) => {
  const { timeFrame } = req.query;
  
  let dateFilter = {};
  const now = new Date();
  
  // Aplicar filtro por período de tiempo
  if (timeFrame === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    dateFilter = { createdAt: { $gte: weekAgo } };
  } else if (timeFrame === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter = { createdAt: { $gte: monthAgo } };
  }
  
  // Pipeline para estadísticas generales
  const generalStatsPipeline = [
    {
      $match: {
        companyId: req.user.companyId,
        ...dateFilter
      }
    },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        pendientes: {
          $sum: { $cond: [{ $eq: ['$status', 'pendiente'] }, 1, 0] }
        },
        procesando: {
          $sum: { $cond: [{ $eq: ['$status', 'procesando'] }, 1, 0] }
        },
        procesados: {
          $sum: { $cond: [{ $eq: ['$status', 'procesado'] }, 1, 0] }
        },
        errores: {
          $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
        },
        tamanioPromedio: { $avg: '$size' },
        tamanioTotal: { $sum: '$size' }
      }
    },
    {
      $project: {
        _id: 0,
        totalFiles: 1,
        pendientes: 1,
        procesando: 1,
        procesados: 1,
        errores: 1,
        tamanioPromedio: { $round: ['$tamanioPromedio', 2] },
        tamanioTotal: 1,
        distribucionEstados: {
          $objectToArray: {
            pendientes: { $divide: ['$pendientes', '$totalFiles'] },
            procesando: { $divide: ['$procesando', '$totalFiles'] },
            procesados: { $divide: ['$procesados', '$totalFiles'] },
            errores: { $divide: ['$errores', '$totalFiles'] }
          }
        }
      }
    }
  ];
  
  // Pipeline para datos detallados para el rompecabezas
  const puzzleDataPipeline = [
    {
      $match: {
        companyId: req.user.companyId,
        ...dateFilter
      }
    },
    {
      $lookup: {
        from: 'folders',
        localField: 'folderId',
        foreignField: '_id',
        as: 'folder'
      }
    },
    {
      $unwind: '$folder'
    },
    {
      $project: {
        _id: 1,
        name: 1,
        status: 1,
        size: 1,
        folderId: 1,
        folderName: '$folder.name',
        folderPath: '$folder.path',
        createdAt: 1,
        processingTime: {
          $cond: [
            { $eq: ['$status', 'procesado'] },
            '$processingDetails.duration',
            null
          ]
        },
        metadata: 1,
        weight: {
          $switch: {
            branches: [
              { case: { $eq: ['$status', 'procesado'] }, then: 1 },
              { case: { $eq: ['$status', 'pendiente'] }, then: 0.6 },
              { case: { $eq: ['$status', 'procesando'] }, then: 0.8 },
              { case: { $eq: ['$status', 'error'] }, then: 0.4 }
            ],
            default: 0.5
          }
        }
      }
    },
    {
      $sort: { weight: -1, size: -1 }
    }
  ];
  
  // Obtener todas las áreas y subáreas para calcular los archivos esperados
  const areas = await Area.find({ 
    companyId: req.user.companyId,
    active: true
  });
  
  const subareas = await SubArea.find({
    companyId: req.user.companyId,
    active: true
  });
  
  // Consultar los archivos existentes agrupados por carpeta
  const filesByFolderPipeline = [
    {
      $match: {
        companyId: req.user.companyId
      }
    },
    {
      $group: {
        _id: '$folderId',
        count: { $sum: 1 }
      }
    }
  ];
  
  // Ejecutar todos los pipelines
  const [generalStats, puzzleData, filesByFolder] = await Promise.all([
    File.aggregate(generalStatsPipeline),
    File.aggregate(puzzleDataPipeline),
    File.aggregate(filesByFolderPipeline)
  ]);
  
  // Convertir filesByFolder a un mapa para búsqueda rápida
  const folderFileCountMap = {};
  filesByFolder.forEach(item => {
    folderFileCountMap[item._id.toString()] = item.count;
  });
  
  // Calcular los archivos faltantes por área y subárea
  const areaData = areas.map(area => {
    const folderCount = folderFileCountMap[area.folderId?.toString()] || 0;
    const expectedFiles = area.expectedFiles || 0;
    const missingFiles = Math.max(0, expectedFiles - folderCount);
    
    return {
      _id: area._id,
      name: area.name,
      type: 'area',
      folderName: area.name,
      folderPath: `/${area.name}`,
      folderId: area.folderId,
      existingFiles: folderCount,
      expectedFiles: expectedFiles,
      missingFiles: missingFiles,
      // Datos para visualización
      status: missingFiles > 0 ? 'faltante' : 'completo',
      weight: missingFiles > 0 ? 0.3 : 1,
      completionRate: expectedFiles > 0 ? (folderCount / expectedFiles) : 1
    };
  }).filter(area => area.expectedFiles > 0); // Solo incluir áreas que esperen archivos
  
  const subareaData = subareas.map(subarea => {
    const folderCount = folderFileCountMap[subarea.folderId?.toString()] || 0;
    const expectedFiles = subarea.expectedFiles || 0;
    const missingFiles = Math.max(0, expectedFiles - folderCount);
    
    // Buscar el área padre para tener la ruta completa
    const parentArea = areas.find(area => area._id.toString() === subarea.areaId?.toString());
    const areaName = parentArea ? parentArea.name : 'Desconocida';
    
    return {
      _id: subarea._id,
      name: subarea.name,
      type: 'subarea',
      areaId: subarea.areaId,
      areaName: areaName,
      folderName: subarea.name,
      folderPath: parentArea ? `/${areaName}/${subarea.name}` : `/${subarea.name}`,
      folderId: subarea.folderId,
      existingFiles: folderCount,
      expectedFiles: expectedFiles,
      missingFiles: missingFiles,
      // Datos para visualización
      status: missingFiles > 0 ? 'faltante' : 'completo',
      weight: missingFiles > 0 ? 0.3 : 1,
      completionRate: expectedFiles > 0 ? (folderCount / expectedFiles) : 1
    };
  }).filter(subarea => subarea.expectedFiles > 0); // Solo incluir subáreas que esperen archivos
  
  // Combinar datos de puzzle con los de áreas y subáreas
  const enhancedPuzzleData = [
    ...puzzleData,
    ...areaData.map(area => ({
      ...area,
      isMissingFilesNode: true // Marcar que este nodo representa archivos faltantes
    })),
    ...subareaData.map(subarea => ({
      ...subarea,
      isMissingFilesNode: true // Marcar que este nodo representa archivos faltantes
    }))
  ];
  
  // Formato final de la respuesta
  return res.status(200).json({
    success: true,
    data: {
      stats: generalStats.length > 0 ? generalStats[0] : null,
      puzzleItems: enhancedPuzzleData,
      areaStats: areaData,
      subareaStats: subareaData
    }
  });
});

/**
 * @desc    Obtiene estadísticas detalladas de archivos por área y subárea
 * @route   GET /api/files/area-stats
 * @access  Private
 */
exports.getAreaFileStats = asyncHandler(async (req, res) => {
  // Obtener todas las áreas activas de la compañía del usuario
  const areas = await Area.find({ 
    companyId: req.user.companyId,
    active: true
  }).select('_id name description responsibleUserId expectedFiles folderId color icon').lean();
  
  // Obtener todas las subáreas activas
  const subareas = await SubArea.find({
    companyId: req.user.companyId,
    active: true
  }).select('_id name description areaId responsibleUserId expectedFiles folderId').lean();
  
  // Obtener responsables para popular los datos
  const responsibleIds = [
    ...new Set([
      ...areas.map(a => a.responsibleUserId).filter(id => id),
      ...subareas.map(sa => sa.responsibleUserId).filter(id => id)
    ])
  ];
  
  const responsibleUsers = await mongoose.model('User').find({
    _id: { $in: responsibleIds }
  }).select('_id name email').lean();
  
  // Crear mapa de usuarios para una búsqueda más rápida
  const userMap = {};
  responsibleUsers.forEach(user => {
    userMap[user._id.toString()] = user;
  });
  
  // Consultar los archivos existentes agrupados por carpeta
  const filesByFolderPipeline = [
    {
      $match: {
        companyId: req.user.companyId
      }
    },
    {
      $group: {
        _id: '$folderId',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        lastModified: { $max: '$updatedAt' }
      }
    }
  ];
  
  const filesByFolder = await File.aggregate(filesByFolderPipeline);
  
  // Convertir filesByFolder a un mapa para búsqueda rápida
  const folderFileCountMap = {};
  filesByFolder.forEach(item => {
    folderFileCountMap[item._id.toString()] = {
      count: item.count,
      totalSize: item.totalSize,
      lastModified: item.lastModified
    };
  });
  
  // Añadir detalles a las áreas
  const enhancedAreas = areas.map(area => {
    const folderData = folderFileCountMap[area.folderId?.toString()] || { count: 0, totalSize: 0 };
    const expectedFiles = area.expectedFiles || 0;
    const existingFiles = folderData.count || 0;
    const missingFiles = Math.max(0, expectedFiles - existingFiles);
    const completionRate = expectedFiles > 0 ? (existingFiles / expectedFiles) : 1;
    
    // Añadir información del responsable
    let responsibleInfo = null;
    if (area.responsibleUserId) {
      const responsible = userMap[area.responsibleUserId.toString()];
      if (responsible) {
        responsibleInfo = {
          _id: responsible._id,
          name: responsible.name,
          email: responsible.email
        };
      }
    }
    
    return {
      ...area,
      stats: {
        existingFiles,
        expectedFiles,
        missingFiles,
        completionRate,
        totalSize: folderData.totalSize || 0,
        lastModified: folderData.lastModified || null
      },
      status: missingFiles > 0 ? 'incompleto' : 'completo',
      responsible: responsibleInfo
    };
  });
  
  // Agrupar subáreas por área para organizarlas jerárquicamente
  const subareasByArea = {};
  
  subareas.forEach(subarea => {
    const areaId = subarea.areaId?.toString();
    if (!areaId) return;
    
    if (!subareasByArea[areaId]) {
      subareasByArea[areaId] = [];
    }
    
    const folderData = folderFileCountMap[subarea.folderId?.toString()] || { count: 0, totalSize: 0 };
    const expectedFiles = subarea.expectedFiles || 0;
    const existingFiles = folderData.count || 0;
    const missingFiles = Math.max(0, expectedFiles - existingFiles);
    const completionRate = expectedFiles > 0 ? (existingFiles / expectedFiles) : 1;
    
    // Añadir información del responsable
    let responsibleInfo = null;
    if (subarea.responsibleUserId) {
      const responsible = userMap[subarea.responsibleUserId.toString()];
      if (responsible) {
        responsibleInfo = {
          _id: responsible._id,
          name: responsible.name,
          email: responsible.email
        };
      }
    }
    
    subareasByArea[areaId].push({
      ...subarea,
      stats: {
        existingFiles,
        expectedFiles,
        missingFiles,
        completionRate,
        totalSize: folderData.totalSize || 0,
        lastModified: folderData.lastModified || null
      },
      status: missingFiles > 0 ? 'incompleto' : 'completo',
      responsible: responsibleInfo
    });
  });
  
  // Añadir subáreas a sus respectivas áreas
  enhancedAreas.forEach(area => {
    area.subareas = subareasByArea[area._id.toString()] || [];
  });
  
  // Calcular estadísticas generales
  const totalExpectedFiles = enhancedAreas.reduce((sum, area) => sum + (area.expectedFiles || 0), 0) +
                           subareas.reduce((sum, subarea) => sum + (subarea.expectedFiles || 0), 0);
  
  const totalExistingFiles = Object.values(folderFileCountMap).reduce((sum, data) => sum + data.count, 0);
  const totalMissingFiles = Math.max(0, totalExpectedFiles - totalExistingFiles);
  const overallCompletionRate = totalExpectedFiles > 0 ? (totalExistingFiles / totalExpectedFiles) : 1;
  
  return res.status(200).json({
    success: true,
    data: {
      areas: enhancedAreas,
      summary: {
        totalAreas: enhancedAreas.length,
        totalSubareas: subareas.length,
        totalExpectedFiles,
        totalExistingFiles,
        totalMissingFiles,
        overallCompletionRate
      }
    }
  });
}); 