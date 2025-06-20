/**
 * Script para generar datos de prueba y limpiar datos reales
 * Este script genera datos ficticios para el MVP de la visualización tipo rompecabezas
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const colors = require('colors');

// Cargar modelos
const File = require('../models/File');
const Folder = require('../models/Folder');
const Company = require('../models/Company');
const User = require('../models/User');

// IDs fijos para las entidades de prueba
const TEST_COMPANY_ID = new mongoose.Types.ObjectId('60d21b4667d0d8992e610c86');
const TEST_USER_ID = new mongoose.Types.ObjectId('60d21b4667d0d8992e610c85');
const FOLDER_IDS = {
  documentos: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c87'),
  informes: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c88'),
  presentaciones: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c89'),
  datos: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c90')
};

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

// Eliminar todos los datos existentes
const cleanDB = async () => {
  try {
    console.log('Eliminando datos existentes...'.yellow);
    await File.deleteMany({});
    await Folder.deleteMany({});
    await Company.deleteMany({});
    await User.deleteMany({});
    console.log('Datos existentes eliminados correctamente'.green);
  } catch (error) {
    console.error(`Error al limpiar la base de datos: ${error.message}`.red);
    process.exit(1);
  }
};

// Generar datos de prueba de empresa
const createTestCompany = async () => {
  try {
    console.log('Creando empresa de prueba...'.yellow);
    const company = new Company({
      _id: TEST_COMPANY_ID,
      name: 'Empresa de Prueba',
      nif: 'B12345678',
      address: 'Calle Prueba, 123',
      phone: '912345678',
      email: 'info@empresaprueba.com',
      active: true
    });
    await company.save();
    console.log('Empresa de prueba creada correctamente'.green);
    return company;
  } catch (error) {
    console.error(`Error al crear la empresa de prueba: ${error.message}`.red);
    process.exit(1);
  }
};

// Generar datos de prueba de usuario
const createTestUser = async () => {
  try {
    console.log('Creando usuario de prueba...'.yellow);
    
    // Generar hash de contraseña usando bcrypt directamente
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    console.log('Hash de contraseña generado correctamente');
    
    const user = new User({
      _id: TEST_USER_ID,
      name: 'Usuario Prueba',
      email: 'usuario@empresaprueba.com',
      password: hashedPassword, // Contraseña hasheada con bcrypt
      companyId: TEST_COMPANY_ID,
      role: 'admin',
      active: true
    });
    
    // Guardar usuario directamente en la colección
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    await usersCollection.insertOne(user);
    
    console.log('Usuario de prueba creado correctamente'.green);
    console.log(`Se guardó con éxito el usuario: ${user.email} con contraseña: password123`);
    return user;
  } catch (error) {
    console.error(`Error al crear el usuario de prueba: ${error.message}`.red);
    process.exit(1);
  }
};

// Generar carpetas de prueba
const createTestFolders = async () => {
  try {
    console.log('Creando carpetas de prueba...'.yellow);
    
    const folders = [
      {
        _id: FOLDER_IDS.documentos,
        name: 'Documentos',
        path: '/Documentos',
        companyId: TEST_COMPANY_ID,
        createdBy: TEST_USER_ID
      },
      {
        _id: FOLDER_IDS.informes,
        name: 'Informes',
        path: '/Informes',
        companyId: TEST_COMPANY_ID,
        createdBy: TEST_USER_ID
      },
      {
        _id: FOLDER_IDS.presentaciones,
        name: 'Presentaciones',
        path: '/Presentaciones',
        companyId: TEST_COMPANY_ID,
        createdBy: TEST_USER_ID
      },
      {
        _id: FOLDER_IDS.datos,
        name: 'Datos',
        path: '/Datos',
        companyId: TEST_COMPANY_ID,
        createdBy: TEST_USER_ID
      }
    ];
    
    await Folder.insertMany(folders);
    console.log(`${folders.length} carpetas de prueba creadas correctamente`.green);
  } catch (error) {
    console.error(`Error al crear carpetas de prueba: ${error.message}`.red);
    process.exit(1);
  }
};

// Crear el directorio de uploads si no existe
const createUploadDir = () => {
  const uploadDir = process.env.UPLOAD_PATH || './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Generar archivos de prueba para la visualización de rompecabezas
const createTestFiles = async () => {
  try {
    console.log('Creando archivos de prueba...'.yellow);
    
    // Crear ejemplos de archivos para cada carpeta
    const uploadDir = createUploadDir();
    
    // Generar datos con diferentes estados de procesamiento y fechas
    const files = [];
    const today = new Date();
    
    // Función para generar fechas aleatorias en los últimos 30 días
    const randomDate = (daysAgo) => {
      const date = new Date(today);
      date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
      return date;
    };
    
    // Función para generar duración aleatoria de procesamiento
    const randomDuration = () => Math.floor(Math.random() * 120000) + 10000; // Entre 10s y 2min
    
    // Lista de nombres de archivo realistas para cada carpeta
    const fileNames = {
      documentos: [
        'Política_Privacidad_2023.xlsx', 'Contratos_Proveedores.xlsx', 
        'Manual_Procedimientos.xlsx', 'Plan_Estratégico_2023-2025.xlsx',
        'Inventario_Equipos.xlsx', 'Plantilla_Factura.xlsx'
      ],
      informes: [
        'Informe_Ventas_Q1_2023.xlsx', 'Informe_Ventas_Q2_2023.xlsx', 
        'Análisis_Competencia.xlsx', 'Presupuesto_Anual.xlsx',
        'KPIs_Departamento_Comercial.xlsx', 'Previsión_Ventas_2024.xlsx'
      ],
      presentaciones: [
        'Presentación_Junta_Directiva.xlsx', 'Datos_Presentación_Clientes.xlsx',
        'Dashboard_Ejecutivo.xlsx', 'Análisis_DAFO.xlsx'
      ],
      datos: [
        'Base_Datos_Clientes.xlsx', 'Catálogo_Productos.xlsx',
        'Historial_Precios.xlsx', 'Stock_Almacén.xlsx',
        'Datos_Empleados.xlsx', 'Indicadores_Rendimiento.xlsx'
      ]
    };
    
    // Estados posibles para los archivos
    const estados = ['pendiente', 'procesando', 'procesado', 'error'];
    
    // Crear archivos para cada carpeta
    Object.entries(fileNames).forEach(([folder, names]) => {
      const folderId = FOLDER_IDS[folder];
      
      names.forEach((name, index) => {
        // Crear archivo físico de ejemplo si no existe
        const filePath = path.join(uploadDir, name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, `Contenido de prueba para ${name}`);
        }
        
        // Determinar estado del archivo
        let estado;
        if (index < names.length * 0.5) { // 50% procesados
          estado = 'procesado';
        } else if (index < names.length * 0.7) { // 20% pendientes
          estado = 'pendiente';
        } else if (index < names.length * 0.9) { // 20% procesando
          estado = 'procesando';
        } else { // 10% error
          estado = 'error';
        }
        
        // Crear fechas de procesamiento coherentes con el estado
        let processingDetails = {};
        
        if (estado === 'procesando') {
          const startDate = randomDate(2); // En los últimos 2 días
          processingDetails = {
            startDate: startDate,
            processingNotes: 'Procesamiento en curso'
          };
        } else if (estado === 'procesado') {
          const startDate = randomDate(15); // En los últimos 15 días
          const duration = randomDuration();
          const endDate = new Date(startDate.getTime() + duration);
          processingDetails = {
            startDate: startDate,
            endDate: endDate,
            duration: duration,
            processingNotes: 'Procesamiento completado correctamente'
          };
        } else if (estado === 'error') {
          const startDate = randomDate(10); // En los últimos 10 días
          const duration = randomDuration();
          const endDate = new Date(startDate.getTime() + duration);
          processingDetails = {
            startDate: startDate,
            endDate: endDate,
            duration: duration,
            errorMessage: 'Error al procesar archivo: formato no válido',
            processingNotes: 'Se encontraron problemas durante el procesamiento'
          };
        }
        
        // Generar metadatos aleatorios para los archivos
        const metadata = {
          sheets: ['Hoja1', 'Hoja2', 'Datos'],
          rowCount: Math.floor(Math.random() * 10000) + 100,
          columnCount: Math.floor(Math.random() * 20) + 5
        };
        
        // Crear objeto de archivo
        const file = {
          name: name,
          originalName: name,
          description: `Archivo de prueba para ${folder}`,
          folderId: folderId,
          companyId: TEST_COMPANY_ID,
          size: Math.floor(Math.random() * 1000000) + 10000,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: '.xlsx',
          storageLocation: filePath,
          uploadedBy: TEST_USER_ID,
          uploadType: 'manual',
          version: 1,
          status: estado,
          processingDetails: processingDetails,
          metadata: metadata,
          tags: [folder, 'test', '2023'],
          createdAt: randomDate(30),
          updatedAt: randomDate(5)
        };
        
        files.push(file);
      });
    });
    
    await File.insertMany(files);
    console.log(`${files.length} archivos de prueba creados correctamente`.green);
  } catch (error) {
    console.error(`Error al crear archivos de prueba: ${error.message}`.red);
    process.exit(1);
  }
};

// Función principal para ejecutar el script
const runScript = async () => {
  try {
    // Conectar a la base de datos
    const conn = await connectDB();
    
    // Limpiar datos existentes
    await cleanDB();
    
    // Crear datos de prueba
    await createTestCompany();
    await createTestUser();
    await createTestFolders();
    await createTestFiles();
    
    console.log('\n======================================'.green);
    console.log('Script completado con éxito'.green.bold);
    console.log('Datos de prueba generados correctamente'.green);
    console.log('======================================\n'.green);
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada'.cyan);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error al ejecutar el script: ${error.message}`.red);
    process.exit(1);
  }
};

// Ejecutar script
runScript(); 