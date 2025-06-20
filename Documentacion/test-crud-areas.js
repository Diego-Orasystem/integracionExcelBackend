const fetch = require('node-fetch');

// Configuración
const API_BASE_URL = 'http://localhost:5000/api';
let token = null;
let createdAreaId = null;

// Función para hacer login y obtener token
async function login() {
  try {
    console.log('Iniciando sesión...');
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
    console.log('Respuesta completa del login:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.token) {
      console.log('✅ Login exitoso');
      return data.data.token;
    } else {
      console.error('❌ Error al hacer login:', data.error || 'No se recibió token');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición de login:', error.message);
    return null;
  }
}

// 1. CREAR un área nueva (CREATE)
async function createArea() {
  try {
    console.log('\n🔹 Prueba: CREAR área');
    
    const newArea = {
      name: `Área de Prueba ${Date.now()}`, // Usar timestamp para evitar duplicados
      description: 'Área creada para pruebas de API',
      icon: 'test',
      color: '#ff5733'
    };
    
    console.log('Datos a enviar:', newArea);
    
    const response = await fetch(`${API_BASE_URL}/areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newArea)
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log('✅ Área creada correctamente');
      console.log('ID:', data.data._id);
      console.log('Nombre:', data.data.name);
      createdAreaId = data.data._id;
      return data.data;
    } else {
      console.error('❌ Error al crear el área:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear área:', error.message);
    return null;
  }
}

// 2. LEER todas las áreas (READ - list)
async function getAllAreas() {
  try {
    console.log('\n🔹 Prueba: LISTAR todas las áreas');
    
    const response = await fetch(`${API_BASE_URL}/areas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log(`✅ Se encontraron ${data.count} áreas`);
      // Mostrar solo los nombres de las áreas para no saturar la consola
      data.data.forEach(area => {
        console.log(`- ${area.name} (${area._id})`);
      });
      return data.data;
    } else {
      console.error('❌ Error al obtener las áreas:', data.error || 'Error desconocido');
      return [];
    }
  } catch (error) {
    console.error('❌ Error en la petición para obtener áreas:', error.message);
    return [];
  }
}

// 3. LEER un área específica por ID (READ - detail)
async function getAreaById(areaId) {
  try {
    console.log(`\n🔹 Prueba: OBTENER área por ID (${areaId})`);
    
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log('✅ Área obtenida correctamente');
      console.log('Datos completos del área:');
      console.log(`- ID: ${data.data._id}`);
      console.log(`- Nombre: ${data.data.name}`);
      console.log(`- Descripción: ${data.data.description}`);
      console.log(`- Icono: ${data.data.icon}`);
      console.log(`- Color: ${data.data.color}`);
      return data.data;
    } else {
      console.error('❌ Error al obtener el área:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error en la petición para obtener área ${areaId}:`, error.message);
    return null;
  }
}

// 4. ACTUALIZAR un área (UPDATE)
async function updateArea(areaId) {
  try {
    console.log(`\n🔹 Prueba: ACTUALIZAR área (${areaId})`);
    
    const updatedData = {
      name: `Área Actualizada ${Date.now()}`,
      description: 'Descripción actualizada por API',
      icon: 'updated',
      color: '#33ff57'
    };
    
    console.log('Datos a actualizar:', updatedData);
    
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedData)
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log('✅ Área actualizada correctamente');
      console.log('Datos actualizados:');
      console.log(`- ID: ${data.data._id}`);
      console.log(`- Nombre: ${data.data.name}`);
      console.log(`- Descripción: ${data.data.description}`);
      return data.data;
    } else {
      console.error('❌ Error al actualizar el área:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error(`❌ Error en la petición para actualizar área ${areaId}:`, error.message);
    return null;
  }
}

// 5. ELIMINAR un área (DELETE)
async function deleteArea(areaId) {
  try {
    console.log(`\n🔹 Prueba: ELIMINAR área (${areaId})`);
    
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success) {
      console.log('✅ Área eliminada correctamente');
      return true;
    } else {
      console.error('❌ Error al eliminar el área:', data.error || 'Error desconocido');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error en la petición para eliminar área ${areaId}:`, error.message);
    return false;
  }
}

// 6. Prueba de creación de áreas predefinidas
async function createDefaultAreas() {
  try {
    console.log('\n🔹 Prueba: CREAR áreas predefinidas');
    
    const response = await fetch(`${API_BASE_URL}/areas/default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})  // No necesita datos específicos
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log('✅ Áreas predefinidas creadas correctamente');
      console.log(`Se crearon ${data.data.length} áreas predefinidas`);
      return data.data;
    } else {
      console.error('❌ Error al crear áreas predefinidas:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear áreas predefinidas:', error.message);
    return null;
  }
}

// Función principal para ejecutar todas las pruebas
async function runTests() {
  console.log('🔶 INICIANDO PRUEBAS DE CRUD DE ÁREAS 🔶');
  
  // 1. Hacer login para obtener token
  token = await login();
  if (!token) {
    console.error('❌ No se pudo obtener token. Abortando pruebas.');
    return;
  }
  
  // 2. Probar obtener todas las áreas
  await getAllAreas();
  
  // 3. Crear un área nueva
  const newArea = await createArea();
  if (!newArea) {
    console.error('❌ No se pudo crear un área nueva. Abortando pruebas siguientes.');
    return;
  }
  
  // 4. Obtener el área creada por ID
  await getAreaById(createdAreaId);
  
  // 5. Actualizar el área
  await updateArea(createdAreaId);
  
  // 6. Verificar que se actualizó correctamente
  await getAreaById(createdAreaId);
  
  // 7. Eliminar el área
  await deleteArea(createdAreaId);
  
  // 8. Verificar que se eliminó (debería dar error o indicar que no existe)
  await getAreaById(createdAreaId);
  
  // 9. Probar crear áreas predefinidas
  await createDefaultAreas();
  
  console.log('\n🔶 FIN DE LAS PRUEBAS DE CRUD DE ÁREAS 🔶');
  
  // Resumen de endpoints
  console.log('\n📋 RESUMEN DE ENDPOINTS DE ÁREAS:');
  console.log('--------------------------------');
  console.log('📌 CREAR área: POST /api/areas');
  console.log('📌 LISTAR áreas: GET /api/areas');
  console.log('📌 OBTENER área por ID: GET /api/areas/:id');
  console.log('📌 ACTUALIZAR área: PUT /api/areas/:id');
  console.log('📌 ELIMINAR área: DELETE /api/areas/:id');
  console.log('📌 CREAR áreas predefinidas: POST /api/areas/default');
}

// Ejecutar las pruebas
runTests().catch(err => {
  console.error('❌ Error general en las pruebas:', err);
}); 