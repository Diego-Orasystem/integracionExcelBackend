const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Variables de configuración
const API_URL = 'http://localhost:5000';
const EMAIL = 'admin@example.com';  // Ajusta según credenciales reales
const PASSWORD = '123456';           // Ajusta según credenciales reales
const TEST_FILE_PATH = './test-upload-full.js'; // Usamos este mismo archivo como prueba

async function testFileUpload() {
  console.log('=== PRUEBA DE CARGA DE ARCHIVOS ===');
  
  // Obtener token de autenticación
  let token;
  try {
    console.log('1. Intentando login...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    if (loginResponse.data.success) {
      token = loginResponse.data.token;
      console.log('✅ Login exitoso, token obtenido');
    } else {
      console.error('❌ Login fallido');
      return;
    }
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    // Intentar con credenciales alternativas
    try {
      console.log('Probando con credenciales alternativas...');
      const altLoginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: 'admin@admin.com',
        password: 'admin123'
      });
      
      if (altLoginResponse.data.success) {
        token = altLoginResponse.data.token;
        console.log('✅ Login alternativo exitoso, token obtenido');
      } else {
        console.error('❌ Login alternativo fallido');
        return;
      }
    } catch (err) {
      console.error('❌ Error en login alternativo:', err.message);
      return;
    }
  }
  
  if (!token) {
    console.error('❌ No se pudo obtener token de autenticación, abortando pruebas');
    return;
  }
  
  // Obtener información de carpetas
  let folderId;
  try {
    console.log('\n2. Obteniendo lista de carpetas...');
    const foldersResponse = await axios.get(`${API_URL}/api/folders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (foldersResponse.data.data && foldersResponse.data.data.length > 0) {
      folderId = foldersResponse.data.data[0]._id;
      console.log(`✅ Carpeta encontrada: ID ${folderId}`);
    } else {
      console.error('❌ No se encontraron carpetas');
      return;
    }
  } catch (error) {
    console.error('❌ Error obteniendo carpetas:', error.message);
    return;
  }
  
  // Preparar archivo de prueba para subir
  console.log('\n3. Preparando archivo para subida...');
  const formData1 = new FormData();
  formData1.append('file', fs.createReadStream(TEST_FILE_PATH));
  formData1.append('folderId', folderId);
  formData1.append('description', 'Archivo de prueba - Ruta 1');
  
  const formData2 = new FormData();
  formData2.append('file', fs.createReadStream(TEST_FILE_PATH));
  formData2.append('folderId', folderId);
  formData2.append('description', 'Archivo de prueba - Ruta 2');
  
  // Probar la primera ruta: /api/files (POST)
  try {
    console.log('\n4. Probando carga en /api/files (POST)...');
    const uploadResponse1 = await axios.post(`${API_URL}/api/files`, formData1, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData1.getHeaders()
      }
    });
    
    console.log('✅ Carga exitosa en /api/files');
    console.log('   Respuesta:', JSON.stringify(uploadResponse1.data, null, 2));
  } catch (error) {
    console.error('❌ Error en carga a /api/files:', error.message);
    if (error.response) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Probar la segunda ruta: /api/files/upload (POST)
  try {
    console.log('\n5. Probando carga en /api/files/upload (POST)...');
    const uploadResponse2 = await axios.post(`${API_URL}/api/files/upload`, formData2, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData2.getHeaders()
      }
    });
    
    console.log('✅ Carga exitosa en /api/files/upload');
    console.log('   Respuesta:', JSON.stringify(uploadResponse2.data, null, 2));
  } catch (error) {
    console.error('❌ Error en carga a /api/files/upload:', error.message);
    if (error.response) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== FIN DE PRUEBA ===');
}

testFileUpload(); 