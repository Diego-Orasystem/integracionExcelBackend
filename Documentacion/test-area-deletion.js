const fetch = require('node-fetch');

// Configuración
const API_BASE_URL = 'http://localhost:5000/api';
let token = null;

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

// Crear áreas predefinidas
async function createDefaultAreas() {
  try {
    console.log('\n🔹 Creando áreas predefinidas...');
    
    const response = await fetch(`${API_BASE_URL}/areas/default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    
    if (response.status === 500) {
      console.log('ℹ️ Error 500 al crear áreas predefinidas, probablemente ya existen. Intentando obtener áreas existentes...');
      return await getAreas('predefinidas');
    }
    
    if (data.success && data.data) {
      console.log(`✅ Se crearon ${data.data.length} áreas predefinidas`);
      return data.data;
    } else {
      console.error('❌ Error al crear áreas predefinidas:', data.error || 'Error desconocido');
      return [];
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear áreas predefinidas:', error.message);
    return [];
  }
}

// Crear un área manual
async function createManualArea() {
  try {
    console.log('\n🔹 Creando área manualmente...');
    
    const areaData = {
      name: `Área Manual ${Date.now()}`,
      description: 'Área creada manualmente para pruebas',
      icon: 'manual',
      color: '#FF9900'
    };
    
    const response = await fetch(`${API_BASE_URL}/areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(areaData)
    });
    
    const data = await response.json();
    
    if (data.success && data.data) {
      console.log(`✅ Área manual creada con ID: ${data.data._id}`);
      return data.data;
    } else {
      console.error('❌ Error al crear área manual:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear área manual:', error.message);
    return null;
  }
}

// Obtener todas las áreas
async function getAreas(tipo = '') {
  try {
    console.log(`\n🔹 Obteniendo lista de áreas${tipo ? ' ' + tipo : ''}...`);
    
    const response = await fetch(`${API_BASE_URL}/areas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`✅ Se encontraron ${data.data.length} áreas`);
      
      // Filtrar áreas según el tipo si es necesario
      let areas = data.data;
      if (tipo === 'predefinidas') {
        areas = areas.filter(area => area.isDefault === true);
        console.log(`ℹ️ De las cuales ${areas.length} son predefinidas`);
      }
      
      // Mostrar información resumida
      areas.forEach(area => {
        console.log(`- ${area.name} (${area._id}) - Predefinida: ${area.isDefault ? 'Sí' : 'No'}`);
      });
      
      return areas;
    } else {
      console.error('❌ Error al obtener áreas:', data.error || 'Error desconocido');
      return [];
    }
  } catch (error) {
    console.error('❌ Error en la petición para obtener áreas:', error.message);
    return [];
  }
}

// Eliminar un área
async function deleteArea(area) {
  try {
    const isPredefined = area.isDefault === true;
    console.log(`\n🔹 Eliminando área ${isPredefined ? 'predefinida' : 'manual'}: ${area.name} (${area._id})...`);
    
    const response = await fetch(`${API_BASE_URL}/areas/${area._id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Guardar la respuesta completa para análisis
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { success: false, error: { message: 'Respuesta no es JSON válido' } };
    }
    
    console.log(`ℹ️ Status: ${response.status} ${response.statusText}`);
    console.log(`ℹ️ Headers:`, Object.fromEntries([...response.headers]));
    console.log(`ℹ️ Respuesta completa:`, responseText);
    
    if (response.status === 200 && data.success) {
      console.log(`✅ Área eliminada correctamente`);
      return true;
    } else if (response.status === 404) {
      console.error(`❌ Error 404: Área no encontrada`);
      return false;
    } else {
      console.error(`❌ Error al eliminar área:`, data.error || 'Error desconocido');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error en la petición para eliminar área:`, error.message);
    return false;
  }
}

// Verificar si un área existe
async function checkAreaExists(areaId) {
  try {
    console.log(`\n🔹 Verificando si el área ${areaId} existe...`);
    
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 200) {
      console.log(`✅ El área existe y está activa`);
      return true;
    } else if (response.status === 404) {
      console.log(`ℹ️ El área no existe o está inactiva`);
      return false;
    } else {
      const data = await response.json();
      console.log(`ℹ️ Status: ${response.status}, Mensaje: ${data.error?.message || 'Desconocido'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error al verificar existencia del área:`, error.message);
    return false;
  }
}

// Función principal para ejecutar las pruebas
async function runTests() {
  console.log('🔶 INICIANDO PRUEBAS DE ELIMINACIÓN DE ÁREAS 🔶');
  
  // 1. Hacer login
  token = await login();
  if (!token) {
    console.error('❌ No se pudo obtener token. Abortando pruebas.');
    return;
  }
  
  // 2. Obtener la lista actual de áreas
  const areasIniciales = await getAreas('todas');
  
  // 3. Crear un área predefinida y un área manual
  const areasPredefinidas = await createDefaultAreas();
  const areaPredefinida = areasPredefinidas.length > 0 ? areasPredefinidas[0] : null;
  
  const areaManual = await createManualArea();
  
  if (!areaPredefinida && !areaManual) {
    console.error('❌ No se pudo crear ningún área para pruebas. Abortando.');
    return;
  }
  
  // 4. Verificar que ambas áreas existen
  if (areaPredefinida) {
    await checkAreaExists(areaPredefinida._id);
  }
  
  if (areaManual) {
    await checkAreaExists(areaManual._id);
  }
  
  // 5. Intentar eliminar el área predefinida
  let eliminacionPredefinidaExitosa = false;
  if (areaPredefinida) {
    eliminacionPredefinidaExitosa = await deleteArea(areaPredefinida);
    await checkAreaExists(areaPredefinida._id);
  }
  
  // 6. Intentar eliminar el área manual
  let eliminacionManualExitosa = false;
  if (areaManual) {
    eliminacionManualExitosa = await deleteArea(areaManual);
    await checkAreaExists(areaManual._id);
  }
  
  // 7. Resumen
  console.log('\n🔶 RESUMEN DE LAS PRUEBAS 🔶');
  if (areaPredefinida) {
    console.log(`Área predefinida: ${eliminacionPredefinidaExitosa ? '✅ Eliminada correctamente' : '❌ Error al eliminar'}`);
  } else {
    console.log('No se pudo crear o encontrar un área predefinida para pruebas');
  }
  
  if (areaManual) {
    console.log(`Área manual: ${eliminacionManualExitosa ? '✅ Eliminada correctamente' : '❌ Error al eliminar'}`);
  } else {
    console.log('No se pudo crear un área manual para pruebas');
  }
  
  console.log('\n🔶 FIN DE LAS PRUEBAS 🔶');
}

// Ejecutar las pruebas
runTests().catch(err => {
  console.error('❌ Error general en las pruebas:', err);
}); 