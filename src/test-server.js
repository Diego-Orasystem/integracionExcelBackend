const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

// Inicializar Express
const app = express();
const PORT = 5002;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crear directorio de uploads si no existe
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Directorio estático para archivos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Crear datos de prueba
const mockFolders = [
  { 
    _id: '60d21b4667d0d8992e610c87', 
    name: 'Documentos', 
    path: '/Documentos',
    companyId: '60d21b4667d0d8992e610c86',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  { 
    _id: '60d21b4667d0d8992e610c88', 
    name: 'Informes', 
    path: '/Informes',
    companyId: '60d21b4667d0d8992e610c86',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockFiles = [
  {
    _id: '60d21b4667d0d8992e610c89',
    name: 'Reporte_Mayo.xlsx',
    originalName: 'Reporte_Mayo.xlsx',
    size: 12345,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
    folderId: '60d21b4667d0d8992e610c87',
    companyId: '60d21b4667d0d8992e610c86',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Middleware para simular autenticación
app.use((req, res, next) => {
  // Agregar usuario de prueba a todas las solicitudes
  req.user = {
    _id: 'test-user-id',
    name: 'Usuario de Prueba',
    email: 'test@example.com',
    role: 'user',
    companyId: 'test-company-id'
  };
  next();
});

// ===== RUTAS MOCKUP =====

// Rutas de carpetas (folders)
app.get('/folders', (req, res) => {
  res.status(200).json({
    success: true,
    data: mockFolders.map(folder => ({
      ...folder,
      fileCount: mockFiles.filter(f => f.folderId === folder._id).length,
      subfolderCount: mockFolders.filter(f => f.parentId === folder._id).length
    }))
  });
});

app.post('/folders', (req, res) => {
  const { name, parentId } = req.body;
  const newFolder = {
    _id: Date.now().toString(),
    name,
    parentId,
    path: parentId ? '/Subcarpeta' : `/${name}`,
    companyId: req.user.companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  mockFolders.push(newFolder);
  res.status(201).json({
    success: true,
    data: newFolder
  });
});

app.get('/folders/:id', (req, res) => {
  const folder = mockFolders.find(f => f._id === req.params.id);
  if (!folder) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FOLDER_NOT_FOUND',
        message: 'Carpeta no encontrada'
      }
    });
  }
  res.status(200).json({
    success: true,
    data: folder
  });
});

app.delete('/folders/:id', (req, res) => {
  const index = mockFolders.findIndex(f => f._id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FOLDER_NOT_FOUND',
        message: 'Carpeta no encontrada'
      }
    });
  }
  mockFolders.splice(index, 1);
  res.status(200).json({
    success: true,
    data: {}
  });
});

// Rutas de archivos (files)
app.get('/files', (req, res) => {
  const { folderId } = req.query;
  const files = folderId 
    ? mockFiles.filter(f => f.folderId === folderId)
    : mockFiles;
  res.status(200).json({
    success: true,
    data: files,
    pagination: {
      total: files.length,
      page: 1,
      limit: 50
    }
  });
});

app.post('/files/upload', (req, res) => {
  // En un servidor real, aquí se utilizaría multer para subir archivos
  const newFile = {
    _id: Date.now().toString(),
    name: req.body.name || 'Nuevo_Archivo.xlsx',
    originalName: req.body.name || 'Nuevo_Archivo.xlsx',
    description: req.body.description || '',
    size: 54321,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
    folderId: req.body.folderId,
    companyId: req.user.companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  mockFiles.push(newFile);
  res.status(201).json({
    success: true,
    data: newFile
  });
});

// Ruta de búsqueda de archivos - debe ir antes que la ruta por ID para evitar conflictos
app.get('/files/search', (req, res) => {
  const { query } = req.query;
  const files = query
    ? mockFiles.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : mockFiles;
  res.status(200).json({
    success: true,
    data: files
  });
});

// Ruta de archivos por ID
app.get('/files/:id', (req, res) => {
  const file = mockFiles.find(f => f._id === req.params.id);
  if (!file) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'Archivo no encontrado'
      }
    });
  }
  res.status(200).json({
    success: true,
    data: file
  });
});

app.get('/files/:id/download', (req, res) => {
  const file = mockFiles.find(f => f._id === req.params.id);
  if (!file) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'Archivo no encontrado'
      }
    });
  }
  
  // Para pruebas, creamos un archivo de ejemplo si no existe
  const exampleFilePath = path.join(__dirname, '../uploads/ejemplo.xlsx');
  if (!fs.existsSync(exampleFilePath)) {
    // Crear un archivo vacío para pruebas
    fs.writeFileSync(exampleFilePath, 'Archivo de ejemplo');
  }
  
  // Simular la descarga con un archivo de ejemplo
  res.download(exampleFilePath, file.originalName);
});

app.delete('/files/:id', (req, res) => {
  const index = mockFiles.findIndex(f => f._id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: 'Archivo no encontrado'
      }
    });
  }
  mockFiles.splice(index, 1);
  res.status(200).json({
    success: true,
    data: {}
  });
});

// Ruta para obtener datos agregados sobre el estado de los archivos
app.get('/api/files/status', (req, res) => {
  const { groupBy } = req.query;
  let result = [];
  
  if (groupBy === 'folder') {
    // Agrupar por carpeta
    const folderGroups = {};
    
    mockFiles.forEach(file => {
      const folder = mockFolders.find(f => f._id === file.folderId);
      if (!folder) return;
      
      if (!folderGroups[file.folderId]) {
        folderGroups[file.folderId] = {
          _id: file.folderId,
          folderName: folder.name,
          folderPath: folder.path,
          totalFiles: 0,
          pendientes: 0,
          procesando: 0,
          procesados: 0,
          errores: 0,
          tamanioTotal: 0,
          archivos: []
        };
      }
      
      folderGroups[file.folderId].totalFiles++;
      folderGroups[file.folderId].tamanioTotal += file.size;
      
      // Determinar estado aleatorio si no tiene
      const estado = file.status || ['pendiente', 'procesando', 'procesado', 'error'][Math.floor(Math.random() * 4)];
      folderGroups[file.folderId][estado === 'pendiente' ? 'pendientes' : 
                                 estado === 'procesando' ? 'procesando' : 
                                 estado === 'procesado' ? 'procesados' : 'errores']++;
      
      folderGroups[file.folderId].archivos.push({
        id: file._id,
        nombre: file.name,
        estado: estado
      });
    });
    
    result = Object.values(folderGroups);
  } else if (groupBy === 'date') {
    // Agrupar por fecha
    const dateGroups = {};
    
    mockFiles.forEach(file => {
      const createdAt = file.createdAt || new Date();
      const fecha = createdAt.toISOString().split('T')[0];
      
      if (!dateGroups[fecha]) {
        dateGroups[fecha] = {
          _id: fecha,
          fecha: fecha,
          totalFiles: 0,
          pendientes: 0,
          procesando: 0,
          procesados: 0,
          errores: 0,
          tamanioTotal: 0,
          archivos: []
        };
      }
      
      dateGroups[fecha].totalFiles++;
      dateGroups[fecha].tamanioTotal += file.size;
      
      // Determinar estado aleatorio si no tiene
      const estado = file.status || ['pendiente', 'procesando', 'procesado', 'error'][Math.floor(Math.random() * 4)];
      dateGroups[fecha][estado === 'pendiente' ? 'pendientes' : 
                       estado === 'procesando' ? 'procesando' : 
                       estado === 'procesado' ? 'procesados' : 'errores']++;
      
      dateGroups[fecha].archivos.push({
        id: file._id,
        nombre: file.name,
        estado: estado
      });
    });
    
    result = Object.values(dateGroups).sort((a, b) => b._id.localeCompare(a._id));
  } else if (groupBy === 'type') {
    // Agrupar por tipo de archivo
    const typeGroups = {};
    
    mockFiles.forEach(file => {
      const extension = file.extension || '.xlsx';
      
      if (!typeGroups[extension]) {
        typeGroups[extension] = {
          _id: extension,
          tipoArchivo: extension,
          totalFiles: 0,
          pendientes: 0,
          procesando: 0,
          procesados: 0,
          errores: 0,
          tamanioTotal: 0,
          archivos: []
        };
      }
      
      typeGroups[extension].totalFiles++;
      typeGroups[extension].tamanioTotal += file.size;
      
      // Determinar estado aleatorio si no tiene
      const estado = file.status || ['pendiente', 'procesando', 'procesado', 'error'][Math.floor(Math.random() * 4)];
      typeGroups[extension][estado === 'pendiente' ? 'pendientes' : 
                           estado === 'procesando' ? 'procesando' : 
                           estado === 'procesado' ? 'procesados' : 'errores']++;
      
      typeGroups[extension].archivos.push({
        id: file._id,
        nombre: file.name,
        estado: estado
      });
    });
    
    result = Object.values(typeGroups);
  } else {
    // Sin agrupación, solo estadísticas generales
    const totalStats = {
      _id: null,
      totalFiles: mockFiles.length,
      pendientes: 0,
      procesando: 0,
      procesados: 0,
      errores: 0,
      tamanioTotal: 0
    };
    
    mockFiles.forEach(file => {
      totalStats.tamanioTotal += file.size;
      
      // Determinar estado aleatorio si no tiene
      const estado = file.status || ['pendiente', 'procesando', 'procesado', 'error'][Math.floor(Math.random() * 4)];
      totalStats[estado === 'pendiente' ? 'pendientes' : 
                estado === 'procesando' ? 'procesando' : 
                estado === 'procesado' ? 'procesados' : 'errores']++;
    });
    
    result = [totalStats];
  }
  
  res.status(200).json({
    success: true,
    data: result
  });
});

// Ruta para obtener métricas para la visualización del rompecabezas
app.get('/api/files/metrics', (req, res) => {
  const { timeFrame } = req.query;
  
  // Simular filtro por tiempo
  const now = new Date();
  let filteredFiles = [...mockFiles];
  
  if (timeFrame === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filteredFiles = mockFiles.filter(file => {
      const createdAt = file.createdAt || new Date();
      return createdAt >= weekAgo;
    });
  } else if (timeFrame === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    filteredFiles = mockFiles.filter(file => {
      const createdAt = file.createdAt || new Date();
      return createdAt >= monthAgo;
    });
  }
  
  // Estadísticas generales
  const generalStats = {
    totalFiles: filteredFiles.length,
    pendientes: 0,
    procesando: 0,
    procesados: 0,
    errores: 0,
    tamanioPromedio: 0,
    tamanioTotal: 0
  };
  
  // Datos para el rompecabezas
  const puzzleItems = filteredFiles.map(file => {
    const folder = mockFolders.find(f => f._id === file.folderId) || { name: 'Desconocido' };
    
    // Determinar estado aleatorio si no tiene
    const status = file.status || ['pendiente', 'procesando', 'procesado', 'error'][Math.floor(Math.random() * 4)];
    
    // Actualizar estadísticas
    generalStats[status === 'pendiente' ? 'pendientes' : 
                status === 'procesando' ? 'procesando' : 
                status === 'procesado' ? 'procesados' : 'errores']++;
    
    generalStats.tamanioTotal += file.size;
    
    // Generar metadatos aleatorios si no existen
    const metadata = {
      sheets: ['Hoja1', 'Hoja2', 'Datos'],
      rowCount: Math.floor(Math.random() * 10000) + 100,
      columnCount: Math.floor(Math.random() * 20) + 5
    };
    
    // Crear objeto de archivo para el rompecabezas
    return {
      _id: file._id,
      name: file.name,
      status: status,
      size: file.size,
      folderId: file.folderId,
      folderName: folder.name,
      createdAt: file.createdAt || new Date(),
      processingTime: status === 'procesado' ? Math.floor(Math.random() * 120000) + 10000 : null,
      metadata: metadata,
      weight: status === 'procesado' ? 1 :
              status === 'pendiente' ? 0.6 :
              status === 'procesando' ? 0.8 :
              status === 'error' ? 0.4 : 0.5
    };
  }).sort((a, b) => b.weight - a.weight || b.size - a.size);
  
  // Calcular promedio de tamaño
  generalStats.tamanioPromedio = generalStats.totalFiles > 0 ? 
    Math.round(generalStats.tamanioTotal / generalStats.totalFiles) : 0;
  
  // Calcular distribución de estados
  const distribucionEstados = generalStats.totalFiles > 0 ? [
    { k: 'pendientes', v: generalStats.pendientes / generalStats.totalFiles },
    { k: 'procesando', v: generalStats.procesando / generalStats.totalFiles },
    { k: 'procesados', v: generalStats.procesados / generalStats.totalFiles },
    { k: 'errores', v: generalStats.errores / generalStats.totalFiles }
  ] : [];
  
  generalStats.distribucionEstados = distribucionEstados;
  
  res.status(200).json({
    success: true,
    data: {
      stats: generalStats,
      puzzleItems: puzzleItems
    }
  });
});

// ===== RUTAS ORIGINALES =====
// Nota: estas rutas no se llamarán porque las mockup están definidas arriba
const companyRoutes = require('./routes/company.routes');
const userRoutes = require('./routes/user.routes');
const logRoutes = require('./routes/log.routes');

// Añadir rutas de autenticación
const authRoutes = require('./routes/auth.routes');

app.use('/companies', companyRoutes);
app.use('/users', userRoutes);
app.use('/logs', logRoutes);
app.use('/auth', authRoutes); // Añadida ruta de autenticación

// Ruta básica para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'Servidor de prueba para el Sistema de Gestión de Archivos Excel' });
});

// Mensaje de configuración
console.log('Ejecutando servidor de prueba con datos ficticios para el Explorador de Archivos');

// Controlador de autenticación simulado
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Verificación simple para propósitos de prueba
  if (email && password) {
    res.status(200).json({
      success: true,
      data: {
        token: 'test-token-12345',
        refreshToken: 'test-refresh-token-12345',
        user: {
          id: 'test-user-id',
          name: 'Usuario de Prueba',
          email: email,
          role: 'user',
          companyId: 'test-company-id'
        }
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas'
      }
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de prueba corriendo en el puerto ${PORT}`);
});

module.exports = app; 