const mongoose = require('mongoose');
const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const Log = require('../models/Log');
const Area = require('../models/Area');
const SubArea = require('../models/SubArea');
const cache = require('../utils/cache');

// Tiempo de caché para las diferentes vistas (en milisegundos)
const CACHE_TTL = {
  STATS: 5 * 60 * 1000, // 5 minutos
  AREAS: 2 * 60 * 1000, // 2 minutos
  VISUALIZATIONS: 3 * 60 * 1000 // 3 minutos
};

/**
 * Determina si se debe mostrar datos de todas las empresas
 * @param {Object} req - Objeto de solicitud Express
 * @returns {boolean} - True si debe mostrar todas las empresas
 */
const shouldShowAllCompanies = (req) => {
  // Si el usuario es admin y ha especificado el parámetro allCompanies=true
  return req.user && 
         req.user.roles && 
         req.user.roles.includes('admin') && 
         req.query.allCompanies === 'true';
};

/**
 * Obtener estadísticas generales para el dashboard
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getStats = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    const companyFilter = viewAllCompanies 
      ? {} // Sin filtro de compañía para admins que quieren ver todo
      : { companyId: req.query.companyId || req.user.companyId };
    
    // Validar que el ID de compañía sea válido si se especifica
    if (companyFilter.companyId && !mongoose.Types.ObjectId.isValid(companyFilter.companyId)) {
      return res.status(400).json({
        success: false,
        message: 'El ID de compañía proporcionado no es válido'
      });
    }
    
    // Clave de caché basada en la compañía o en el indicador de todas las empresas
    const cacheKey = viewAllCompanies 
      ? 'stats:all-companies' 
      : `stats:${companyFilter.companyId}`;
    
    // Utilizar caché para obtener o calcular las estadísticas
    const statsData = await cache.withCache(
      cacheKey,
      async () => {
        // Si se están mostrando todas las empresas, obtener lista de compañías
        let companies = [];
        if (viewAllCompanies) {
          companies = await Company.find().select('_id name');
        }
        
        // Si es admin viendo todas las compañías
        if (viewAllCompanies) {
          // Obtener estadísticas agregadas
          const [
            totalUsers,
            totalFiles,
            totalFolders,
            recentLogs,
            storageUsed
          ] = await Promise.all([
            // Contar usuarios activos
            User.countDocuments({ isActive: true }),
            
            // Contar archivos
            File.countDocuments({}),
            
            // Contar carpetas
            Folder.countDocuments({}),
            
            // Obtener los últimos logs (10) globales
            Log.find({})
              .sort({ createdAt: -1 })
              .limit(10)
              .populate('userId', 'name email')
              .populate('companyId', 'name')
              .select('action entityType details createdAt companyId'),
              
            // Calcular espacio usado (en bytes)
            File.aggregate([
              { $group: { _id: null, total: { $sum: "$size" } } }
            ])
          ]);
          
          // Calcular tipos de archivo por empresa y global
          const fileTypesByCompany = await File.aggregate([
            { $group: { 
              _id: { fileType: "$fileType", companyId: "$companyId" }, 
              count: { $sum: 1 }
            }}
          ]);
          
          // Transformar datos para mostrar estadísticas por compañía
          const companyStats = await Promise.all(
            companies.map(async (company) => {
              const companyUsers = await User.countDocuments({ 
                companyId: company._id, 
                isActive: true 
              });
              
              const companyFiles = await File.countDocuments({ 
                companyId: company._id 
              });
              
              const companyFolders = await Folder.countDocuments({ 
                companyId: company._id 
              });
              
              // Calcular espacio usado por esta compañía
              const companyStorage = await File.aggregate([
                { $match: { companyId: new mongoose.Types.ObjectId(company._id) } },
                { $group: { _id: null, total: { $sum: "$size" } } }
              ]);
              
              const storageUsedBytes = companyStorage.length > 0 ? companyStorage[0].total : 0;
              const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024) * 100) / 100;
              
              // Filtrar tipos de archivo para esta compañía
              const companyFileTypes = fileTypesByCompany
                .filter(item => item._id.companyId && 
                               item._id.companyId.toString() === company._id.toString())
                .reduce((acc, curr) => {
                  acc[curr._id.fileType || 'otros'] = curr.count;
                  return acc;
                }, {});
              
              return {
                id: company._id,
                name: company.name,
                stats: {
                  users: companyUsers,
                  files: companyFiles,
                  folders: companyFolders,
                  fileTypes: companyFileTypes,
                  storage: {
                    used: storageUsedMB,
                    unit: 'MB'
                  }
                }
              };
            })
          );
          
          // Preparar espacio usado total
          const storageUsedBytes = storageUsed.length > 0 ? storageUsed[0].total : 0;
          const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024) * 100) / 100;
          
          // Agrupar tipos de archivo para estadísticas globales
          const globalFileTypes = fileTypesByCompany.reduce((acc, curr) => {
            const fileType = curr._id.fileType || 'otros';
            acc[fileType] = (acc[fileType] || 0) + curr.count;
            return acc;
          }, {});
          
          return {
            global: {
              totalUsers,
              totalFiles,
              totalFolders,
              recentActivity: recentLogs,
              fileTypes: globalFileTypes,
              storage: {
                used: storageUsedMB,
                unit: 'MB'
              }
            },
            companies: companyStats
          };
        } else {
          // Comportamiento estándar para usuario normal o admin viendo una sola compañía
          const [
            totalUsers,
            totalFiles,
            totalFolders,
            recentLogs,
            fileTypes,
            storageUsed
          ] = await Promise.all([
            // Contar usuarios activos de la compañía
            User.countDocuments({ ...companyFilter, isActive: true }),
            
            // Contar archivos de la compañía
            File.countDocuments(companyFilter),
            
            // Contar carpetas de la compañía
            Folder.countDocuments(companyFilter),
            
            // Obtener los últimos logs (5)
            Log.find(companyFilter)
              .sort({ createdAt: -1 })
              .limit(5)
              .populate('userId', 'name email')
              .select('action entityType details createdAt'),
              
            // Contar archivos por tipo
            File.aggregate([
              { $match: { ...(companyFilter.companyId ? { companyId: new mongoose.Types.ObjectId(companyFilter.companyId) } : {}) } },
              { $group: { _id: "$fileType", count: { $sum: 1 } } }
            ]),
            
            // Calcular espacio usado (en bytes)
            File.aggregate([
              { $match: { ...(companyFilter.companyId ? { companyId: new mongoose.Types.ObjectId(companyFilter.companyId) } : {}) } },
              { $group: { _id: null, total: { $sum: "$size" } } }
            ])
          ]);
          
          // Preparar datos de tipos de archivo
          const fileTypeStats = {};
          fileTypes.forEach(type => {
            fileTypeStats[type._id || 'otros'] = type.count;
          });
          
          // Preparar espacio usado
          const storageUsedBytes = storageUsed.length > 0 ? storageUsed[0].total : 0;
          const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024) * 100) / 100;
          
          return {
            totalUsers,
            totalFiles,
            totalFolders,
            recentActivity: recentLogs,
            fileTypes: fileTypeStats,
            storage: {
              used: storageUsedMB,
              unit: 'MB'
            }
          };
        }
      },
      CACHE_TTL.STATS
    );
    
    // Devolver respuesta
    res.json({
      success: true,
      data: statsData
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas del dashboard',
      error: error.message
    });
  }
};

/**
 * Obtener todas las áreas con sus subáreas y métricas asociadas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getAreas = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    let companyFilter;
    let companyId = req.query.companyId || req.user.companyId;
    
    if (viewAllCompanies) {
      companyFilter = {};
      companyId = 'all';
    } else {
      if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un ID de compañía válido'
        });
      }
      companyFilter = { companyId };
    }
    
    // Filtros opcionales
    const { search, minCompletion, maxCompletion } = req.query;
    
    // Clave de caché basada en la compañía y filtros
    const cacheKey = `areas:${companyId}:${search || ''}:${minCompletion || ''}:${maxCompletion || ''}`;
    
    // Utilizar caché para obtener o calcular las áreas
    const result = await cache.withCache(
      cacheKey,
      async () => {
        const filter = { ...companyFilter, active: true };
        
        // Si el admin está viendo todas las compañías, necesitamos agrupar por compañía
        if (viewAllCompanies) {
          // Obtener todas las compañías activas
          const companies = await Company.find({ active: true }).select('_id name');
          
          // Procesar cada compañía
          const companiesWithAreas = await Promise.all(
            companies.map(async (company) => {
              // Buscar áreas de esta compañía
              let areas = await Area.find({ companyId: company._id, active: true })
                .populate({
                  path: 'responsibleUserId',
                  select: 'name email'
                })
                .populate('companyId', 'name')
                .sort({ order: 1, name: 1 });
              
              // Buscar subáreas para cada área
              const areasWithSubAreas = await Promise.all(
                areas.map(async (area) => {
                  const subAreas = await SubArea.find({ 
                    areaId: area._id,
                    active: true 
                  })
                  .populate({
                    path: 'responsibleUserId',
                    select: 'name email'
                  })
                  .sort({ order: 1, name: 1 });
                  
                  // Calcular métricas para cada subárea
                  const subAreasWithMetrics = await Promise.all(
                    subAreas.map(async (subArea) => {
                      // Obtener archivos existentes
                      const existingFiles = await File.countDocuments({
                        folderId: subArea.folderId
                      });
                      
                      // Calcular métricas
                      const totalFiles = subArea.expectedFiles;
                      const pendingFiles = Math.max(0, totalFiles - existingFiles);
                      const completionRate = totalFiles > 0 
                        ? Math.round((existingFiles / totalFiles) * 100) 
                        : 0;
                      
                      return {
                        id: subArea._id,
                        name: subArea.name,
                        totalFiles,
                        existingFiles,
                        pendingFiles,
                        responsible: subArea.responsibleUserId ? subArea.responsibleUserId.name : 'No asignado',
                        responsibleEmail: subArea.responsibleUserId ? subArea.responsibleUserId.email : '',
                        completionRate
                      };
                    })
                  );
                  
                  // Filtrar por búsqueda si se especifica
                  const filteredSubAreas = search 
                    ? subAreasWithMetrics.filter(sa => 
                        sa.name.toLowerCase().includes(search.toLowerCase()) || 
                        sa.responsible.toLowerCase().includes(search.toLowerCase()))
                    : subAreasWithMetrics;
                    
                  // Filtrar por tasa de completitud si se especifica
                  const completionFilteredSubAreas = filteredSubAreas.filter(sa => {
                    if (minCompletion && sa.completionRate < parseInt(minCompletion)) return false;
                    if (maxCompletion && sa.completionRate > parseInt(maxCompletion)) return false;
                    return true;
                  });
                  
                  // Calcular métricas agregadas del área
                  const totalFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.totalFiles, 0);
                  const existingFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.existingFiles, 0);
                  const pendingFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.pendingFiles, 0);
                  const completionRate = totalFiles > 0 
                    ? Math.round((existingFiles / totalFiles) * 100) 
                    : 0;
                  
                  return {
                    id: area._id,
                    name: area.name,
                    totalFiles,
                    existingFiles,
                    pendingFiles,
                    responsible: area.responsibleUserId ? area.responsibleUserId.name : 'No asignado',
                    responsibleEmail: area.responsibleUserId ? area.responsibleUserId.email : '',
                    completionRate,
                    subAreas: completionFilteredSubAreas
                  };
                })
              );
              
              // Filtrar áreas por búsqueda si se especifica
              const filteredAreas = search 
                ? areasWithSubAreas.filter(a => 
                    a.name.toLowerCase().includes(search.toLowerCase()) || 
                    a.responsible.toLowerCase().includes(search.toLowerCase()) ||
                    a.subAreas.length > 0)
                : areasWithSubAreas;
                
              // Filtrar áreas por tasa de completitud si se especifica
              const completionFilteredAreas = filteredAreas.filter(a => {
                if (minCompletion && a.completionRate < parseInt(minCompletion)) return false;
                if (maxCompletion && a.completionRate > parseInt(maxCompletion)) return false;
                return true;
              });
              
              // Calcular resumen de la compañía
              const totalFiles = completionFilteredAreas.reduce((sum, a) => sum + a.totalFiles, 0);
              const existingFiles = completionFilteredAreas.reduce((sum, a) => sum + a.existingFiles, 0);
              const pendingFiles = completionFilteredAreas.reduce((sum, a) => sum + a.pendingFiles, 0);
              const completionRate = totalFiles > 0 
                ? Math.round((existingFiles / totalFiles) * 100) 
                : 0;
              
              return {
                id: company._id,
                name: company.name,
                areas: completionFilteredAreas,
                summary: {
                  totalFiles,
                  existingFiles,
                  pendingFiles,
                  completionRate
                }
              };
            })
          );
          
          // Calcular resumen global
          const totalFiles = companiesWithAreas.reduce((sum, c) => sum + c.summary.totalFiles, 0);
          const existingFiles = companiesWithAreas.reduce((sum, c) => sum + c.summary.existingFiles, 0);
          const pendingFiles = companiesWithAreas.reduce((sum, c) => sum + c.summary.pendingFiles, 0);
          const completionRate = totalFiles > 0 
            ? Math.round((existingFiles / totalFiles) * 100) 
            : 0;
          
          return {
            companies: companiesWithAreas,
            summary: {
              totalFiles,
              existingFiles,
              pendingFiles,
              completionRate
            }
          };
        } else {
          // Comportamiento estándar para ver una sola compañía
          // Buscar áreas
          let areas = await Area.find(filter)
            .populate({
              path: 'responsibleUserId',
              select: 'name email'
            })
            .sort({ order: 1, name: 1 });
          
          // Buscar subáreas para cada área
          const areasWithSubAreas = await Promise.all(
            areas.map(async (area) => {
              const subAreas = await SubArea.find({ 
                areaId: area._id,
                active: true 
              })
              .populate({
                path: 'responsibleUserId',
                select: 'name email'
              })
              .sort({ order: 1, name: 1 });
              
              // Calcular métricas para cada subárea
              const subAreasWithMetrics = await Promise.all(
                subAreas.map(async (subArea) => {
                  // Obtener archivos existentes
                  const existingFiles = await File.countDocuments({
                    folderId: subArea.folderId
                  });
                  
                  // Calcular métricas
                  const totalFiles = subArea.expectedFiles;
                  const pendingFiles = Math.max(0, totalFiles - existingFiles);
                  const completionRate = totalFiles > 0 
                    ? Math.round((existingFiles / totalFiles) * 100) 
                    : 0;
                  
                  return {
                    id: subArea._id,
                    name: subArea.name,
                    totalFiles,
                    existingFiles,
                    pendingFiles,
                    responsible: subArea.responsibleUserId ? subArea.responsibleUserId.name : 'No asignado',
                    responsibleEmail: subArea.responsibleUserId ? subArea.responsibleUserId.email : '',
                    completionRate
                  };
                })
              );
              
              // Filtrar por búsqueda si se especifica
              const filteredSubAreas = search 
                ? subAreasWithMetrics.filter(sa => 
                    sa.name.toLowerCase().includes(search.toLowerCase()) || 
                    sa.responsible.toLowerCase().includes(search.toLowerCase()))
                : subAreasWithMetrics;
                
              // Filtrar por tasa de completitud si se especifica
              const completionFilteredSubAreas = filteredSubAreas.filter(sa => {
                if (minCompletion && sa.completionRate < parseInt(minCompletion)) return false;
                if (maxCompletion && sa.completionRate > parseInt(maxCompletion)) return false;
                return true;
              });
              
              // Calcular métricas agregadas del área
              const totalFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.totalFiles, 0);
              const existingFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.existingFiles, 0);
              const pendingFiles = completionFilteredSubAreas.reduce((sum, sa) => sum + sa.pendingFiles, 0);
              const completionRate = totalFiles > 0 
                ? Math.round((existingFiles / totalFiles) * 100) 
                : 0;
              
              return {
                id: area._id,
                name: area.name,
                totalFiles,
                existingFiles,
                pendingFiles,
                responsible: area.responsibleUserId ? area.responsibleUserId.name : 'No asignado',
                responsibleEmail: area.responsibleUserId ? area.responsibleUserId.email : '',
                completionRate,
                subAreas: completionFilteredSubAreas
              };
            })
          );
          
          // Filtrar áreas por búsqueda si se especifica
          const filteredAreas = search 
            ? areasWithSubAreas.filter(a => 
                a.name.toLowerCase().includes(search.toLowerCase()) || 
                a.responsible.toLowerCase().includes(search.toLowerCase()) ||
                a.subAreas.length > 0)
            : areasWithSubAreas;
            
          // Filtrar áreas por tasa de completitud si se especifica
          const completionFilteredAreas = filteredAreas.filter(a => {
            if (minCompletion && a.completionRate < parseInt(minCompletion)) return false;
            if (maxCompletion && a.completionRate > parseInt(maxCompletion)) return false;
            return true;
          });
          
          // Calcular resumen global
          const totalFiles = completionFilteredAreas.reduce((sum, a) => sum + a.totalFiles, 0);
          const existingFiles = completionFilteredAreas.reduce((sum, a) => sum + a.existingFiles, 0);
          const pendingFiles = completionFilteredAreas.reduce((sum, a) => sum + a.pendingFiles, 0);
          const completionRate = totalFiles > 0 
            ? Math.round((existingFiles / totalFiles) * 100) 
            : 0;
          
          return {
            areas: completionFilteredAreas,
            summary: {
              totalFiles,
              existingFiles,
              pendingFiles,
              completionRate
            }
          };
        }
      },
      CACHE_TTL.AREAS
    );
    
    // Si res es un objeto response real, enviar la respuesta
    if (res && typeof res.json === 'function') {
      res.json(result);
    }
    
    // Si se está llamando internamente, devolver los datos
    return result;
    
  } catch (error) {
    console.error('Error al obtener áreas para el dashboard:', error);
    if (res && typeof res.status === 'function') {
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener áreas para el dashboard',
        error: error.message
      });
    }
    throw error;
  }
};

/**
 * Obtener información detallada de un área específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getAreaById = async (req, res) => {
  try {
    const { areaId } = req.params;
    
    if (!areaId || !mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de área válido'
      });
    }
    
    // Clave de caché basada en el ID del área
    const cacheKey = `area:${areaId}`;
    
    // Utilizar caché para obtener o calcular el área
    const areaData = await cache.withCache(
      cacheKey,
      async () => {
        // Buscar el área
        const area = await Area.findById(areaId)
          .populate({
            path: 'responsibleUserId',
            select: 'name email'
          })
          .populate('companyId', 'name'); // Añadir info de la compañía
          
        if (!area) {
          throw new Error('Área no encontrada');
        }
        
        // Verificar si el usuario tiene acceso a esta área
        // Los administradores pueden ver cualquier área, otros usuarios solo las de su compañía
        if (!req.user.roles.includes('admin') && req.user.companyId.toString() !== area.companyId.toString()) {
          throw new Error('No tienes permisos para ver esta área');
        }
        
        // Buscar subáreas
        const subAreas = await SubArea.find({ 
          areaId: area._id,
          active: true 
        })
        .populate({
          path: 'responsibleUserId',
          select: 'name email'
        })
        .sort({ order: 1, name: 1 });
        
        // Calcular métricas para cada subárea
        const subAreasWithMetrics = await Promise.all(
          subAreas.map(async (subArea) => {
            // Obtener archivos existentes
            const existingFiles = await File.countDocuments({
              folderId: subArea.folderId
            });
            
            // Calcular métricas
            const totalFiles = subArea.expectedFiles;
            const pendingFiles = Math.max(0, totalFiles - existingFiles);
            const completionRate = totalFiles > 0 
              ? Math.round((existingFiles / totalFiles) * 100) 
              : 0;
            
            return {
              id: subArea._id,
              name: subArea.name,
              totalFiles,
              existingFiles,
              pendingFiles,
              responsible: subArea.responsibleUserId ? subArea.responsibleUserId.name : 'No asignado',
              responsibleEmail: subArea.responsibleUserId ? subArea.responsibleUserId.email : '',
              completionRate
            };
          })
        );
        
        // Calcular métricas agregadas del área
        const totalFiles = subAreasWithMetrics.reduce((sum, sa) => sum + sa.totalFiles, 0);
        const existingFiles = subAreasWithMetrics.reduce((sum, sa) => sum + sa.existingFiles, 0);
        const pendingFiles = subAreasWithMetrics.reduce((sum, sa) => sum + sa.pendingFiles, 0);
        const completionRate = totalFiles > 0 
          ? Math.round((existingFiles / totalFiles) * 100) 
          : 0;
        
        // Incluir información de la compañía
        return {
          id: area._id,
          name: area.name,
          totalFiles,
          existingFiles,
          pendingFiles,
          responsible: area.responsibleUserId ? area.responsibleUserId.name : 'No asignado',
          responsibleEmail: area.responsibleUserId ? area.responsibleUserId.email : '',
          completionRate,
          company: area.companyId ? {
            id: area.companyId._id,
            name: area.companyId.name
          } : null,
          subAreas: subAreasWithMetrics
        };
      },
      CACHE_TTL.AREAS
    );
    
    res.json(areaData);
    
  } catch (error) {
    console.error('Error al obtener área específica:', error);
    
    if (error.message === 'Área no encontrada') {
      return res.status(404).json({
        success: false,
        message: 'Área no encontrada'
      });
    }
    
    if (error.message === 'No tienes permisos para ver esta área') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta área'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener área específica',
      error: error.message
    });
  }
};

/**
 * Obtener resumen de métricas globales
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getSummary = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    let companyFilter;
    let companyId = req.query.companyId || req.user.companyId;
    
    if (viewAllCompanies) {
      companyFilter = {};
      companyId = 'all';
    } else {
      if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un ID de compañía válido'
        });
      }
      companyFilter = { companyId };
    }
    
    // Clave de caché basada en la compañía
    const cacheKey = `summary:${companyId}`;
    
    // Utilizar caché para obtener o calcular el resumen
    const summaryData = await cache.withCache(
      cacheKey,
      async () => {
        if (viewAllCompanies) {
          // Si es administrador viendo todas las empresas
          // Obtener todas las compañías activas
          const companies = await Company.find({ active: true }).select('_id name');
          
          // Calcular métricas por cada compañía
          const companySummaries = await Promise.all(
            companies.map(async (company) => {
              // Obtener todas las subáreas de esta compañía
              const subAreas = await SubArea.find({ 
                companyId: company._id,
                active: true 
              });
              
              // Calcular métricas para esta compañía
              let totalExpectedFiles = 0;
              let totalExistingFiles = 0;
              
              await Promise.all(
                subAreas.map(async (subArea) => {
                  // Sumar archivos esperados
                  totalExpectedFiles += subArea.expectedFiles;
                  
                  // Contar archivos existentes
                  const existingFiles = await File.countDocuments({
                    folderId: subArea.folderId
                  });
                  
                  totalExistingFiles += existingFiles;
                })
              );
              
              const pendingFiles = Math.max(0, totalExpectedFiles - totalExistingFiles);
              const completionRate = totalExpectedFiles > 0 
                ? Math.round((totalExistingFiles / totalExpectedFiles) * 100) 
                : 0;
              
              return {
                companyId: company._id,
                companyName: company.name,
                totalFiles: totalExpectedFiles,
                existingFiles: totalExistingFiles,
                pendingFiles,
                completionRate
              };
            })
          );
          
          // Calcular totales globales
          const totalFiles = companySummaries.reduce((sum, company) => sum + company.totalFiles, 0);
          const existingFiles = companySummaries.reduce((sum, company) => sum + company.existingFiles, 0);
          const pendingFiles = companySummaries.reduce((sum, company) => sum + company.pendingFiles, 0);
          const completionRate = totalFiles > 0 
            ? Math.round((existingFiles / totalFiles) * 100) 
            : 0;
          
          return {
            global: {
              totalFiles,
              existingFiles,
              pendingFiles,
              completionRate
            },
            companies: companySummaries
          };
        } else {
          // Comportamiento estándar para una sola compañía
          // Obtener todas las subáreas
          const subAreas = await SubArea.find({ 
            ...companyFilter,
            active: true 
          });
          
          // Calcular métricas globales
          let totalExpectedFiles = 0;
          let totalExistingFiles = 0;
          
          await Promise.all(
            subAreas.map(async (subArea) => {
              // Sumar archivos esperados
              totalExpectedFiles += subArea.expectedFiles;
              
              // Contar archivos existentes
              const existingFiles = await File.countDocuments({
                folderId: subArea.folderId
              });
              
              totalExistingFiles += existingFiles;
            })
          );
          
          const pendingFiles = Math.max(0, totalExpectedFiles - totalExistingFiles);
          const completionRate = totalExpectedFiles > 0 
            ? Math.round((totalExistingFiles / totalExpectedFiles) * 100) 
            : 0;
          
          return {
            totalFiles: totalExpectedFiles,
            existingFiles: totalExistingFiles,
            pendingFiles,
            completionRate
          };
        }
      },
      CACHE_TTL.AREAS
    );
    
    res.json(summaryData);
    
  } catch (error) {
    console.error('Error al obtener resumen del dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener resumen del dashboard',
      error: error.message
    });
  }
};

/**
 * Obtener datos formateados para visualización de Treemap
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getTreemapData = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    let companyId = req.query.companyId || req.user.companyId;
    
    if (viewAllCompanies) {
      companyId = 'all';
    } else if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de compañía válido'
      });
    }
    
    // Clave de caché basada en la compañía
    const cacheKey = `treemap:${companyId}`;
    
    // Utilizar caché para obtener o calcular los datos del treemap
    const treemapData = await cache.withCache(
      cacheKey,
      async () => {
        // Obtener áreas con sus métricas
        const areasData = await exports.getAreas({ 
          query: { 
            companyId,
            allCompanies: viewAllCompanies ? 'true' : 'false'
          },
          user: req.user
        }, null);
        
        if (viewAllCompanies) {
          // Formato para todas las compañías
          return {
            name: "Sistema Completo",
            value: 0,
            children: areasData.companies.map(company => ({
              name: company.name,
              value: company.summary.totalFiles,
              completionRate: company.summary.completionRate,
              data: company.summary,
              children: company.areas.map(area => ({
                name: area.name,
                value: area.totalFiles,
                completionRate: area.completionRate,
                responsible: area.responsible,
                data: area,
                children: area.subAreas.map(subArea => ({
                  name: subArea.name,
                  value: subArea.totalFiles,
                  completionRate: subArea.completionRate,
                  responsible: subArea.responsible,
                  data: subArea
                }))
              }))
            }))
          };
        } else {
          // Formato estándar para una compañía
          return {
            name: "Áreas",
            value: 0,
            children: areasData.areas.map(area => ({
              name: area.name,
              value: area.totalFiles,
              completionRate: area.completionRate,
              responsible: area.responsible,
              data: area,
              children: area.subAreas.map(subArea => ({
                name: subArea.name,
                value: subArea.totalFiles,
                completionRate: subArea.completionRate,
                responsible: subArea.responsible,
                data: subArea
              }))
            }))
          };
        }
      },
      CACHE_TTL.VISUALIZATIONS
    );
    
    res.json(treemapData);
    
  } catch (error) {
    console.error('Error al obtener datos para treemap:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener datos para treemap',
      error: error.message
    });
  }
};

/**
 * Obtener datos formateados para visualización de Hexágonos
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getHexagonsData = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    let companyId = req.query.companyId || req.user.companyId;
    
    if (viewAllCompanies) {
      companyId = 'all';
    } else if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de compañía válido'
      });
    }
    
    // Clave de caché basada en la compañía
    const cacheKey = `hexagons:${companyId}`;
    
    // Utilizar caché para obtener o calcular los datos de hexágonos
    const hexagonsData = await cache.withCache(
      cacheKey,
      async () => {
        // Obtener áreas con sus métricas
        const areasData = await exports.getAreas({ 
          query: { 
            companyId,
            allCompanies: viewAllCompanies ? 'true' : 'false'
          },
          user: req.user
        }, null);
        
        // Transformar datos al formato de hexágonos
        const nodes = [];
        const links = [];
        
        if (viewAllCompanies) {
          // Agregar un nodo central para todo el sistema
          nodes.push({
            id: "system",
            name: "Sistema Completo",
            value: areasData.summary.totalFiles,
            completionRate: areasData.summary.completionRate,
            type: 'system',
            data: areasData.summary
          });
          
          // Agregar nodos para cada compañía
          areasData.companies.forEach(company => {
            // Agregar nodo de compañía
            nodes.push({
              id: `company-${company.id}`,
              name: company.name,
              value: company.summary.totalFiles,
              completionRate: company.summary.completionRate,
              type: 'company',
              data: company.summary
            });
            
            // Enlace entre sistema y compañía
            links.push({
              source: "system",
              target: `company-${company.id}`,
              value: company.summary.totalFiles
            });
            
            // Agregar áreas de esta compañía
            company.areas.forEach(area => {
              // Agregar nodo de área
              nodes.push({
                id: `area-${area.id}`,
                name: area.name,
                value: area.totalFiles,
                completionRate: area.completionRate,
                responsible: area.responsible,
                type: 'area',
                companyId: company.id,
                data: area
              });
              
              // Enlace entre compañía y área
              links.push({
                source: `company-${company.id}`,
                target: `area-${area.id}`,
                value: area.totalFiles
              });
              
              // Agregar subáreas
              area.subAreas.forEach(subArea => {
                // Nodo de subárea
                nodes.push({
                  id: `subarea-${subArea.id}`,
                  name: subArea.name,
                  value: subArea.totalFiles,
                  completionRate: subArea.completionRate,
                  responsible: subArea.responsible,
                  type: 'subarea',
                  companyId: company.id,
                  parentId: area.id,
                  data: subArea
                });
                
                // Enlace entre área y subárea
                links.push({
                  source: `area-${area.id}`,
                  target: `subarea-${subArea.id}`,
                  value: subArea.totalFiles
                });
              });
            });
          });
        } else {
          // Comportamiento estándar para una sola compañía
          // Agregar áreas como nodos
          areasData.areas.forEach(area => {
            nodes.push({
              id: area.id.toString(),
              name: area.name,
              value: area.totalFiles,
              completionRate: area.completionRate,
              responsible: area.responsible,
              type: 'area',
              data: area
            });
            
            // Agregar subáreas como nodos
            area.subAreas.forEach(subArea => {
              nodes.push({
                id: subArea.id.toString(),
                name: subArea.name,
                value: subArea.totalFiles,
                completionRate: subArea.completionRate,
                responsible: subArea.responsible,
                type: 'subarea',
                parentId: area.id.toString(),
                data: subArea
              });
              
              // Agregar enlaces entre área y subárea
              links.push({
                source: area.id.toString(),
                target: subArea.id.toString(),
                value: subArea.totalFiles
              });
            });
          });
        }
        
        return {
          nodes,
          links
        };
      },
      CACHE_TTL.VISUALIZATIONS
    );
    
    res.json(hexagonsData);
    
  } catch (error) {
    console.error('Error al obtener datos para hexágonos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener datos para hexágonos',
      error: error.message
    });
  }
};

/**
 * Obtener datos formateados para visualización de Árbol Radial
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getRadialTreeData = async (req, res) => {
  try {
    // Verificar si el usuario es admin y quiere ver todas las empresas
    const viewAllCompanies = shouldShowAllCompanies(req);
    
    // Filtro de compañía según el rol y parámetros
    let companyId = req.query.companyId || req.user.companyId;
    
    if (viewAllCompanies) {
      companyId = 'all';
    } else if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de compañía válido'
      });
    }
    
    // Clave de caché basada en la compañía
    const cacheKey = `radialtree:${companyId}`;
    
    // Utilizar caché para obtener o calcular los datos del árbol radial
    const radialTreeData = await cache.withCache(
      cacheKey,
      async () => {
        // Obtener áreas con sus métricas
        const areasData = await exports.getAreas({ 
          query: { 
            companyId,
            allCompanies: viewAllCompanies ? 'true' : 'false'
          },
          user: req.user
        }, null);
        
        if (viewAllCompanies) {
          // Formato para todas las compañías
          return {
            name: "Sistema",
            value: areasData.summary.totalFiles,
            data: {
              completionRate: areasData.summary.completionRate,
              existingFiles: areasData.summary.existingFiles,
              pendingFiles: areasData.summary.pendingFiles
            },
            children: areasData.companies.map(company => ({
              name: company.name,
              value: company.summary.totalFiles,
              data: {
                completionRate: company.summary.completionRate,
                existingFiles: company.summary.existingFiles,
                pendingFiles: company.summary.pendingFiles
              },
              children: company.areas.map(area => ({
                name: area.name,
                value: area.totalFiles,
                data: {
                  completionRate: area.completionRate,
                  responsible: area.responsible,
                  existingFiles: area.existingFiles,
                  pendingFiles: area.pendingFiles
                },
                children: area.subAreas.map(subArea => ({
                  name: subArea.name,
                  value: subArea.totalFiles,
                  data: {
                    completionRate: subArea.completionRate,
                    responsible: subArea.responsible,
                    existingFiles: subArea.existingFiles,
                    pendingFiles: subArea.pendingFiles
                  }
                }))
              }))
            }))
          };
        } else {
          // Formato estándar para una compañía
          return {
            name: "Áreas",
            value: 0,
            children: areasData.areas.map(area => ({
              name: area.name,
              value: area.totalFiles,
              data: {
                completionRate: area.completionRate,
                responsible: area.responsible,
                existingFiles: area.existingFiles,
                pendingFiles: area.pendingFiles
              },
              children: area.subAreas.map(subArea => ({
                name: subArea.name,
                value: subArea.totalFiles,
                data: {
                  completionRate: subArea.completionRate,
                  responsible: subArea.responsible,
                  existingFiles: subArea.existingFiles,
                  pendingFiles: subArea.pendingFiles
                }
              }))
            }))
          };
        }
      },
      CACHE_TTL.VISUALIZATIONS
    );
    
    res.json(radialTreeData);
    
  } catch (error) {
    console.error('Error al obtener datos para árbol radial:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener datos para árbol radial',
      error: error.message
    });
  }
};

/**
 * Invalidar la caché del dashboard para una compañía específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.invalidateCache = async (req, res) => {
  try {
    // Verificar si es admin y quiere invalidar caché para todas las empresas
    const invalidateAllCompanies = 
      req.user.roles.includes('admin') && 
      req.query.allCompanies === 'true';
    
    const companyId = req.query.companyId || req.user.companyId;
    
    if (!invalidateAllCompanies && (!companyId || !mongoose.Types.ObjectId.isValid(companyId))) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de compañía válido'
      });
    }
    
    if (invalidateAllCompanies) {
      // Limpiar toda la caché
      cache.clear();
      console.log('Caché global invalidada por administrador');
    } else {
      // Eliminar todas las entradas de caché relacionadas con esta compañía
      cache.delPattern(`stats:${companyId}`);
      cache.delPattern(`areas:${companyId}`);
      cache.delPattern(`summary:${companyId}`);
      cache.delPattern(`treemap:${companyId}`);
      cache.delPattern(`hexagons:${companyId}`);
      cache.delPattern(`radialtree:${companyId}`);
      console.log(`Caché invalidada para la compañía: ${companyId}`);
    }
    
    res.json({
      success: true,
      message: invalidateAllCompanies 
        ? 'Caché global invalidada correctamente' 
        : 'Caché invalidada correctamente para la compañía especificada'
    });
    
  } catch (error) {
    console.error('Error al invalidar caché:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al invalidar caché',
      error: error.message
    });
  }
}; 