/**
 * Script directo para arreglar al usuario administrador
 * Este script actualiza manualmente al usuario con email admin@sistema.com
 * para asegurar que la contraseña sea 'Admin123456'
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuración
const ADMIN_EMAIL = 'admin@sistema.com';
const ADMIN_PASSWORD = 'Admin123456';
// Hash predefinido generado con la misma versión de bcrypt
const PREDEFINED_HASH = '$2a$10$iW5luGI6Abe65orrxQ9hk.ft.Gsk89rw8.D34jnO1OFxDI201tAwm';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/excel_manager';

async function fixAdminUser() {
  let connection;
  
  try {
    // Conectar directamente sin Mongoose models
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Acceder directamente a la colección de usuarios
    const db = connection.connection.db;
    const usersCollection = db.collection('users');
    
    // Buscar todos los usuarios admin
    const users = await usersCollection.find({ role: 'admin' }).toArray();
    
    console.log(`Se encontraron ${users.length} usuarios administradores:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user._id})`);
    });
    
    // Actualizar cada usuario administrador
    console.log('\nActualizando usuarios administradores...');
    
    for (const user of users) {
      // Actualizar contraseña directamente
      const result = await usersCollection.updateOne(
        { _id: user._id },
        { $set: { password: PREDEFINED_HASH } }
      );
      
      if (result.modifiedCount === 1) {
        console.log(`✅ Contraseña actualizada para usuario: ${user.email}`);
      } else {
        console.log(`❌ No se pudo actualizar la contraseña para: ${user.email}`);
      }
    }
    
    // Buscar o crear el usuario admin@sistema.com si no existe
    const adminUser = await usersCollection.findOne({ email: ADMIN_EMAIL });
    
    if (!adminUser) {
      console.log(`\nUsuario ${ADMIN_EMAIL} no encontrado. Buscando una compañía para crearlo...`);
      
      // Buscar una compañía existente
      const companiesCollection = db.collection('companies');
      const company = await companiesCollection.findOne({});
      
      if (!company) {
        console.log('No se encontró ninguna compañía. Creando una compañía por defecto...');
        
        // Crear una compañía por defecto
        const newCompany = {
          name: 'Sistema Administración',
          description: 'Empresa por defecto del sistema',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const companyResult = await companiesCollection.insertOne(newCompany);
        console.log(`Compañía creada con ID: ${companyResult.insertedId}`);
        
        // Crear usuario administrador
        const newAdmin = {
          name: 'Administrador del Sistema',
          email: ADMIN_EMAIL,
          password: PREDEFINED_HASH,
          role: 'admin',
          companyId: companyResult.insertedId,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const adminResult = await usersCollection.insertOne(newAdmin);
        console.log(`Usuario administrador creado con ID: ${adminResult.insertedId}`);
      } else {
        console.log(`Usando compañía existente con ID: ${company._id}`);
        
        // Crear usuario administrador
        const newAdmin = {
          name: 'Administrador del Sistema',
          email: ADMIN_EMAIL,
          password: PREDEFINED_HASH,
          role: 'admin',
          companyId: company._id,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const adminResult = await usersCollection.insertOne(newAdmin);
        console.log(`Usuario administrador creado con ID: ${adminResult.insertedId}`);
      }
    } else {
      console.log(`\nUsuario ${ADMIN_EMAIL} encontrado con ID: ${adminUser._id}`);
      console.log('Actualizando contraseña...');
      
      const result = await usersCollection.updateOne(
        { _id: adminUser._id },
        { $set: { password: PREDEFINED_HASH } }
      );
      
      if (result.modifiedCount === 1) {
        console.log('✅ Contraseña actualizada correctamente');
      } else {
        console.log('❌ No se pudo actualizar la contraseña');
      }
    }
    
    console.log('\n✅ PROCESO COMPLETADO');
    console.log('Ahora puedes iniciar sesión con:');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Contraseña: ${ADMIN_PASSWORD}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cerrar conexión
    if (connection) {
      await connection.connection.close();
      console.log('Conexión cerrada');
    }
  }
}

// Ejecutar
console.log('=== Arreglo Directo de Usuarios Administradores ===');
fixAdminUser(); 