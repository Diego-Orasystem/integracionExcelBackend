const axios = require('axios');

// Función para probar si la API está disponible
async function testApi() {
  try {
    // Probar la ruta raíz
    console.log('1. Probando ruta raíz...');
    try {
      const rootResponse = await axios.get('http://localhost:5000/');
      console.log('✅ La ruta raíz responde:', rootResponse.status);
      console.log('   Mensaje:', rootResponse.data.message);
    } catch (error) {
      console.error('❌ Error al acceder a la ruta raíz:', error.message);
      return;
    }

    // Probar POST a auth/login
    console.log('\n2. Probando login...');
    let token;
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'admin@example.com',
        password: '123456' // Ajusta según tus credenciales
      });
      
      if (loginResponse.data.success) {
        console.log('✅ Login exitoso');
        token = loginResponse.data.token;
      } else {
        console.error('❌ Login fallido:', loginResponse.data);
        return;
      }
    } catch (error) {
      console.error('❌ Error en login:', error.message);
      console.error('   Detalles:', error.response?.data);
      console.log('\nProbando con credenciales alternativas...');
      
      try {
        const altLoginResponse = await axios.post('http://localhost:5000/api/auth/login', {
          email: 'admin@admin.com',
          password: 'admin123'
        });
        
        if (altLoginResponse.data.success) {
          console.log('✅ Login exitoso con credenciales alternativas');
          token = altLoginResponse.data.token;
        } else {
          console.error('❌ Login alternativo fallido:', altLoginResponse.data);
          return;
        }
      } catch (err) {
        console.error('❌ Error en login alternativo:', err.message);
        return;
      }
    }
    
    if (!token) {
      console.error('❌ No se pudo obtener un token de autenticación');
      return;
    }
    
    // Verificar que /api/files existe
    console.log('\n3. Verificando ruta /api/files...');
    try {
      const filesResponse = await axios.get('http://localhost:5000/api/files', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`✅ La ruta /api/files responde con código ${filesResponse.status}`);
    } catch (error) {
      console.error('❌ Error al acceder a /api/files:', error.message);
      console.error('   Detalles:', error.response?.data);
    }
    
    // Verificar método OPTIONS en /api/files/upload (para CORS)
    console.log('\n4. Verificando OPTIONS en /api/files/upload...');
    try {
      const optionsResponse = await axios({
        method: 'OPTIONS',
        url: 'http://localhost:5000/api/files/upload',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`✅ OPTIONS responde con código ${optionsResponse.status}`);
    } catch (error) {
      // OPTIONS puede fallar, pero eso no significa que la ruta no exista
      console.log('ℹ️ OPTIONS no responde o devuelve error (esperado en algunos casos)');
    }
    
    // Probar POST a /api/files/upload (no es necesario enviar archivos reales)
    console.log('\n5. Probando POST a /api/files/upload (sin enviar archivos)...');
    try {
      await axios.post('http://localhost:5000/api/files/upload', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ POST a /api/files/upload no genera error 404');
    } catch (error) {
      if (error.response?.status === 404) {
        console.error('❌ ERROR 404: La ruta /api/files/upload no existe');
        console.error('   Comprueba que el endpoint está correctamente configurado en el servidor');
      } else {
        console.log('✅ La ruta /api/files/upload existe (devuelve error diferente a 404)');
        console.log(`   Error: ${error.response?.status} - ${error.response?.data?.error?.message || 'Sin mensaje'}`);
      }
    }
    
    console.log('\n📝 Resumen:');
    console.log('La prueba de API ha finalizado. Si ves algún error 404, indica que la ruta no existe.');
    console.log('Si ves otros errores (400, 401, 403, 500), indica que la ruta existe pero hay otros problemas.');
  } catch (error) {
    console.error('Error en la prueba:', error.message);
  }
}

testApi(); 