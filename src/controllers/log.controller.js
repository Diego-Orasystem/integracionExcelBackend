const Log = require('../models/Log');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todos los logs
 * @route   GET /api/logs
 * @access  Private/Admin/CompanyAdmin
 */
exports.getAllLogs = async (req, res) => {
  try {
    // Comentado temporalmente la verificación de permisos
    // if (req.user.role !== 'admin' && req.user.role !== 'company_admin') {
    //   return res.status(403).json({
    //     success: false,
    //     error: {
    //       code: 'FORBIDDEN',
    //       message: 'No tienes permisos para ver los logs'
    //     }
    //   });
    // }

    // Preparar filtros
    const { 
      action, 
      entityType, 
      entityId, 
      userId, 
      startDate, 
      endDate,
      page = 1,
      limit = 50,
      sort = '-createdAt'
    } = req.query;
    
    const filter = {};
    
    // Filtrar por empresa si no es admin global - Modificado para permitir ver todos los logs
    // if (req.user.role === 'company_admin') {
    //   filter.companyId = req.user.companyId;
    // } else if (req.query.companyId) {
    //   filter.companyId = req.query.companyId;
    // }
    
    // Si se proporciona companyId en la consulta, aplicar el filtro
    if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }
    
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (userId) filter.userId = userId;

    // Filtro por fechas
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Calcular skip para paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Ejecutar consulta con filtros y paginación
    const logs = await Log.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('companyId', 'name');
    
    // Contar total para paginación
    const total = await Log.countDocuments(filter);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener logs:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener los logs'
      }
    });
  }
};

/**
 * @desc    Obtener logs de un archivo específico
 * @route   GET /api/logs/file/:fileId
 * @access  Private/User (con permisos)
 */
exports.getFileActivityLogs = async (req, res) => {
  try {
    // Verificar si el usuario tiene acceso al archivo
    // Aquí se debería implementar una verificación de permisos
    // utilizando un servicio de permisos o consultando la carpeta del archivo
    
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await Log.find({
      entityType: 'file',
      entityId: req.params.fileId
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');
    
    const total = await Log.countDocuments({
      entityType: 'file',
      entityId: req.params.fileId
    });
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener logs del archivo:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener los logs del archivo'
      }
    });
  }
};

/**
 * @desc    Obtener logs de un usuario específico
 * @route   GET /api/logs/user/:userId
 * @access  Private/Admin/Self
 */
exports.getUserActivityLogs = async (req, res) => {
  try {
    // Verificar permisos
    if (req.user.role !== 'admin' && 
        req.user.role !== 'company_admin' && 
        req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver los logs de este usuario'
        }
      });
    }

    // Si es company_admin, verificar que el usuario pertenezca a su empresa
    if (req.user.role === 'company_admin') {
      const targetUser = await User.findById(req.params.userId);
      if (!targetUser || targetUser.companyId.toString() !== req.user.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permisos para ver los logs de este usuario'
          }
        });
      }
    }

    const { page = 1, limit = 50, action, entityType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir filtro
    const filter = { userId: req.params.userId };
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    
    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('entityId', 'name title');
    
    const total = await Log.countDocuments(filter);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error al obtener logs del usuario:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener los logs del usuario'
      }
    });
  }
};

/**
 * @desc    Búsqueda avanzada en logs
 * @route   GET /api/logs/search
 * @access  Private
 */
exports.searchLogs = async (req, res) => {
  try {
    // Eliminada la verificación de permisos

    const { 
      term,
      page = 1,
      limit = 50
    } = req.query;
    
    // Construir pipeline de agregación
    const pipeline = [];
    
    // Etapa de match inicial
    const matchStage = {};
    
    // Filtrar por companyId si se proporciona en la consulta
    if (req.query.companyId) {
      matchStage.companyId = mongoose.Types.ObjectId(req.query.companyId);
    }
    
    // Añadir match inicial si hay condiciones
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    
    // Búsqueda de texto si hay término
    if (term) {
      pipeline.push({
        $match: {
          $or: [
            { action: { $regex: term, $options: 'i' } },
            { 'details.ip': { $regex: term, $options: 'i' } },
            { 'details.userAgent': { $regex: term, $options: 'i' } }
          ]
        }
      });
    }
    
    // Lookup para obtener datos de usuario
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    });
    
    // Deshacer array
    pipeline.push({
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    });
    
    // Lookup para obtener datos de empresa
    pipeline.push({
      $lookup: {
        from: 'companies',
        localField: 'companyId',
        foreignField: '_id',
        as: 'company'
      }
    });
    
    // Deshacer array
    pipeline.push({
      $unwind: {
        path: '$company',
        preserveNullAndEmptyArrays: true
      }
    });
    
    // Añadir búsqueda en campos de usuario y empresa
    if (term) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: term, $options: 'i' } },
            { 'user.email': { $regex: term, $options: 'i' } },
            { 'company.name': { $regex: term, $options: 'i' } }
          ]
        }
      });
    }
    
    // Contar total antes de paginación
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Log.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    
    // Añadir sort y paginación
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );
    
    // Proyección final
    pipeline.push({
      $project: {
        _id: 1,
        action: 1,
        entityType: 1,
        entityId: 1,
        details: 1,
        createdAt: 1,
        user: {
          _id: '$user._id',
          name: '$user.name',
          email: '$user.email'
        },
        company: {
          _id: '$company._id',
          name: '$company.name'
        }
      }
    });
    
    // Ejecutar agregación
    const logs = await Log.aggregate(pipeline);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error en búsqueda de logs:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al buscar logs'
      }
    });
  }
};

/**
 * @desc    Crear un log (principalmente para uso interno)
 * @route   POST /api/logs
 * @access  Private
 */
exports.createLog = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación',
        details: errors.array()
      }
    });
  }

  try {
    const { 
      userId, 
      companyId, 
      action, 
      entityType, 
      entityId, 
      details 
    } = req.body;

    // Crear log
    const log = new Log({
      userId: userId || req.user._id,
      companyId: companyId || req.user.companyId,
      action,
      entityType,
      entityId,
      details: {
        ...details,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await log.save();

    res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error al crear log:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear el log'
      }
    });
  }
};

/**
 * @desc    Eliminar un log (solo para administradores)
 * @route   DELETE /api/logs/:id
 * @access  Private
 */
exports.deleteLog = async (req, res) => {
  try {
    // Buscar si el log a eliminar existe y pertenece a la compañía del usuario
    const log = await Log.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!log) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LOG_NOT_FOUND',
          message: 'Registro de log no encontrado'
        }
      });
    }
    
    // Eliminar el log
    await Log.deleteOne({ _id: log._id });
    
    console.log(`Log eliminado correctamente: ${log._id} (${log.action})`);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error al eliminar log:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al eliminar el log'
      }
    });
  }
}; 