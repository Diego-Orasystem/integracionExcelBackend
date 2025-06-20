const axios = require('axios');

// Función para probar si los endpoints existen
async function testEndpoints() {
  console.log('=== PRUEBA DE ENDPOINTS ===');
  const apiUrl = 'http://localhost:5000';
  
  // Probar endpoint 1: /api/files
  try {
    console.log('\n1. Probando POST a /api/files (sin autenticación)...');
    await axios.post(`${apiUrl}/api/files`, {});
    console.log('✅ Endpoint responde sin error 404');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`❌ ERROR 404: El endpoint /api/files NO EXISTE`);
    } else {
      console.log(`✅ El endpoint /api/files EXISTE (devuelve error ${error.response?.status || 'desconocido'})`);
      console.log(`   Mensaje: ${JSON.stringify(error.response?.data || 'No hay datos')}`);
    }
  }
  
  // Probar endpoint 2: /api/files/upload
  try {
    console.log('\n2. Probando POST a /api/files/upload (sin autenticación)...');
    await axios.post(`${apiUrl}/api/files/upload`, {});
    console.log('✅ Endpoint responde sin error 404');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`❌ ERROR 404: El endpoint /api/files/upload NO EXISTE`);
    } else {
      console.log(`✅ El endpoint /api/files/upload EXISTE (devuelve error ${error.response?.status || 'desconocido'})`);
      console.log(`   Mensaje: ${JSON.stringify(error.response?.data || 'No hay datos')}`);
    }
  }
  
  // Probar OPTIONS para CORS en ambos endpoints
  try {
    console.log('\n3. Probando OPTIONS en /api/files...');
    await axios({
      method: 'OPTIONS',
      url: `${apiUrl}/api/files`
    });
    console.log('✅ OPTIONS a /api/files responde correctamente');
  } catch (error) {
    console.log(`ℹ️ OPTIONS a /api/files responde con: ${error.response?.status || 'desconocido'}`);
  }
  
  try {
    console.log('\n4. Probando OPTIONS en /api/files/upload...');
    await axios({
      method: 'OPTIONS',
      url: `${apiUrl}/api/files/upload`
    });
    console.log('✅ OPTIONS a /api/files/upload responde correctamente');
  } catch (error) {
    console.log(`ℹ️ OPTIONS a /api/files/upload responde con: ${error.response?.status || 'desconocido'}`);
  }
  
  console.log('\n=== RESUMEN ===');
  console.log('Si no viste errores 404, ambos endpoints existen y están configurados correctamente.');
  console.log('Los errores 401 (No autorizado) son esperados ya que no enviamos token de autenticación.');
}

testEndpoints(); 