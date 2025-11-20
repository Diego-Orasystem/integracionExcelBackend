const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  uploadFile, 
  listFiles, 
  getFile, 
  downloadFile, 
  deleteFile, 
  searchFiles,
  getFilesByMimeType,
  getFileMetricsData,
  getAreaFileStatsData,
  createTestVersion,
  diagnoseFiles
} = require('../controllers/file.controller');
const { protect } = require('../middlewares/auth.middleware');
const { getRemoteStorageService } = require('../services/remote-storage.service');

const router = express.Router();

// Ruta pública de diagnóstico (sin autenticación)
router.get('/diagnose', diagnoseFiles);

// Ruta pública para explorar el servidor SFTP (sin autenticación)
router.get('/sftp-explorer', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Explorador SFTP</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .status {
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-badge.connected { background: #28a745; color: white; }
        .status-badge.disconnected { background: #dc3545; color: white; }
        .breadcrumb {
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .breadcrumb a {
            color: #667eea;
            text-decoration: none;
            cursor: pointer;
        }
        .breadcrumb a:hover { text-decoration: underline; }
        .content {
            padding: 20px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }
        tr:hover { background: #f8f9fa; }
        .icon {
            margin-right: 8px;
            font-size: 16px;
        }
        .directory { color: #667eea; cursor: pointer; }
        .directory:hover { text-decoration: underline; }
        .file { color: #495057; }
        .size {
            color: #6c757d;
            font-size: 12px;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover { background: #5568d3; }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover { background: #5a6268; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Explorador SFTP</h1>
            <p>Navega por el servidor remoto</p>
        </div>
        <div class="status">
            <div>
                <span>Estado: </span>
                <span id="status" class="status-badge disconnected">Verificando...</span>
            </div>
            <div>
                <span>Servidor: </span>
                <span id="server-info">-</span>
            </div>
        </div>
        <div class="breadcrumb" id="breadcrumb">
            <a onclick="navigateTo('/')">🏠 Inicio</a>
        </div>
        <div class="content">
            <div id="loading" class="loading">Cargando...</div>
            <div id="error" style="display:none;"></div>
            <div id="content" style="display:none;">
                <table>
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Nombre</th>
                            <th>Tamaño</th>
                            <th>Modificado</th>
                            <th>Permisos</th>
                        </tr>
                    </thead>
                    <tbody id="files-list"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let currentPath = '/';
        
        async function checkConnection() {
            try {
                const response = await fetch('/api/files/sftp-status');
                const data = await response.json();
                
                const statusEl = document.getElementById('status');
                const serverEl = document.getElementById('server-info');
                
                if (data.success && data.connected) {
                    statusEl.textContent = 'Conectado';
                    statusEl.className = 'status-badge connected';
                    serverEl.textContent = data.host || 'SFTP';
                } else {
                    statusEl.textContent = 'Desconectado';
                    statusEl.className = 'status-badge disconnected';
                    serverEl.textContent = '-';
                }
            } catch (error) {
                console.error('Error verificando conexión:', error);
            }
        }
        
        async function loadDirectory(path) {
            currentPath = path || '/';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('content').style.display = 'none';
            document.getElementById('error').style.display = 'none';
            
            try {
                const response = await fetch(\`/api/files/sftp-list?path=\${encodeURIComponent(currentPath)}\`);
                const data = await response.json();
                
                if (data.success) {
                    displayFiles(data.files, currentPath);
                    updateBreadcrumb(currentPath);
                } else {
                    showError(data.error || 'Error al cargar directorio');
                }
            } catch (error) {
                showError('Error de conexión: ' + error.message);
            } finally {
                document.getElementById('loading').style.display = 'none';
            }
        }
        
        function displayFiles(files, path) {
            const tbody = document.getElementById('files-list');
            tbody.innerHTML = '';
            
            if (files.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6c757d;">Directorio vacío</td></tr>';
            } else {
                files.forEach(file => {
                    const tr = document.createElement('tr');
                    const icon = file.type === 'directory' ? '📁' : '📄';
                    const size = file.type === 'directory' ? '-' : formatSize(file.size);
                    const modified = file.modified ? new Date(file.modified * 1000).toLocaleString() : '-';
                    
                    tr.innerHTML = \`
                        <td>\${icon}</td>
                        <td>
                            \${file.type === 'directory' 
                                ? \`<span class="directory" onclick="navigateTo('\${file.path}')">\${file.name}</span>\`
                                : \`<span class="file">\${file.name}</span>\`
                            }
                        </td>
                        <td class="size">\${size}</td>
                        <td class="size">\${modified}</td>
                        <td class="size">\${file.permissions || '-'}</td>
                    \`;
                    tbody.appendChild(tr);
                });
            }
            
            document.getElementById('content').style.display = 'block';
        }
        
        function updateBreadcrumb(path) {
            const breadcrumb = document.getElementById('breadcrumb');
            const parts = path.split('/').filter(p => p);
            
            let html = '<a onclick="navigateTo(\'/\')">🏠 Inicio</a>';
            let current = '';
            
            parts.forEach(part => {
                current += '/' + part;
                html += \` / <a onclick="navigateTo('\${current}')">\${part}</a>\`;
            });
            
            breadcrumb.innerHTML = html;
        }
        
        function navigateTo(path) {
            loadDirectory(path);
        }
        
        function formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }
        
        function showError(message) {
            const errorEl = document.getElementById('error');
            errorEl.style.display = 'block';
            errorEl.className = 'error';
            errorEl.textContent = '❌ ' + message;
        }
        
        // Inicializar
        checkConnection();
        loadDirectory('/');
        
        // Actualizar estado cada 30 segundos
        setInterval(checkConnection, 30000);
    </script>
</body>
</html>
  `;
  res.send(html);
});

// Crear una ruta pública para descargar archivos antes de la autenticación
router.get('/:id/download', async (req, res) => {
  try {
    // Importar modelos directamente
    const File = require('../models/File');
    const Log = require('../models/Log');
    const mongoose = require('mongoose');
    
    const file = await File.findOne({
      _id: req.params.id
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
    
    // Determinar si el archivo está en servidor remoto o local
    const remoteStorageService = getRemoteStorageService();
    const remoteRoot = process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads';
    const normalizedStorageLocation = (file.storageLocation || '').replace(/\\/g, '/');
    const isRemotePath = normalizedStorageLocation.startsWith(remoteRoot) ||
      normalizedStorageLocation.includes('/lek-files/');
    
    let filePath = file.storageLocation;
    
    // Si está en servidor remoto, descargarlo temporalmente
    if (remoteStorageService && remoteStorageService.isConnected() && isRemotePath) {
      try {
        const tempDir = path.join(os.tmpdir(), 'file-downloads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, `download_${Date.now()}_${file.originalName || file.name}`);
        await remoteStorageService.downloadFile(file.storageLocation, tempFilePath);
        filePath = tempFilePath;
        console.log('Archivo descargado del servidor remoto a:', tempFilePath);
      } catch (downloadError) {
        console.error('Error descargando del servidor remoto:', downloadError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: 'Error al descargar archivo del servidor remoto'
          }
        });
      }
    } else {
      // Verificar que el archivo existe localmente
      if (!fs.existsSync(file.storageLocation)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'El archivo no existe en el sistema'
          }
        });
      }
    }
    
    // Registrar log de descarga aunque sea anónima
    try {
      await Log.create({
        userId: new mongoose.Types.ObjectId('000000000000000000000000'), // ID genérico para usuario anónimo
        companyId: file.companyId,
        action: 'download_file',
        entityType: 'file',
        entityId: file._id,
        details: {
          fileName: file.name,
          fileSize: file.size,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          message: 'Descarga pública sin autenticación',
          storageType: isRemotePath ? 'remote' : 'local'
        }
      });
    } catch (logError) {
      console.error('Error al registrar log de descarga:', logError);
      // Continuamos con la descarga aunque falle el log
    }
    
    // Enviar archivo
    res.download(filePath, file.originalName || file.name, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
      }
      // Limpiar archivo temporal si se descargó del servidor remoto
      if (filePath !== file.storageLocation && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Archivo temporal eliminado:', filePath);
        } catch (cleanupError) {
          console.error('Error eliminando archivo temporal:', cleanupError);
        }
      }
    });
  } catch (error) {
    console.error('Error en downloadFile público:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al descargar archivo'
      }
    });
  }
});

// Todas las rutas siguientes requieren autenticación
router.use(protect);

// Ruta para verificar la configuración del servidor y directorios
router.get('/check-uploads', (req, res) => {
  try {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const absolutePath = path.resolve(uploadDir);
    
    // Verificar existencia del directorio
    const exists = fs.existsSync(absolutePath);
    
    // Verificar permisos si existe
    let writable = false;
    if (exists) {
      try {
        fs.accessSync(absolutePath, fs.constants.W_OK);
        writable = true;
      } catch (err) {}
    }
    
    // Verificar directorio específico para el usuario
    const companyDir = path.join(absolutePath, req.user.companyId.toString());
    const companyDirExists = fs.existsSync(companyDir);
    
    // Crear directorio de la compañía si no existe
    let companyDirCreated = false;
    if (!companyDirExists) {
      try {
        fs.mkdirSync(companyDir, { recursive: true });
        companyDirCreated = true;
      } catch (err) {}
    }
    
    // Lista de archivos en el directorio de la compañía
    let companyFiles = [];
    if (companyDirExists || companyDirCreated) {
      try {
        companyFiles = fs.readdirSync(companyDir);
      } catch (err) {}
    }
    
    res.json({
      success: true,
      data: {
        uploadDir,
        absolutePath,
        exists,
        writable,
        companyDir,
        companyDirExists: companyDirExists || companyDirCreated,
        companyDirCreated,
        companyFiles,
        user: {
          id: req.user._id,
          companyId: req.user.companyId
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// Rutas de archivos
router.post('/upload', uploadFile);
// Añadir también la misma ruta en la raíz para compatibilidad
router.post('/', uploadFile);
router.get('/', listFiles);
router.get('/search', searchFiles);
router.get('/by-type', getFilesByMimeType);

// Rutas para métricas y estadísticas (deben ir antes de la ruta con parámetro /:id)
router.get('/metrics', getFileMetricsData);
router.get('/area-stats', getAreaFileStatsData);

// Rutas de SFTP (deben ir antes de /:id para evitar conflictos)
router.get('/sftp-status', async (req, res) => {
  try {
    const remoteStorageService = getRemoteStorageService();
    const connected = remoteStorageService && remoteStorageService.isConnected();
    
    res.json({
      success: true,
      connected,
      host: process.env.REMOTE_STORAGE_HOST,
      port: process.env.REMOTE_STORAGE_PORT || 22,
      rootDirectory: process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

router.get('/sftp-list', async (req, res) => {
  try {
    const remoteStorageService = getRemoteStorageService();
    
    if (!remoteStorageService || !remoteStorageService.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Servidor SFTP no conectado'
      });
    }
    
    const path = req.query.path || '/';
    const files = await remoteStorageService.listDirectory(path);
    
    res.json({
      success: true,
      path,
      files
    });
  } catch (error) {
    console.error('Error listando directorio SFTP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta para obtener un archivo específico por ID (debe ir al final)
router.get('/:id', getFile);
// Comentamos la ruta protegida de descarga ya que ahora usamos la pública
// router.get('/:id/download', downloadFile);
router.delete('/:id', deleteFile);

// Añadir la nueva ruta para crear versiones de prueba
router.post('/:id/test-version', createTestVersion);

module.exports = router; 