const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Servicio para subir archivos a un servidor remoto SFTP
 */
class RemoteStorageService {
  constructor() {
    this.sftp = new Client();
    this.connected = false;
    this.config = null;
    this.userHomeDirectory = null; // Directorio home del usuario SFTP
  }

  /**
   * Conectar al servidor SFTP
   */
  async connect(config) {
    if (this.connected && this.config && 
        this.config.host === config.host && 
        this.config.port === config.port) {
      return;
    }

    // Si ya hay una conexión diferente, cerrarla primero
    if (this.connected) {
      await this.disconnect();
    }

    this.config = config;

    try {
      await this.sftp.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        // Opciones adicionales para mejor rendimiento
        readyTimeout: 20000,
        retries: 2,
        retry_factor: 2
      });
      this.connected = true;
      console.log(`✅ Conectado al servidor SFTP remoto: ${config.host}:${config.port || 22}`);
      
      // Detectar el directorio home del usuario SFTP
      try {
        // Intentar obtener el directorio actual (que suele ser el home del usuario)
        const pwd = await this.sftp.realPath('.');
        this.userHomeDirectory = pwd;
        console.log(`📁 Directorio home del usuario SFTP detectado: ${this.userHomeDirectory}`);
      } catch (error) {
        console.warn(`⚠️  No se pudo detectar el directorio home del usuario:`, error.message);
        // Intentar con rutas comunes
        const commonHomes = [`/home/${config.username}`, '/home/fits'];
        for (const home of commonHomes) {
          try {
            await this.sftp.stat(home);
            this.userHomeDirectory = home;
            console.log(`📁 Usando directorio home: ${this.userHomeDirectory}`);
            break;
          } catch (e) {
            // Continuar con el siguiente
          }
        }
      }
      
      // NO intentar crear el directorio raíz al conectar - puede no tener permisos
      // Los directorios se crearán automáticamente cuando se suban archivos
      if (config.rootDirectory) {
        console.log(`📁 Directorio raíz configurado: ${config.rootDirectory} (se creará automáticamente al subir archivos)`);
      }
    } catch (error) {
      console.error('❌ Error conectando al servidor SFTP:', error);
      throw new Error(`No se pudo conectar al servidor SFTP: ${error.message}`);
    }
  }

  /**
   * Desconectar del servidor SFTP
   */
  async disconnect() {
    if (this.connected) {
      try {
        await this.sftp.end();
        this.connected = false;
        console.log('🔌 Desconectado del servidor SFTP remoto');
      } catch (error) {
        console.error('Error al desconectar del servidor SFTP:', error);
      }
    }
  }

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Subir un archivo al servidor remoto
   * @param {string} localFilePath - Ruta local del archivo
   * @param {string} remotePath - Ruta remota donde guardar (ej: /uploads/companyId/filename.xlsx)
   * @returns {string} - Ruta remota completa del archivo
   */
  async uploadFile(localFilePath, remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta remota para usar separadores Unix (el servidor SFTP es Linux)
      // Reemplazar backslashes de Windows con forward slashes
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es una ruta absoluta del sistema,
      // construirla desde el directorio home del usuario
      if (remotePath.startsWith('/') && this.userHomeDirectory) {
        // Si la ruta es /lek-files o similar, construirla desde el home
        // Ejemplo: /lek-files/can/... -> /home/fits/lek-files/can/...
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          // Es una ruta relativa desde la raíz del usuario
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
          console.log(`📁 Ruta ajustada desde home del usuario: ${remotePath}`);
        }
      } else if (!remotePath.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }
      
      // Asegurar que el directorio remoto existe
      // Usar separadores Unix para el directorio remoto
      let remoteDir = remotePath.split('/').slice(0, -1).join('/') || '/';
      if (remoteDir === '/') {
        remoteDir = this.userHomeDirectory || '/';
      }
      // ensureRemoteDirectory ya ajusta la ruta desde userHomeDirectory si es necesario
      // pero aquí remoteDir ya está ajustado, así que no necesitamos ajustarlo de nuevo
      console.log(`📁 Asegurando que existe el directorio: ${remoteDir}`);
      await this.ensureRemoteDirectory(remoteDir);

      console.log(`📤 Intentando subir archivo:`);
      console.log(`   Local: ${localFilePath}`);
      console.log(`   Remoto: ${remotePath}`);
      
      // Subir el archivo
      await this.sftp.put(localFilePath, remotePath);
      console.log(`✅ Archivo subido exitosamente a: ${remotePath}`);

      return remotePath;
    } catch (error) {
      console.error('❌ Error subiendo archivo al servidor remoto:', error);
      console.error('   Ruta local:', localFilePath);
      console.error('   Ruta remota:', remotePath);
      console.error('   Stack:', error.stack);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  /**
   * Subir un buffer directamente al servidor remoto
   * @param {Buffer} buffer - Buffer del archivo
   * @param {string} remotePath - Ruta remota donde guardar
   * @returns {string} - Ruta remota completa del archivo
   */
  async uploadBuffer(buffer, remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta remota igual que en uploadFile
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es una ruta absoluta del sistema,
      // construirla desde el directorio home del usuario
      if (remotePath.startsWith('/') && this.userHomeDirectory) {
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
          console.log(`📁 Ruta ajustada desde home del usuario: ${remotePath}`);
        }
      } else if (!remotePath.startsWith('/')) {
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }
      
      // Asegurar que el directorio remoto existe
      let remoteDir = remotePath.split('/').slice(0, -1).join('/') || '/';
      if (remoteDir === '/') {
        remoteDir = this.userHomeDirectory || '/';
      }
      await this.ensureRemoteDirectory(remoteDir);

      // Crear un archivo temporal
      const tempDir = path.join(os.tmpdir(), 'remote-upload');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      
      // Escribir buffer a archivo temporal
      fs.writeFileSync(tempFilePath, buffer);

      try {
        // Subir el archivo
        await this.sftp.put(tempFilePath, remotePath);
        console.log(`📤 Archivo (buffer) subido exitosamente a: ${remotePath}`);
        return remotePath;
      } finally {
        // Eliminar archivo temporal
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error) {
      console.error('❌ Error subiendo buffer al servidor remoto:', error);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  /**
   * Asegurar que un directorio remoto existe (crea recursivamente si es necesario)
   */
  async ensureRemoteDirectory(remoteDir) {
    try {
      // Normalizar la ruta remota para usar separadores Unix
      remoteDir = remoteDir.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es /home, construirla desde el home del usuario
      if (remoteDir.startsWith('/') && this.userHomeDirectory) {
        const pathParts = remoteDir.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remoteDir = `${this.userHomeDirectory}/${pathParts.join('/')}`;
        }
      } else if (!remoteDir.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remoteDir = `${this.userHomeDirectory}/${remoteDir}`;
        } else {
          remoteDir = '/' + remoteDir;
        }
      }
      
      // Verificar primero si el directorio ya existe
      try {
        const stats = await this.sftp.stat(remoteDir);
        if (stats.isDirectory) {
          // El directorio ya existe, verificar permisos intentando listar
          try {
            await this.sftp.list(remoteDir);
            console.log(`✅ Directorio remoto existe y tiene permisos: ${remoteDir}`);
            return;
          } catch (listError) {
            console.warn(`⚠️  Directorio ${remoteDir} existe pero puede no tener permisos de lectura:`, listError.message);
            // Continuar e intentar crear subdirectorios
          }
        } else {
          throw new Error(`${remoteDir} existe pero no es un directorio`);
        }
      } catch (statError) {
        // El directorio no existe, continuar para crearlo
        console.log(`📁 Directorio remoto no existe, creando: ${remoteDir}`);
      }

      // Intentar crear el directorio recursivamente
      // El segundo parámetro true indica creación recursiva
      try {
        await this.sftp.mkdir(remoteDir, true);
        console.log(`✅ Directorio remoto creado recursivamente: ${remoteDir}`);
      } catch (mkdirError) {
        console.log(`⚠️  No se pudo crear recursivamente, intentando uno por uno: ${remoteDir}`);
        throw mkdirError; // Lanzar para que se intente el método alternativo
      }
    } catch (error) {
      // Si el error indica que el directorio ya existe, está bien
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('already exists') || 
          errorMsg.includes('file exists') || 
          errorMsg.includes('file already exists')) {
        // El directorio ya existe, no hay problema
        return;
      }

      // Si es otro tipo de error, intentar crear los directorios uno por uno
      // Esto es útil si el servidor SFTP no soporta creación recursiva
      // O si no tiene permisos para crear el directorio raíz
      try {
        const parts = remoteDir.split('/').filter(p => p !== '' && p !== '.');
        let currentPath = '';
        let lastSuccessfulPath = '';
        
        console.log(`📁 Creando directorios uno por uno: ${parts.join(' -> ')}`);
        
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
          
          try {
            // Intentar crear el directorio
            await this.sftp.mkdir(currentPath, false);
            console.log(`✅ Directorio remoto creado: ${currentPath}`);
            lastSuccessfulPath = currentPath;
          } catch (mkdirError) {
            // Verificar si el directorio ya existe
            try {
              const stats = await this.sftp.stat(currentPath);
              if (stats.isDirectory) {
                // Verificar permisos intentando listar
                try {
                  await this.sftp.list(currentPath);
                  console.log(`✅ Directorio remoto ya existe y tiene permisos: ${currentPath}`);
                } catch (listError) {
                  console.warn(`⚠️  Directorio ${currentPath} existe pero puede tener problemas de permisos:`, listError.message);
                }
                lastSuccessfulPath = currentPath;
                // El directorio existe, continuar
              } else {
                throw new Error(`${currentPath} existe pero no es un directorio`);
              }
            } catch (statError) {
              // Si es un error de permisos
              const isPermissionError = mkdirError.message.toLowerCase().includes('permission denied') ||
                                       mkdirError.message.toLowerCase().includes('permission');
              
              if (isPermissionError) {
                console.warn(`⚠️  Error de permisos creando ${currentPath}:`, mkdirError.message);
                
                // Si ya tenemos un path exitoso, continuar
                if (lastSuccessfulPath) {
                  console.warn(`⚠️  Continuando desde ${lastSuccessfulPath} - el directorio ${currentPath} puede existir o necesitar permisos`);
                  // Continuar con el siguiente directorio
                  continue;
                } else {
                  // Si es el primer directorio y falla por permisos, puede que el directorio ya exista
                  // Intentar verificar si podemos acceder al path completo de otra manera
                  console.warn(`⚠️  No se pudo crear ${currentPath} pero continuaremos - puede que ya exista`);
                  // Continuar de todas formas
                  continue;
                }
              } else {
                // Si no es error de permisos, lanzar el error
                console.error(`❌ Error creando directorio ${currentPath}:`, mkdirError.message);
                throw error;
              }
            }
          }
        }
        
        // Si llegamos aquí, al menos algunos directorios se crearon o ya existían
        console.log(`✅ Proceso de creación de directorios completado para: ${remoteDir}`);
      } catch (fallbackError) {
        // Si todo falla, verificar si el error es de permisos
        const isPermissionError = error.message.toLowerCase().includes('permission denied') ||
                                 error.message.toLowerCase().includes('permission');
        
        if (isPermissionError) {
          console.warn(`⚠️  Error de permisos creando directorio ${remoteDir}`);
          console.warn(`⚠️  El directorio puede existir o necesitar permisos. Continuando...`);
          // No lanzar error - intentar subir el archivo de todas formas
          return;
        }
        
        // Si es otro tipo de error, lanzarlo
        console.error(`❌ Error creando directorio remoto ${remoteDir}:`, error.message);
        throw new Error(`No se pudo crear el directorio remoto ${remoteDir}: ${error.message}`);
      }
    }
  }

  /**
   * Eliminar un archivo del servidor remoto
   */
  async deleteFile(remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      await this.sftp.delete(remotePath);
      console.log(`🗑️  Archivo eliminado del servidor remoto: ${remotePath}`);
    } catch (error) {
      console.error('❌ Error eliminando archivo del servidor remoto:', error);
      throw new Error(`Error al eliminar archivo: ${error.message}`);
    }
  }

  /**
   * Descargar un archivo del servidor remoto
   */
  async downloadFile(remotePath, localPath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta remota
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es /home, construirla desde el home del usuario
      if (remotePath.startsWith('/') && this.userHomeDirectory) {
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
          console.log(`📁 Ruta de descarga ajustada desde home del usuario: ${remotePath}`);
        }
      } else if (!remotePath.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }
      
      // Asegurar que el directorio local existe
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      await this.sftp.get(remotePath, localPath);
      console.log(`📥 Archivo descargado exitosamente desde: ${remotePath}`);
      return localPath;
    } catch (error) {
      console.error('❌ Error descargando archivo del servidor remoto:', error);
      console.error('   Ruta remota intentada:', remotePath);
      throw new Error(`Error al descargar archivo: ${error.message}`);
    }
  }

  /**
   * Descargar un archivo del servidor remoto como buffer
   */
  async downloadFileAsBuffer(remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta remota
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es /home, construirla desde el home del usuario
      if (remotePath.startsWith('/') && this.userHomeDirectory) {
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
          console.log(`📁 Ruta de descarga (buffer) ajustada desde home del usuario: ${remotePath}`);
        }
      } else if (!remotePath.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }
      
      const buffer = await this.sftp.get(remotePath);
      console.log(`📥 Archivo descargado como buffer desde: ${remotePath}`);
      return buffer;
    } catch (error) {
      console.error('❌ Error descargando archivo como buffer del servidor remoto:', error);
      console.error('   Ruta remota intentada:', remotePath);
      throw new Error(`Error al descargar archivo: ${error.message}`);
    }
  }

  /**
   * Verificar si un archivo existe en el servidor remoto
   */
  async fileExists(remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta remota
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si la ruta empieza con / pero no es /home, construirla desde el home del usuario
      if (remotePath.startsWith('/') && this.userHomeDirectory) {
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
        }
      } else if (!remotePath.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }
      
      await this.sftp.stat(remotePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Listar contenido de un directorio remoto
   */
  async listDirectory(remotePath = '/') {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta
      remotePath = remotePath.replace(/\\/g, '/');
      
      // Si es la raíz, usar el directorio home del usuario
      if (remotePath === '/') {
        remotePath = this.userHomeDirectory || '/';
      } else if (remotePath.startsWith('/') && this.userHomeDirectory) {
        // Si la ruta empieza con / pero no es /home, construirla desde el home
        const pathParts = remotePath.split('/').filter(p => p);
        if (pathParts.length > 0 && pathParts[0] !== 'home') {
          remotePath = `${this.userHomeDirectory}/${pathParts.join('/')}`;
        }
      } else if (!remotePath.startsWith('/')) {
        // Ruta relativa, construir desde el home
        if (this.userHomeDirectory) {
          remotePath = `${this.userHomeDirectory}/${remotePath}`;
        } else {
          remotePath = '/' + remotePath;
        }
      }

      const files = await this.sftp.list(remotePath);
      
      // Construir rutas relativas para mostrar en el explorador
      const basePath = remotePath;
      
      return files.map(file => ({
        name: file.name,
        type: file.type === 'd' ? 'directory' : 'file',
        size: file.size || 0,
        modified: file.modifyTime || null,
        permissions: file.permissions || null,
        path: basePath === '/' || basePath === this.userHomeDirectory 
          ? `/${file.name}` 
          : `${basePath}/${file.name}`
      }));
    } catch (error) {
      console.error(`❌ Error listando directorio ${remotePath}:`, error);
      throw new Error(`Error al listar directorio: ${error.message}`);
    }
  }

  /**
   * Obtener información de un archivo o directorio remoto
   */
  async getFileInfo(remotePath) {
    if (!this.connected) {
      throw new Error('No hay conexión al servidor SFTP');
    }

    try {
      // Normalizar la ruta
      remotePath = remotePath.replace(/\\/g, '/');
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }

      const stats = await this.sftp.stat(remotePath);
      return {
        path: remotePath,
        type: stats.isDirectory ? 'directory' : 'file',
        size: stats.size || 0,
        modified: stats.modifyTime || null,
        permissions: stats.permissions || null
      };
    } catch (error) {
      throw new Error(`Error al obtener información: ${error.message}`);
    }
  }
}

// Instancia singleton
let storageService = null;

/**
 * Obtener instancia del servicio de almacenamiento remoto
 */
function getRemoteStorageService() {
  if (!storageService) {
    storageService = new RemoteStorageService();
  }
  return storageService;
}

/**
 * Obtener configuración del almacenamiento remoto
 */
function getRemoteStorageConfig() {
  return {
    host: process.env.REMOTE_STORAGE_HOST,
    port: parseInt(process.env.REMOTE_STORAGE_PORT || '22'),
    username: process.env.REMOTE_STORAGE_USERNAME,
    password: process.env.REMOTE_STORAGE_PASSWORD,
    rootDirectory: process.env.REMOTE_STORAGE_ROOT_DIR || '/uploads'
  };
}

/**
 * Inicializar conexión al servidor remoto
 */
async function initializeRemoteStorage() {
  const config = getRemoteStorageConfig();

  if (!config.host || !config.username || !config.password) {
    console.warn('⚠️  Configuración de almacenamiento remoto no completa. Los archivos se guardarán localmente.');
    return null;
  }

  try {
    const service = getRemoteStorageService();
    await service.connect(config);
    return service;
  } catch (error) {
    console.error('❌ Error inicializando almacenamiento remoto:', error);
    console.error('⚠️  Los archivos se guardarán localmente como fallback.');
    return null;
  }
}

/**
 * Intentar reconectar al servidor remoto si no está conectado
 */
async function ensureRemoteStorageConnection() {
  const service = getRemoteStorageService();
  
  // Si ya está conectado, no hacer nada
  if (service.isConnected()) {
    return service;
  }

  const config = getRemoteStorageConfig();
  
  if (!config.host || !config.username || !config.password) {
    return null;
  }

  try {
    console.log('🔄 Intentando reconectar al servidor remoto SFTP...');
    await service.connect(config);
    console.log('✅ Reconectado al servidor remoto SFTP exitosamente');
    return service;
  } catch (error) {
    console.warn('⚠️  No se pudo reconectar al servidor remoto:', error.message);
    return null;
  }
}

module.exports = {
  getRemoteStorageService,
  initializeRemoteStorage,
  ensureRemoteStorageConnection,
  RemoteStorageService
};

