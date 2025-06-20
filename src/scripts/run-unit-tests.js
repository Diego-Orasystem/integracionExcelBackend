/**
 * Script para ejecutar pruebas unitarias para el MVP
 * Este script verifica la correcta funcionamiento de los controladores de estado de archivos
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
require('dotenv').config();

// Cargar modelos
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const User = require('../models/User');

// Cargar controladores a probar
const fileStatusController = require('../controllers/file-status.controller');

// IDs fijos para las pruebas
const TEST_COMPANY_ID = new mongoose.Types.ObjectId('60d21b4667d0d8992e610c86');
const TEST_USER_ID = new mongoose.Types.ObjectId('60d21b4667d0d8992e610c85');

// Configuración para la conexión de MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB conectado: ${conn.connection.host}`.cyan.underline);
    return conn;
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`.red);
    process.exit(1);
  }
};

// Mock de objetos req y res para pruebas
const createMockReqRes = (query = {}, params = {}, body = {}, user = null) => {
  return {
    req: {
      query,
      params,
      body,
      user: user || { 
        _id: TEST_USER_ID,
        companyId: TEST_COMPANY_ID,
        role: 'admin'
      }
    },
    res: {
      status: function(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      },
      statusCode: null,
      data: null
    }
  };
};

// Función para ejecutar pruebas unitarias
const runUnitTests = async () => {
  console.log('Ejecutando pruebas unitarias para el MVP...'.yellow.bold);
  
  // Array para almacenar resultados de pruebas
  const testResults = [];
  
  // Función de ayuda para registrar resultados
  const logTest = (name, success, message = '', data = null) => {
    testResults.push({
      name,
      success,
      message,
      data,
      timestamp: new Date()
    });
    
    if (success) {
      console.log(`✅ ${name}`.green);
      if (message) console.log(`   ${message}`.gray);
    } else {
      console.log(`❌ ${name}`.red);
      console.log(`   ${message}`.red);
      if (data) console.log(JSON.stringify(data, null, 2));
    }
  };

  try {
    // Conectar a la base de datos
    await connectDB();
    
    // 1. Prueba de getFileStatusData - agrupación por carpeta
    try {
      const { req, res } = createMockReqRes({ groupBy: 'folder' });
      
      await fileStatusController.getFileStatusData(req, res);
      
      const success = 
        res.statusCode === 200 && 
        res.data && 
        res.data.success === true && 
        Array.isArray(res.data.data);
      
      if (success) {
        logTest('getFileStatusData - agrupación por carpeta', true, 
          `Se obtuvieron ${res.data.data.length} grupos de carpetas`);
      } else {
        logTest('getFileStatusData - agrupación por carpeta', false, 
          'La respuesta no tiene la estructura esperada', res.data);
      }
    } catch (error) {
      logTest('getFileStatusData - agrupación por carpeta', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 2. Prueba de getFileStatusData - agrupación por fecha
    try {
      const { req, res } = createMockReqRes({ groupBy: 'date' });
      
      await fileStatusController.getFileStatusData(req, res);
      
      const success = 
        res.statusCode === 200 && 
        res.data && 
        res.data.success === true && 
        Array.isArray(res.data.data);
      
      if (success) {
        logTest('getFileStatusData - agrupación por fecha', true, 
          `Se obtuvieron ${res.data.data.length} grupos de fechas`);
      } else {
        logTest('getFileStatusData - agrupación por fecha', false, 
          'La respuesta no tiene la estructura esperada', res.data);
      }
    } catch (error) {
      logTest('getFileStatusData - agrupación por fecha', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 3. Prueba de getFileStatusData - agrupación por tipo
    try {
      const { req, res } = createMockReqRes({ groupBy: 'type' });
      
      await fileStatusController.getFileStatusData(req, res);
      
      const success = 
        res.statusCode === 200 && 
        res.data && 
        res.data.success === true && 
        Array.isArray(res.data.data);
      
      if (success) {
        logTest('getFileStatusData - agrupación por tipo', true, 
          `Se obtuvieron ${res.data.data.length} grupos de tipos`);
      } else {
        logTest('getFileStatusData - agrupación por tipo', false, 
          'La respuesta no tiene la estructura esperada', res.data);
      }
    } catch (error) {
      logTest('getFileStatusData - agrupación por tipo', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 4. Prueba de getFileMetrics - timeFrame week
    try {
      const { req, res } = createMockReqRes({ timeFrame: 'week' });
      
      await fileStatusController.getFileMetrics(req, res);
      
      const success = 
        res.statusCode === 200 && 
        res.data && 
        res.data.success === true && 
        res.data.data && 
        res.data.data.stats && 
        Array.isArray(res.data.data.puzzleItems);
      
      if (success) {
        logTest('getFileMetrics - timeFrame week', true, 
          `Se obtuvieron ${res.data.data.puzzleItems.length} elementos para el rompecabezas`);
      } else {
        logTest('getFileMetrics - timeFrame week', false, 
          'La respuesta no tiene la estructura esperada', res.data);
      }
    } catch (error) {
      logTest('getFileMetrics - timeFrame week', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 5. Prueba de getFileMetrics - timeFrame month
    try {
      const { req, res } = createMockReqRes({ timeFrame: 'month' });
      
      await fileStatusController.getFileMetrics(req, res);
      
      const success = 
        res.statusCode === 200 && 
        res.data && 
        res.data.success === true && 
        res.data.data && 
        res.data.data.stats && 
        Array.isArray(res.data.data.puzzleItems);
      
      if (success) {
        logTest('getFileMetrics - timeFrame month', true, 
          `Se obtuvieron ${res.data.data.puzzleItems.length} elementos para el rompecabezas`);
      } else {
        logTest('getFileMetrics - timeFrame month', false, 
          'La respuesta no tiene la estructura esperada', res.data);
      }
    } catch (error) {
      logTest('getFileMetrics - timeFrame month', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 6. Prueba de updateFileStatus - cambio a procesando
    try {
      // Obtener un archivo para la prueba
      const files = await File.find().limit(1);
      
      if (files.length === 0) {
        logTest('updateFileStatus - cambio a procesando', false, 
          'No se encontraron archivos para probar');
      } else {
        const file = files[0];
        const originalStatus = file.status;
        
        const { req, res } = createMockReqRes(
          {}, // query
          { id: file._id }, // params
          { status: 'procesando', notes: 'Prueba unitaria' } // body
        );
        
        await fileStatusController.updateFileStatus(req, res);
        
        const success = 
          res.statusCode === 200 && 
          res.data && 
          res.data.success === true && 
          res.data.data && 
          res.data.data.status === 'procesando';
        
        if (success) {
          logTest('updateFileStatus - cambio a procesando', true, 
            `Estado cambiado correctamente de ${originalStatus} a procesando`);
          
          // Restaurar estado original
          await File.findByIdAndUpdate(file._id, { status: originalStatus });
        } else {
          logTest('updateFileStatus - cambio a procesando', false, 
            'La respuesta no tiene la estructura esperada o el estado no cambió correctamente', 
            res.data);
        }
      }
    } catch (error) {
      logTest('updateFileStatus - cambio a procesando', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 7. Prueba de updateFileStatus - estado inválido
    try {
      // Obtener un archivo para la prueba
      const files = await File.find().limit(1);
      
      if (files.length === 0) {
        logTest('updateFileStatus - estado inválido', false, 
          'No se encontraron archivos para probar');
      } else {
        const file = files[0];
        
        const { req, res } = createMockReqRes(
          {}, // query
          { id: file._id }, // params
          { status: 'estadoInvalido', notes: 'Prueba unitaria' } // body
        );
        
        await fileStatusController.updateFileStatus(req, res);
        
        const success = 
          res.statusCode === 400 && 
          res.data && 
          res.data.success === false && 
          res.data.error && 
          res.data.error.code === 'INVALID_STATUS';
        
        if (success) {
          logTest('updateFileStatus - estado inválido', true, 
            'Se rechazó correctamente el estado inválido');
        } else {
          logTest('updateFileStatus - estado inválido', false, 
            'No se rechazó correctamente el estado inválido', res.data);
        }
      }
    } catch (error) {
      logTest('updateFileStatus - estado inválido', false, 
        `Error al ejecutar el controlador: ${error.message}`);
    }
    
    // 8. Prueba de estructura de datos en getFileMetrics
    try {
      const { req, res } = createMockReqRes();
      
      await fileStatusController.getFileMetrics(req, res);
      
      if (!res.data || !res.data.data || !res.data.data.stats) {
        logTest('Estructura de datos - getFileMetrics', false, 
          'No se pudo obtener la respuesta esperada', res.data);
        throw new Error('Respuesta incompleta');
      }
      
      const stats = res.data.data.stats;
      const puzzleItems = res.data.data.puzzleItems;
      
      // Verificar que stats tenga los campos esperados
      const requiredStatsFields = [
        'totalFiles', 'pendientes', 'procesando', 'procesados', 'errores', 
        'tamanioPromedio', 'tamanioTotal'
      ];
      
      const hasAllStatsFields = requiredStatsFields.every(field => 
        stats.hasOwnProperty(field));
      
      // Verificar que puzzleItems tenga la estructura esperada
      const hasCorrectPuzzleItemStructure = puzzleItems.length === 0 || 
        (puzzleItems[0].hasOwnProperty('_id') && 
         puzzleItems[0].hasOwnProperty('name') && 
         puzzleItems[0].hasOwnProperty('status') && 
         puzzleItems[0].hasOwnProperty('size') && 
         puzzleItems[0].hasOwnProperty('folderName') && 
         puzzleItems[0].hasOwnProperty('weight'));
      
      if (hasAllStatsFields && hasCorrectPuzzleItemStructure) {
        logTest('Estructura de datos - getFileMetrics', true, 
          'La estructura de datos es correcta');
      } else {
        logTest('Estructura de datos - getFileMetrics', false, 
          'La estructura de datos no es correcta', {
            statsFields: requiredStatsFields.filter(f => !stats.hasOwnProperty(f)),
            puzzleItemHasCorrectStructure: hasCorrectPuzzleItemStructure
          });
      }
    } catch (error) {
      logTest('Estructura de datos - getFileMetrics', false, 
        `Error al verificar estructura de datos: ${error.message}`);
    }
    
    // Resumen de resultados
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n=============================================='.cyan);
    console.log(`📋 RESUMEN DE PRUEBAS UNITARIAS`.cyan.bold);
    console.log('=============================================='.cyan);
    console.log(`Total de pruebas: ${totalTests}`.white);
    console.log(`Pruebas exitosas: ${passedTests}`.green);
    console.log(`Pruebas fallidas: ${failedTests}`.red);
    console.log(`Tasa de éxito: ${Math.round((passedTests / totalTests) * 100)}%`.yellow);
    console.log('==============================================\n'.cyan);
    
    // Guardar resultados en un archivo para referencia
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      path.join(resultsDir, `unit-tests-${timestamp}.json`),
      JSON.stringify({
        timestamp: new Date(),
        summary: {
          total: totalTests,
          passed: passedTests,
          failed: failedTests,
          successRate: Math.round((passedTests / totalTests) * 100)
        },
        results: testResults
      }, null, 2)
    );
    
    // Cerrar conexión a MongoDB
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada correctamente'.cyan);
    
  } catch (error) {
    console.error(`Error general en pruebas unitarias: ${error.message}`.red.bold);
    console.error(error);
  }
};

// Ejecutar tests
runUnitTests(); 