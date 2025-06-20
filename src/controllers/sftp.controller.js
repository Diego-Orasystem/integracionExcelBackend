const Company = require('../models/Company');
const SftpSyncJob = require('../models/SftpSyncJob');
const { syncSftpFiles, testSftpConnection } = require('../services/sftp.service');

// @desc    Probar conexión SFTP
// @route   POST /api/sftp/test-connection
// @access  Privado (Admin y CompanyAdmin)
exports.testConnection = async (req, res) => {
  try {
    const { host, port, username, password, rootDirectory } = req.body;
    
    // Validar campos obligatorios
    if (!host || !username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Faltan campos obligatorios: host, username, password'
        }
      });
    }
    
    // Probar conexión
    const result = await testSftpConnection({
      host,
      port: port || 22,
      username,
      password,
      rootDirectory: rootDirectory || '/'
    });
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Conexión SFTP exitosa'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: `Error de conexión SFTP: ${result.error}`
        }
      });
    }
  } catch (error) {
    console.error('Error en testConnection:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Actualizar configuración SFTP
// @route   PUT /api/sftp/settings
// @access  Privado (Admin y CompanyAdmin)
exports.updateSettings = async (req, res) => {
  try {
    const { companyId } = req.body;
    
    // Si no es admin general, sólo puede actualizar su propia empresa
    if (req.user.role !== 'admin' && req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para configurar otra empresa'
        }
      });
    }
    
    // Buscar la empresa
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Empresa no encontrada'
        }
      });
    }
    
    // Actualizar configuración SFTP
    company.sftp = {
      ...company.sftp,
      ...req.body.sftp
    };
    
    await company.save();
    
    return res.status(200).json({
      success: true,
      data: {
        sftp: {
          host: company.sftp.host,
          port: company.sftp.port,
          username: company.sftp.username,
          // No devolver la contraseña
          rootDirectory: company.sftp.rootDirectory,
          enabled: company.sftp.enabled,
          targetFolder: company.sftp.targetFolder,
          filePattern: company.sftp.filePattern,
          syncSchedule: company.sftp.syncSchedule,
          deleteAfterSync: company.sftp.deleteAfterSync
        }
      }
    });
  } catch (error) {
    console.error('Error en updateSettings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Sincronizar archivos SFTP manualmente
// @route   POST /api/sftp/sync
// @access  Privado (Admin y CompanyAdmin)
exports.syncFiles = async (req, res) => {
  try {
    const { companyId } = req.body;
    
    // Si no es admin general, sólo puede sincronizar su propia empresa
    if (req.user.role !== 'admin' && req.user.companyId.toString() !== companyId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para sincronizar otra empresa'
        }
      });
    }
    
    // Iniciar sincronización de forma asíncrona
    syncSftpFiles(companyId, req.user._id)
      .then(result => console.log('Sincronización SFTP completada:', result))
      .catch(error => console.error('Error en sincronización SFTP:', error));
    
    return res.status(202).json({
      success: true,
      message: 'Sincronización SFTP iniciada',
      data: {
        companyId
      }
    });
  } catch (error) {
    console.error('Error en syncFiles:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Listar trabajos de sincronización
// @route   GET /api/sftp/jobs
// @access  Privado (Admin y CompanyAdmin)
exports.listJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtro por empresa
    const filter = {};
    if (req.user.role !== 'admin') {
      filter.companyId = req.user.companyId;
    } else if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }
    
    // Contar total de trabajos
    const total = await SftpSyncJob.countDocuments(filter);
    
    // Obtener trabajos paginados
    const jobs = await SftpSyncJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('companyId', 'name');
    
    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en listJobs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
};

// @desc    Obtener detalles de un trabajo
// @route   GET /api/sftp/jobs/:id
// @access  Privado (Admin y CompanyAdmin)
exports.getJob = async (req, res) => {
  try {
    const job = await SftpSyncJob.findById(req.params.id)
      .populate('companyId', 'name');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Trabajo no encontrado'
        }
      });
    }
    
    // Verificar permisos
    if (req.user.role !== 'admin' && job.companyId._id.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para ver este trabajo'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error en getJob:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error en el servidor'
      }
    });
  }
}; 