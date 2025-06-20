const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');

const Company = require('../models/Company');
const Folder = require('../models/Folder');
const File = require('../models/File');
const SftpSyncJob = require('../models/SftpSyncJob');
const Log = require('../models/Log');

// Función para procesar un archivo Excel y extraer metadatos
const processExcelFile = async (filePath) => {
  console.log('=== INICIO PROCESAMIENTO DE ARCHIVO EXCEL ===');
  console.log('Ruta del archivo a procesar:', filePath);
  
  try {
    console.log('Verificando si el archivo existe...');
    if (!fs.existsSync(filePath)) {
      console.error('ERROR: El archivo no existe en la ruta especificada');
      throw new Error('El archivo no existe en la ruta: ' + filePath);
    }

    const fileStats = fs.statSync(filePath);
    console.log('Tamaño del archivo:', fileStats.size, 'bytes');
    console.log('Modo de archivo:', fileStats.mode);
    console.log('Permisos de archivo:', (fileStats.mode & parseInt('777', 8)).toString(8));
    console.log('Propietario/UID:', fileStats.uid);
    console.log('Fecha de creación:', fileStats.birthtime);
    console.log('Fecha de modificación:', fileStats.mtime);
    
    // Verificar que el archivo es legible
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log('El archivo tiene permisos de lectura');
    } catch (accessError) {
      console.error('ERROR: El archivo no tiene permisos de lectura');
      throw new Error('El archivo no tiene permisos de lectura: ' + accessError.message);
    }
    
    // Verificar los primeros bytes del archivo para confirmar que es un Excel
    try {
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
      
      const hex = buffer.toString('hex');
      console.log('Primeros 8 bytes del archivo (hex):', hex);
      
      // Verificar signatures de archivos Excel
      // XLSX: 50 4B 03 04 (PK..)
      // XLS: D0 CF 11 E0 A1 B1 1A E1
      const isXLSX = hex.startsWith('504b0304');
      const isXLS = hex.startsWith('d0cf11e0');
      
      if (!isXLSX && !isXLS) {
        console.warn('ADVERTENCIA: El archivo no parece tener la firma de un archivo Excel estándar');
      } else {
        console.log('Firma de archivo Excel válida:', isXLSX ? 'XLSX' : 'XLS');
      }
    } catch (hexError) {
      console.warn('No se pudo leer los primeros bytes del archivo:', hexError.message);
    }
    
    console.log('Creando instancia de ExcelJS Workbook...');
    
    const workbook = new ExcelJS.Workbook();
    console.log('Leyendo archivo Excel...');
    
    try {
      await workbook.xlsx.readFile(filePath);
      console.log('Archivo Excel leído correctamente');
    } catch (readError) {
      console.error('ERROR leyendo archivo Excel:', readError);
      console.error('Detalles del error:', readError.message);
      console.error('Stack trace del error:', readError.stack);
      
      // Intentar determinar el tipo de error
      const errorMsg = readError.message.toLowerCase();
      if (errorMsg.includes('invalid') && errorMsg.includes('format')) {
        console.error('El archivo parece tener un formato inválido o estar corrupto');
      } else if (errorMsg.includes('password') || errorMsg.includes('protected')) {
        console.error('El archivo parece estar protegido con contraseña');
      }
      
      throw new Error('Error al leer el archivo Excel: ' + readError.message);
    }
    
    const sheets = [];
    let totalRows = 0;
    let totalColumns = 0;
    
    console.log('Recorriendo hojas del libro...');
    let sheetCount = 0;
    
    workbook.eachSheet((worksheet, sheetId) => {
      sheetCount++;
      console.log(`Procesando hoja ${sheetCount}: "${worksheet.name}"`);
      sheets.push(worksheet.name);
      
      // Calcular número de filas con contenido
      const worksheetRows = worksheet.rowCount || 0;
      console.log(`  - Filas en hoja "${worksheet.name}": ${worksheetRows}`);
      totalRows += worksheetRows;
      
      // Determinar el número máximo de columnas
      const worksheetColumns = worksheet.columnCount || 0;
      console.log(`  - Columnas en hoja "${worksheet.name}": ${worksheetColumns}`);
      if (worksheetColumns > totalColumns) {
        totalColumns = worksheetColumns;
      }
      
      // Inspeccionar algunas celdas para verificar contenido
      try {
        if (worksheetRows > 0 && worksheetColumns > 0) {
          const sampleCell = worksheet.getCell(1, 1);
          console.log(`  - Muestra de contenido (A1): ${sampleCell.value}`);
        }
      } catch (cellError) {
        console.warn(`  - No se pudo leer celda de muestra: ${cellError.message}`);
      }
    });
    
    console.log(`Total de hojas procesadas: ${sheetCount}`);
    console.log(`Total de filas: ${totalRows}, Máximo de columnas: ${totalColumns}`);
    
    const metadata = {
      sheets,
      rowCount: totalRows,
      columnCount: totalColumns,
      fileSize: fileStats.size,
      lastModified: fileStats.mtime
    };
    
    console.log('Metadatos extraídos:', metadata);
    console.log('=== FIN PROCESAMIENTO DE ARCHIVO EXCEL ===');
    
    return metadata;
  } catch (error) {
    console.error('ERROR al procesar archivo Excel:', error);
    console.error('Stack trace:', error.stack);
    console.log('=== FIN PROCESAMIENTO DE ARCHIVO EXCEL CON ERROR ===');
    
    return {
      sheets: [],
      rowCount: 0,
      columnCount: 0,
      error: error.message
    };
  }
};

// Exportamos la función para poder usarla en otros módulos
exports.processExcelFile = processExcelFile;

// Función para sincronizar archivos SFTP
exports.syncSftpFiles = async (companyId, userId) => {
  const sftp = new Client();
  
  // Crear registro de trabajo
  const syncJob = await SftpSyncJob.create({
    companyId,
    status: 'in_progress',
    type: 'manual',
    startedAt: new Date()
  });
  
  try {
    // Obtener configuración SFTP de la empresa
    const company = await Company.findById(companyId);
    
    if (!company) {
      throw new Error('Empresa no encontrada');
    }
    
    const sftpConfig = company.sftp;
    
    if (!sftpConfig || !sftpConfig.enabled) {
      throw new Error('Configuración SFTP no habilitada');
    }
    
    // Conectar al servidor SFTP
    await sftp.connect({
      host: sftpConfig.host,
      port: sftpConfig.port || 22,
      username: sftpConfig.username,
      password: sftpConfig.password, // En producción, debe estar encriptado y desencriptarse aquí
    });
    
    // Listar archivos en el directorio remoto
    const remoteDir = sftpConfig.rootDirectory || '/';
    const fileList = await sftp.list(remoteDir);
    
    // Filtrar por patrón si está definido
    const filePattern = sftpConfig.filePattern || "*.xlsx";
    const pattern = new RegExp(filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
    
    const excelFiles = fileList.filter(file => 
      file.type === '-' && pattern.test(file.name)
    );
    
    // Registros para el reporte
    const results = {
      filesAdded: 0,
      filesUpdated: 0,
      filesFailed: 0,
      totalSizeProcessed: 0,
      errors: []
    };
    
    // Buscar la carpeta destino
    let targetFolder;
    if (sftpConfig.targetFolder) {
      targetFolder = await Folder.findById(sftpConfig.targetFolder);
    } else {
      // Crear carpeta SFTP en la raíz si no existe
      const rootFolders = await Folder.find({ 
        companyId, 
        parentId: null, 
        name: 'SFTP' 
      });
      
      if (rootFolders.length > 0) {
        targetFolder = rootFolders[0];
      } else {
        targetFolder = await Folder.create({
          name: 'SFTP',
          parentId: null,
          path: '/SFTP',
          companyId,
          createdBy: userId
        });
      }
    }
    
    // Procesar cada archivo Excel
    for (const file of excelFiles) {
      try {
        // Crear un directorio temporal si no existe
        const tempDir = path.join(os.tmpdir(), 'excel-sftp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Ruta temporal para el archivo
        const tempFilePath = path.join(tempDir, file.name);
        
        // Descargar el archivo
        await sftp.get(`${remoteDir}${file.name}`, tempFilePath);
        
        // Analizar el archivo Excel para obtener metadatos
        const metadata = await processExcelFile(tempFilePath);
        
        // Determinar el directorio de destino final
        const uploadDir = process.env.UPLOAD_PATH || './uploads';
        const companyDir = path.join(uploadDir, companyId.toString());
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }
        
        // Generar un nombre único para el archivo
        const timestamp = Date.now();
        const extension = path.extname(file.name);
        const basename = path.basename(file.name, extension);
        const uniqueFilename = `${basename}_${timestamp}${extension}`;
        const storageLocation = path.join(companyDir, uniqueFilename);
        
        // Mover el archivo a su ubicación final
        fs.copyFileSync(tempFilePath, storageLocation);
        
        // Verificar si el archivo ya existe en la base de datos
        const existingFile = await File.findOne({
          name: file.name,
          folderId: targetFolder._id
        });
        
        if (existingFile) {
          // Actualizar el archivo existente
          existingFile.size = file.size;
          existingFile.version += 1;
          existingFile.metadata = metadata;
          existingFile.storageLocation = storageLocation;
          existingFile.uploadedBy = userId;
          existingFile.uploadType = 'sftp';
          await existingFile.save();
          
          results.filesUpdated++;
        } else {
          // Crear un nuevo registro de archivo
          await File.create({
            name: file.name,
            originalName: file.name,
            description: `Archivo cargado vía SFTP desde ${sftpConfig.host}`,
            folderId: targetFolder._id,
            companyId,
            size: file.size,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            extension,
            storageLocation,
            uploadedBy: userId,
            uploadType: 'sftp',
            metadata
          });
          
          results.filesAdded++;
        }
        
        results.totalSizeProcessed += file.size;
        
        // Eliminar archivo original si está configurado
        if (sftpConfig.deleteAfterSync) {
          await sftp.delete(`${remoteDir}${file.name}`);
        }
        
        // Eliminar archivo temporal
        fs.unlinkSync(tempFilePath);
        
      } catch (fileError) {
        console.error(`Error procesando archivo ${file.name}:`, fileError);
        results.filesFailed++;
        results.errors.push({
          file: file.name,
          error: fileError.message
        });
      }
    }
    
    // Actualizar el trabajo con los resultados
    await SftpSyncJob.findByIdAndUpdate(syncJob._id, {
      status: 'completed',
      completedAt: new Date(),
      results
    });
    
    // Registrar log de actividad
    await Log.create({
      userId,
      companyId,
      action: 'sftp_sync',
      entityType: 'company',
      entityId: companyId,
      details: {
        jobId: syncJob._id,
        results
      }
    });
    
    return {
      success: true,
      jobId: syncJob._id,
      results
    };
    
  } catch (error) {
    console.error('Error en sincronización SFTP:', error);
    
    // Actualizar el trabajo con el error
    await SftpSyncJob.findByIdAndUpdate(syncJob._id, {
      status: 'failed',
      completedAt: new Date(),
      errors: [{
        file: 'general',
        error: error.message
      }]
    });
    
    // Registrar log de error
    await Log.create({
      userId,
      companyId,
      action: 'sftp_error',
      entityType: 'company',
      entityId: companyId,
      details: {
        jobId: syncJob._id,
        error: error.message
      }
    });
    
    throw error;
  } finally {
    // Cerrar conexión SFTP
    await sftp.end();
  }
};

// Función para probar la conexión SFTP
exports.testSftpConnection = async (config) => {
  const sftp = new Client();
  
  try {
    await sftp.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password
    });
    
    // Intentar listar el directorio raíz o el especificado
    const rootDir = config.rootDirectory || '/';
    await sftp.list(rootDir);
    
    return { success: true };
  } catch (error) {
    console.error('Error en prueba de conexión SFTP:', error);
    return { 
      success: false, 
      error: error.message
    };
  } finally {
    await sftp.end();
  }
}; 