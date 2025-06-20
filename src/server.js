const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar servicios
require('./services/email.service'); // Inicializar servicio de correo

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const companyRoutes = require('./routes/company.routes');
const userRoutes = require('./routes/user.routes');
const folderRoutes = require('./routes/folder.routes');
const fileRoutes = require('./routes/file.routes');
const fileStatusRoutes = require('./routes/file-status.routes');
const sftpRoutes = require('./routes/sftp.routes');
const logRoutes = require('./routes/log.routes');
const areaRoutes = require('./routes/area.routes');
const subareaRoutes = require('./routes/subarea.routes');
const permissionRoutes = require('./routes/permission.routes');
const roleRoutes = require('./routes/role.routes');
const userRoleRoutes = require('./routes/user-role.routes');
const menuRoutes = require('./routes/menu.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const fileVersionRoutes = require('./routes/file-version.routes');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración para correos electrónicos
if (process.env.NODE_ENV === 'development') {
  console.log('Correo configurado en modo desarrollo (usando Ethereal)');
} else {
  console.log('Correo configurado con:', process.env.SMTP_HOST);
}

// Crear directorio de uploads si no existe
const uploadDir = process.env.UPLOAD_PATH || './uploads';
console.log('Directorio de uploads configurado:', uploadDir);
console.log('Directorio absoluto de uploads:', path.resolve(uploadDir));

if (!fs.existsSync(uploadDir)) {
  console.log('El directorio de uploads no existe, creándolo...');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Directorio de uploads creado con éxito');
  } catch (err) {
    console.error('Error al crear directorio de uploads:', err);
  }
} else {
  console.log('El directorio de uploads ya existe');
  
  // Verificar permisos
  try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
    console.log('El directorio de uploads tiene permisos de escritura');
  } catch (err) {
    console.error('El directorio de uploads no tiene permisos de escritura:', err);
  }
}

// Directorio estático para archivos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/files', fileVersionRoutes);
app.use('/api/file-status', fileStatusRoutes);
app.use('/api/sftp', sftpRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/subareas', subareaRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api', dashboardRoutes);

// Ruta básica para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API del Sistema de Gestión de Archivos Excel' });
});

// Middleware para capturar rutas no encontradas (404)
app.use((req, res, next) => {
  console.error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  console.error(`Parámetros: ${JSON.stringify(req.params)}`);
  console.error(`Query: ${JSON.stringify(req.query)}`);
  console.error(`Body: ${JSON.stringify(req.body)}`);
  console.error(`Headers: ${JSON.stringify(req.headers)}`);
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'La ruta solicitada no existe',
      details: `No se pudo encontrar ${req.originalUrl}`
    }
  });
});

// Middleware para manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  console.error('Stack trace:', err.stack);
  console.error(`En ruta: ${req.method} ${req.originalUrl}`);
  
  // Determinar el código de estado HTTP apropiado
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: err.message || 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Conectado a MongoDB');
  // Iniciar el servidor después de conectar a la base de datos
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
})
.catch(err => {
  console.error('Error al conectar a MongoDB:', err.message);
  process.exit(1);
});

// Manejar errores de conexión después de la conexión inicial
mongoose.connection.on('error', err => {
  console.error('Error de conexión a MongoDB:', err.message);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Error no capturado:', err);
});

module.exports = app; 