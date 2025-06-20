const axios = require('axios');

// Función para probar si el endpoint existe
async function testEndpoint() {
  console.log('Probando si /api/files/upload existe (sin autenticación)...');
  
  try {
    // Primero intenta hacer una solicitud OPTIONS para ver si la ruta existe
    await axios({
      method: 'OPTIONS',
      url: 'http://localhost:5000/api/files/upload'
    });
    console.log('✅ OPTIONS a /api/files/upload responde (la ruta existe)');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ No se puede conectar al servidor. Asegúrate de que esté en ejecución.');
      return;
    }
    
    // El error no significa necesariamente que la ruta no exista
    console.log('La solicitud OPTIONS generó un error, pero esto no confirma que la ruta no exista');
  }
  
  // Intenta hacer una solicitud POST para ver qué tipo de respuesta obtenemos
  try {
    await axios.post('http://localhost:5000/api/files/upload', {});
    console.log('✅ POST a /api/files/upload responde sin error');
  } catch (error) {
    if (!error.response) {
      console.error('❌ No hay respuesta del servidor:', error.message);
      return;
    }
    
    if (error.response.status === 404) {
      console.error('❌ ERROR 404: La ruta /api/files/upload NO EXISTE');
    } else {
      console.log('✅ La ruta /api/files/upload EXISTE (devuelve error diferente a 404)');
      console.log(`   Código de error: ${error.response.status}`);
      console.log(`   Mensaje: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  // Verifica otras rutas relacionadas con la API de archivos
  console.log('\nVerificando /api/files...');
  try {
    await axios.get('http://localhost:5000/api/files');
    console.log('✅ GET a /api/files responde sin error');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ ERROR 404: La ruta /api/files NO EXISTE');
    } else {
      console.log('✅ La ruta /api/files EXISTE (devuelve error diferente a 404)');
      console.log(`   Código de error: ${error.response?.status}`);
    }
  }
  
  // Verificar /api/file-status (debería haberse cambiado a este prefijo)
  console.log('\nVerificando /api/file-status...');
  try {
    await axios.get('http://localhost:5000/api/file-status');
    console.log('✅ GET a /api/file-status responde sin error');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error('❌ ERROR 404: La ruta /api/file-status NO EXISTE');
    } else {
      console.log('✅ La ruta /api/file-status EXISTE (devuelve error diferente a 404)');
      console.log(`   Código de error: ${error.response?.status}`);
    }
  }
}

testEndpoint(); 