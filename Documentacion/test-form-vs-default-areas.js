const fetch = require('node-fetch');

// Configuración
const API_BASE_URL = 'http://localhost:5000/api';
let token = null;
let areaFormularioId = null;
let areaPredefinidaId = null;

// Función para hacer login y obtener token
async function login() {
  try {
    console.log('Iniciando sesión como administrador...');
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

// 1. Crear un área mediante formulario (similar a como lo haría el usuario)
async function crearAreaPorFormulario() {
  try {
    console.log('\n🔹 Creando área mediante formulario (simulando frontend)...');
    
    // Datos que se enviarían desde un formulario web
    const formData = {
      name: `Área Formulario ${Date.now()}`,
      description: 'Esta área fue creada mediante formulario web',
      icon: 'folder',
      color: '#FF5722',
      // No enviamos isDefault porque normalmente el formulario no lo incluiría
    };
    
    console.log('Datos del formulario:', formData);
    
    const response = await fetch(`${API_BASE_URL}/areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data) {
      console.log('✅ Área creada correctamente mediante formulario');
      console.log('ID:', data.data._id);
      console.log('Nombre:', data.data.name);
      console.log('¿Es predefinida?', data.data.isDefault ? 'Sí' : 'No');
      areaFormularioId = data.data._id;
      return data.data;
    } else {
      console.error('❌ Error al crear el área por formulario:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear área por formulario:', error.message);
    return null;
  }
}

// 2. Crear un área predefinida
async function crearAreaPredefinida() {
  try {
    console.log('\n🔹 Creando área predefinida...');
    
    const response = await fetch(`${API_BASE_URL}/areas/default`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`✅ Áreas predefinidas creadas: ${data.data.length}`);
      // Tomar la primera área creada para las pruebas
      const areaPredefinida = data.data[0];
      console.log('ID:', areaPredefinida._id);
      console.log('Nombre:', areaPredefinida.name);
      console.log('¿Es predefinida?', areaPredefinida.isDefault ? 'Sí' : 'No');
      areaPredefinidaId = areaPredefinida._id;
      return areaPredefinida;
    } else if (response.status === 500) {
      console.log('ℹ️ Las áreas predefinidas ya existen. Obteniendo áreas existentes...');
      // Obtener áreas existentes y seleccionar una predefinida
      const areas = await obtenerAreas();
      const areasPredefinidas = areas.filter(area => area.isDefault === true);
      
      if (areasPredefinidas.length > 0) {
        const areaPredefinida = areasPredefinidas[0];
        console.log('ID:', areaPredefinida._id);
        console.log('Nombre:', areaPredefinida.name);
        console.log('¿Es predefinida?', areaPredefinida.isDefault ? 'Sí' : 'No');
        areaPredefinidaId = areaPredefinida._id;
        return areaPredefinida;
      } else {
        console.error('❌ No se encontraron áreas predefinidas');
        return null;
      }
    } else {
      console.error('❌ Error al crear áreas predefinidas:', data.error || 'Error desconocido');
      return null;
    }
  } catch (error) {
    console.error('❌ Error en la petición para crear áreas predefinidas:', error.message);
    return null;
  }
}

// 3. Obtener todas las áreas
async function obtenerAreas() {
  try {
    console.log('\n🔹 Obteniendo lista de áreas...');
    
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
      
      // Informar cuántas áreas son predefinidas y cuántas son manuales
      const areasPredefinidas = data.data.filter(area => area.isDefault === true);
      const areasManual = data.data.filter(area => !area.isDefault);
      
      console.log(`- Áreas predefinidas: ${areasPredefinidas.length}`);
      console.log(`- Áreas por formulario: ${areasManual.length}`);
      
      // Mostrar detalles de cada área
      console.log('\nListado de áreas:');
      data.data.forEach(area => {
        console.log(`- ${area.name} (${area._id}) - Predefinida: ${area.isDefault ? 'Sí' : 'No'}`);
      });
      
      return data.data;
    } else {
      console.error('❌ Error al obtener áreas:', data.error || 'Error desconocido');
      return [];
    }
  } catch (error) {
    console.error('❌ Error en la petición para obtener áreas:', error.message);
    return [];
  }
}

// 4. Eliminar un área específica
async function eliminarArea(areaId, esPredefinida) {
  try {
    console.log(`\n🔹 Eliminando área ${esPredefinida ? 'predefinida' : 'de formulario'}: ${areaId}...`);
    
    // Hacer la petición exactamente como lo haría el frontend
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Capturar la respuesta completa para análisis
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { success: false, error: { message: 'Respuesta no es JSON válido' } };
    }
    
    console.log(`ℹ️ Status: ${response.status} ${response.statusText}`);
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

// 5. Verificar si un área existe
async function verificarAreaExiste(areaId) {
  try {
    console.log(`\n🔹 Verificando si el área ${areaId} existe...`);
    
    const response = await fetch(`${API_BASE_URL}/areas/${areaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`✅ El área existe y está activa`);
      console.log(`Detalles: ${data.data.name} - Predefinida: ${data.data.isDefault ? 'Sí' : 'No'}`);
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

// 6. Función principal para ejecutar las pruebas
async function ejecutarPruebas() {
  console.log('🔶 INICIANDO PRUEBAS ESPECIALIZADAS DE ELIMINACIÓN DE ÁREAS 🔶');
  
  // 1. Hacer login
  token = await login();
  if (!token) {
    console.error('❌ No se pudo obtener token. Abortando pruebas.');
    return;
  }
  
  // 2. Ver áreas iniciales
  await obtenerAreas();
  
  // 3. Crear un área mediante formulario
  const areaFormulario = await crearAreaPorFormulario();
  
  // 4. Crear o seleccionar un área predefinida
  const areaPredefinida = await crearAreaPredefinida();
  
  if (!areaFormulario || !areaPredefinida) {
    console.error('❌ No se pudo crear al menos una de las áreas necesarias. Abortando...');
    return;
  }
  
  // 5. Verificar áreas actuales
  await obtenerAreas();
  
  // 6. Verificar existencia específica de ambas áreas
  await verificarAreaExiste(areaFormularioId);
  await verificarAreaExiste(areaPredefinidaId);
  
  // 7. Eliminar el área predefinida
  let eliminacionPredefinidaExitosa = false;
  if (areaPredefinidaId) {
    eliminacionPredefinidaExitosa = await eliminarArea(areaPredefinidaId, true);
    // Verificar si realmente se eliminó
    const existeDespuesDeEliminar = await verificarAreaExiste(areaPredefinidaId);
    if (eliminacionPredefinidaExitosa && existeDespuesDeEliminar) {
      console.log('⚠️ ADVERTENCIA: El área predefinida sigue apareciendo después de eliminarla');
    } else if (eliminacionPredefinidaExitosa && !existeDespuesDeEliminar) {
      console.log('✅ Confirmado: El área predefinida fue eliminada correctamente');
    }
  }
  
  // 8. Eliminar el área de formulario
  let eliminacionFormularioExitosa = false;
  if (areaFormularioId) {
    eliminacionFormularioExitosa = await eliminarArea(areaFormularioId, false);
    // Verificar si realmente se eliminó
    const existeDespuesDeEliminar = await verificarAreaExiste(areaFormularioId);
    if (eliminacionFormularioExitosa && existeDespuesDeEliminar) {
      console.log('⚠️ ADVERTENCIA: El área de formulario sigue apareciendo después de eliminarla');
    } else if (eliminacionFormularioExitosa && !existeDespuesDeEliminar) {
      console.log('✅ Confirmado: El área de formulario fue eliminada correctamente');
    }
  }
  
  // 9. Verificar áreas finales
  await obtenerAreas();
  
  // 10. Resumen
  console.log('\n🔶 RESUMEN DE LAS PRUEBAS 🔶');
  console.log(`Área predefinida: ${eliminacionPredefinidaExitosa ? '✅ Eliminada' : '❌ Error al eliminar'}`);
  console.log(`Área por formulario: ${eliminacionFormularioExitosa ? '✅ Eliminada' : '❌ Error al eliminar'}`);
  
  console.log('\n🔶 FIN DE LAS PRUEBAS 🔶');
}

// Ejecutar las pruebas
ejecutarPruebas().catch(err => {
  console.error('❌ Error general en las pruebas:', err);
}); 