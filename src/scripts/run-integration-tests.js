/**
 * Script para ejecutar pruebas de integración para el MVP
 * Este script verifica la correcta interacción entre los diferentes componentes del sistema
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
require('dotenv').config();

// Importar modelos
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const User = require('../models/User');

// Configuración del servidor de prueba
const TEST_SERVER_URL = 'http://localhost:5002';
const API_BASE_URL = `${TEST_SERVER_URL}/api`;
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwZDIxYjQ2NjdkMGQ4OTkyZTYxMGM4NSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYxNTI0NjQ3N30'; // Token para el usuario de prueba

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

// Cliente HTTP con token de autorización
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

// Función para esperar un tiempo específico
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Tests de Integración
const runIntegrationTests = async () => {
  console.log('Ejecutando pruebas de integración para el MVP...'.yellow.bold);
  
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
      if (data) console.log(data);
    }
  };
  
  try {
    // 1. Verificar conexión al servidor de prueba
    try {
      const response = await axios.get(TEST_SERVER_URL);
      logTest('Conexión al servidor de prueba', true, 'Servidor respondiendo correctamente');
    } catch (error) {
      logTest('Conexión al servidor de prueba', false, 
        `Error al conectar con el servidor: ${error.message}`);
      console.log('Asegúrate de que el servidor de prueba esté en ejecución: npm run test-server'.yellow);
      return;
    }
    
    // 2. Verificar acceso a la base de datos
    try {
      await connectDB();
      const filesCount = await File.countDocuments();
      logTest('Conexión a la base de datos', true, 
        `Base de datos conectada. Total de archivos: ${filesCount}`);
    } catch (error) {
      logTest('Conexión a la base de datos', false, 
        `Error al conectar a la base de datos: ${error.message}`);
      return;
    }
    
    // 3. Verificar endpoint de estado de archivos
    try {
      const response = await apiClient.get('/files/status');
      const hasRequiredFields = response.data && 
                              response.data.success === true && 
                              Array.isArray(response.data.data);
      
      if (hasRequiredFields) {
        logTest('Endpoint de estado de archivos', true, 
          'Endpoint responde con la estructura correcta');
      } else {
        logTest('Endpoint de estado de archivos', false, 
          'Endpoint no responde con la estructura esperada', response.data);
      }
    } catch (error) {
      logTest('Endpoint de estado de archivos', false, 
        `Error al consultar endpoint de estado: ${error.message}`);
    }
    
    // 4. Verificar endpoint de métricas
    try {
      const response = await apiClient.get('/files/metrics');
      const hasRequiredFields = response.data && 
                              response.data.success === true && 
                              response.data.data && 
                              response.data.data.stats && 
                              Array.isArray(response.data.data.puzzleItems);
      
      if (hasRequiredFields) {
        logTest('Endpoint de métricas', true, 
          `Endpoint responde con ${response.data.data.puzzleItems.length} elementos`);
      } else {
        logTest('Endpoint de métricas', false, 
          'Endpoint no responde con la estructura esperada', response.data);
      }
    } catch (error) {
      logTest('Endpoint de métricas', false, 
        `Error al consultar endpoint de métricas: ${error.message}`);
    }
    
    // 5. Verificar agrupación por carpeta
    try {
      const response = await apiClient.get('/files/status?groupBy=folder');
      const data = response.data.data;
      
      if (data && Array.isArray(data) && data.length > 0 && data[0].folderName) {
        logTest('Agrupación por carpeta', true, 
          `Datos agrupados correctamente por ${data.length} carpetas`);
      } else {
        logTest('Agrupación por carpeta', false, 
          'Datos no agrupados correctamente por carpeta', data);
      }
    } catch (error) {
      logTest('Agrupación por carpeta', false, 
        `Error al consultar endpoint con agrupación: ${error.message}`);
    }
    
    // 6. Verificar filtro por periodo de tiempo
    try {
      const response = await apiClient.get('/files/metrics?timeFrame=week');
      const data = response.data.data;
      
      if (data && data.stats && data.puzzleItems) {
        logTest('Filtro por periodo de tiempo', true, 
          `Datos filtrados correctamente: ${data.puzzleItems.length} elementos`);
      } else {
        logTest('Filtro por periodo de tiempo', false, 
          'Datos no filtrados correctamente por periodo', data);
      }
    } catch (error) {
      logTest('Filtro por periodo de tiempo', false, 
        `Error al consultar endpoint con filtro temporal: ${error.message}`);
    }
    
    // 7. Verificar cambio de estado de un archivo
    try {
      // Obtener un archivo para cambiar su estado
      const files = await File.find().limit(1);
      
      if (files.length === 0) {
        logTest('Cambio de estado de archivo', false, 'No se encontraron archivos para probar');
      } else {
        const file = files[0];
        const newStatus = file.status === 'procesado' ? 'pendiente' : 'procesado';
        
        // Cambiar estado mediante llamada a la API
        const updateResponse = await apiClient.patch(`/files/${file._id}/status`, {
          status: newStatus,
          notes: 'Cambio de estado por prueba de integración'
        });
        
        // Verificar que el estado se actualizó
        const updatedFile = await File.findById(file._id);
        
        if (updatedFile.status === newStatus) {
          logTest('Cambio de estado de archivo', true, 
            `Estado del archivo cambiado correctamente de ${file.status} a ${newStatus}`);
        } else {
          logTest('Cambio de estado de archivo', false, 
            `El estado del archivo no se actualizó correctamente`, 
            { anterior: file.status, esperado: newStatus, actual: updatedFile.status });
        }
      }
    } catch (error) {
      logTest('Cambio de estado de archivo', false, 
        `Error al cambiar estado de archivo: ${error.message}`);
    }
    
    // 8. Verificar consistencia entre MongoDB y API
    try {
      // Contar archivos en la base de datos
      const dbCount = await File.countDocuments();
      
      // Contar archivos a través de la API
      const apiResponse = await apiClient.get('/files/metrics');
      const apiCount = apiResponse.data.data.stats.totalFiles;
      
      if (dbCount === apiCount) {
        logTest('Consistencia entre MongoDB y API', true, 
          `Número de archivos consistente: ${dbCount}`);
      } else {
        logTest('Consistencia entre MongoDB y API', false, 
          `Inconsistencia en el número de archivos`, 
          { enBaseDeDatos: dbCount, enAPI: apiCount });
      }
    } catch (error) {
      logTest('Consistencia entre MongoDB y API', false, 
        `Error al verificar consistencia: ${error.message}`);
    }
    
    // 9. Verificar estructura de carpetas en el sistema de archivos
    try {
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        logTest('Sistema de archivos', true, 
          `Directorio de uploads existe con ${files.length} archivos`);
      } else {
        logTest('Sistema de archivos', false, 
          `Directorio de uploads no existe: ${uploadDir}`);
      }
    } catch (error) {
      logTest('Sistema de archivos', false, 
        `Error al verificar sistema de archivos: ${error.message}`);
    }
    
    // 10. Verificar interacción entre roles y acceso a archivos
    try {
      // Esta prueba requeriría un usuario con permisos limitados
      // Por ahora, verificamos la estructura de permisos en MongoDB
      const adminUser = await User.findOne({ role: 'admin' });
      
      if (adminUser) {
        logTest('Estructura de roles', true, 
          `Usuario administrador encontrado: ${adminUser.email}`);
      } else {
        logTest('Estructura de roles', false, 
          'No se encontró usuario administrador');
      }
    } catch (error) {
      logTest('Estructura de roles', false, 
        `Error al verificar roles: ${error.message}`);
    }
    
    // Resumen de resultados
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n=============================================='.cyan);
    console.log(`📋 RESUMEN DE PRUEBAS DE INTEGRACIÓN`.cyan.bold);
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
      path.join(resultsDir, `integration-tests-${timestamp}.json`),
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
    console.error(`Error general en pruebas de integración: ${error.message}`.red.bold);
    console.error(error);
  }
};

// Ejecutar tests
runIntegrationTests(); 