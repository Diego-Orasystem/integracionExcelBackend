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
    console.log('Respuesta de login:', data);
    
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

// Función para probar endpoint con token
async function testEndpoint(token, endpoint) {
  try {
    console.log(`Probando endpoint: /api/${endpoint} con token: ${token.substring(0, 20)}...`);
    const response = await fetch(`http://localhost:5000/api/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log(`Respuesta de ${endpoint}:`, data);
    console.log('Status:', response.status, response.statusText);
    return data;
  } catch (error) {
    console.error(`Error en la petición a ${endpoint}:`, error.message);
    return null;
  }
}

// Ejecutar pruebas
async function runTests() {
  console.log('Iniciando pruebas de API...');
  
  // Login para obtener token
  const token = await login();
  
  if (!token) {
    console.error('No se pudo obtener token. Abortando pruebas.');
    return;
  }
  
  console.log('Token obtenido con éxito:', token.substring(0, 20) + '...');
  
  // Probar endpoint de áreas
  await testEndpoint(token, 'areas');
  
  // Probar endpoint de áreas/default
  await testEndpoint(token, 'areas/default');
  
  // Probar endpoint de subáreas
  await testEndpoint(token, 'subareas');
}

// Ejecutar
runTests().catch(err => {
  console.error('Error en las pruebas:', err);
}); 