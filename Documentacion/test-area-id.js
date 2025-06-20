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

// Obtener todas las áreas
async function getAreas(token) {
  try {
    console.log('Obteniendo lista de áreas...');
    
    const response = await fetch('http://localhost:5000/api/areas', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`Se encontraron ${data.data.length} áreas`);
      return data.data;
    } else {
      console.log('No se encontraron áreas o formato de respuesta incorrecto');
      console.log('Respuesta:', data);
      return [];
    }
  } catch (error) {
    console.error('Error al obtener áreas:', error.message);
    return [];
  }
}

// Probar acceso a área por ID
async function testAreaById(token, areaId) {
  try {
    console.log(`Intentando acceder al área con ID: ${areaId}`);
    
    const response = await fetch(`http://localhost:5000/api/areas/${areaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Status code:', response.status);
    
    const data = await response.json();
    console.log('Respuesta completa:');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`Error al acceder al área con ID ${areaId}:`, error.message);
    return null;
  }
}

// Probar acceso a un ID inválido (para comparar)
async function testInvalidId(token) {
  console.log('Probando acceso con ID inválido "default"...');
  await testAreaById(token, 'default');
}

// Ejecutar prueba
async function run() {
  console.log('=== Prueba de acceso a áreas por ID ===');
  
  // Obtener token
  const token = await login();
  
  if (!token) {
    console.error('No se pudo obtener token. Abortando prueba.');
    return;
  }
  
  // Obtener áreas disponibles
  const areas = await getAreas(token);
  
  if (areas.length === 0) {
    console.log('No hay áreas disponibles para probar acceso por ID');
    
    // Probar con ID inválido de todos modos
    await testInvalidId(token);
    return;
  }
  
  // Seleccionar la primera área para probar
  const testArea = areas[0];
  console.log(`Área seleccionada para prueba: ${testArea.name} (${testArea._id})`);
  
  // Probar acceso a área válida por ID
  await testAreaById(token, testArea._id);
  
  // Probar acceso a ID inválido
  await testInvalidId(token);
}

// Ejecutar
run().catch(err => {
  console.error('Error en la ejecución:', err);
}); 