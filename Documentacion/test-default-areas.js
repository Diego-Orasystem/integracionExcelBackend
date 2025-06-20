const fetch = require('node-fetch');

// Función para hacer login y obtener token
async function login() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@sistema.com',
        password: 'Admin123456'
      })
    });
    
    const data = await response.json();
    console.log('Respuesta de login:', data.success ? 'Éxito' : 'Error');
    
    if (data.success && data.data && data.data.token) {
      return data.data.token;
    } else {
      console.error('Error al hacer login:', data.error || 'No se recibió token');
      return null;
    }
  } catch (error) {
    console.error('Error en la petición de login:', error.message);
    return null;
  }
}

// Función para probar la creación de áreas por defecto
async function testDefaultAreas(token) {
  try {
    console.log('Intentando crear áreas por defecto...');
    console.log('URL: http://localhost:5000/api/areas/default');
    console.log('Método: POST');
    console.log('Token: ' + token.substring(0, 20) + '...');
    
    const response = await fetch('http://localhost:5000/api/areas/default', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        companyId: null  // Usará la compañía del usuario
      })
    });
    
    console.log('Status code:', response.status);
    
    const data = await response.json();
    console.log('Respuesta completa:');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error al crear áreas por defecto:', error.message);
    return null;
  }
}

// Ejecutar prueba
async function run() {
  console.log('=== Prueba de creación de áreas por defecto ===');
  
  // Obtener token
  const token = await login();
  
  if (!token) {
    console.error('No se pudo obtener token. Abortando prueba.');
    return;
  }
  
  // Probar creación de áreas por defecto
  await testDefaultAreas(token);
}

// Ejecutar
run().catch(err => {
  console.error('Error en la ejecución:', err);
}); 