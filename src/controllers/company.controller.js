const Company = require('../models/Company');
const User = require('../models/User');
const Log = require('../models/Log');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * @desc    Obtener todas las empresas
 * @route   GET /api/companies
 * @access  Private
 */
exports.getAllCompanies = async (req, res) => {
  try {
    // Permitir filtrado según parámetros
    const { name, active } = req.query;
    const filter = {};
    
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
      console.log(`Filtrando empresas por nombre: "${name}"`);
    }
    
    if (active !== undefined) {
      filter.active = active === 'true';
      console.log(`Filtrando empresas por estado activo: ${filter.active}`);
    }
    
    // Si no es admin, solo puede ver su propia empresa
    if (req.user.role !== 'admin') {
      filter._id = req.user.companyId;
      console.log(`Usuario ${req.user.role} - Restringiendo vista a su propia empresa: ${req.user.companyId}`);
    } else {
      console.log('Usuario admin - Accediendo a todas las empresas');
    }
    
    console.log('Filtro aplicado:', filter);
    
    const companies = await Company.find(filter);
    console.log(`Se encontraron ${companies.length} empresas`);
    
    // Obtener la cantidad de usuarios y archivos para cada empresa
    const companiesWithCounts = await Promise.all(
      companies.map(async (company) => {
        const userCount = await User.countDocuments({ companyId: company._id });
        const fileCount = await mongoose.model('File').countDocuments({ companyId: company._id });
        
        return {
          ...company.toObject(),
          userCount,
          fileCount
        };
      })
    );
    
    res.json({
      success: true,
      data: companiesWithCounts
    });
  } catch (error) {
    console.error('Error al obtener empresas:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener la lista de empresas'
      }
    });
  }
};

/**
 * @desc    Obtener una empresa por ID
 * @route   GET /api/companies/:id
 * @access  Private
 */
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Empresa no encontrada'
        }
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error al obtener empresa:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener la empresa'
      }
    });
  }
};

/**
 * @desc    Crear una nueva empresa
 * @route   POST /api/companies
 * @access  Private
 */
exports.createCompany = async (req, res) => {
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

  const { 
    name, 
    description, 
    logo, 
    sftp, 
    settings,
    emailDomain
  } = req.body;

  try {
    // Verificar si ya existe una empresa con el mismo nombre
    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'COMPANY_EXISTS',
          message: 'Ya existe una empresa con este nombre'
        }
      });
    }

    // Verificar si ya existe una empresa con el mismo dominio de correo
    const existingDomain = await Company.findOne({ emailDomain });
    if (existingDomain) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DOMAIN_EXISTS',
          message: 'Ya existe una empresa con este dominio de correo'
        }
      });
    }

    // Crear nueva empresa
    const newCompany = new Company({
      name,
      description,
      logo,
      emailDomain,
      sftp: sftp || {
        enabled: false
      },
      settings: settings || {
        maxStorage: 1024, // 1GB por defecto
        allowedFileTypes: ['.xlsx', '.xls', '.csv'],
        autoSyncInterval: 60 // 1 hora por defecto
      },
      active: true
    });

    await newCompany.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: newCompany._id,
      action: 'create_company',
      entityType: 'company',
      entityId: newCompany._id,
      details: {
        name: newCompany.name
      }
    });

    res.status(201).json({
      success: true,
      data: newCompany
    });
  } catch (error) {
    console.error('Error al crear empresa:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al crear la empresa'
      }
    });
  }
};

/**
 * @desc    Actualizar una empresa
 * @route   PUT /api/companies/:id
 * @access  Private/Admin/CompanyAdmin
 */
exports.updateCompany = async (req, res) => {
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
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Empresa no encontrada'
        }
      });
    }

    const { 
      name, 
      description, 
      logo, 
      sftp, 
      settings,
      active 
    } = req.body;

    // Preparar objeto de actualización
    const updateData = {};
    
    // Campos que cualquiera puede actualizar
    if (description) updateData.description = description;
    if (logo) updateData.logo = logo;
    if (name) updateData.name = name;
    if (active !== undefined) updateData.active = active;
    
    // SFTP y configuraciones pueden ser actualizadas por cualquiera ahora
    if (sftp) updateData.sftp = { ...company.sftp, ...sftp };
    if (settings) updateData.settings = { ...company.settings, ...settings };

    // Actualizar empresa
    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: updatedCompany._id,
      action: 'update_company',
      entityType: 'company',
      entityId: updatedCompany._id,
      details: {
        changes: Object.keys(updateData).join(', ')
      }
    });

    res.json({
      success: true,
      data: updatedCompany
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al actualizar la empresa'
      }
    });
  }
};

/**
 * @desc    Desactivar una empresa
 * @route   DELETE /api/companies/:id
 * @access  Private
 */
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Empresa no encontrada'
        }
      });
    }

    // En lugar de eliminar, marcar como inactiva
    company.active = false;
    await company.save();

    // Registrar en log
    await Log.create({
      userId: req.user._id,
      companyId: company._id,
      action: 'delete_company',
      entityType: 'company',
      entityId: company._id
    });

    res.json({
      success: true,
      message: 'Empresa desactivada correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar empresa:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al desactivar la empresa'
      }
    });
  }
};

/**
 * @desc    Obtener estadísticas de empresa
 * @route   GET /api/companies/:id/stats
 * @access  Private
 */
exports.getCompanyStats = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Empresa no encontrada'
        }
      });
    }

    // Consultas para estadísticas
    const [
      userCount,
      activeUserCount,
      fileCount,
      totalStorage,
      folderCount,
      recentActivity
    ] = await Promise.all([
      User.countDocuments({ companyId: req.params.id }),
      User.countDocuments({ companyId: req.params.id, active: true }),
      mongoose.model('File').countDocuments({ companyId: req.params.id }),
      mongoose.model('File').aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(req.params.id) } },
        { $group: { _id: null, total: { $sum: "$size" } } }
      ]),
      mongoose.model('Folder').countDocuments({ companyId: req.params.id }),
      Log.find({ companyId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    const stats = {
      userStats: {
        total: userCount,
        active: activeUserCount
      },
      storageStats: {
        totalFiles: fileCount,
        totalSize: totalStorage.length ? totalStorage[0].total : 0,
        totalFolders: folderCount,
        usedPercentage: company.settings.maxStorage ? 
          (totalStorage.length ? (totalStorage[0].total / (company.settings.maxStorage * 1024 * 1024) * 100) : 0) : 0
      },
      recentActivity
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener estadísticas de la empresa'
      }
    });
  }
}; 