const http = require('http');
const fs = require('fs');

// Token para la autenticación - actualizado con el token generado
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MThkMTUxZTA1NzQyM2ZmYzBhZWViNiIsInJvbGUiOiJjb21wYW55X2FkbWluIiwiY29tcGFueUlkIjoiNjgxOGQxNTBlMDU3NDIzZmZjMGFlZWFmIiwiaWF0IjoxNzQ2Nzc1NTY5LCJleHAiOjE3NDY4NjE5Njl9.TVnLoGetw_-p1rl4tZUsIHFdyh8KSBcBBMZYKcmlhVA';

// Opciones para la solicitud
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/files/area-stats',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

console.log('Iniciando solicitud a /api/files/area-stats');

// Realizar la solicitud
const req = http.request(options, (res) => {
  console.log(`Código de estado: ${res.statusCode}`);
  console.log('Cabeceras:', JSON.stringify(res.headers, null, 2));
  
  // Recopilar los fragmentos de datos
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Finalizar y mostrar la respuesta completa
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('Datos recibidos correctamente como JSON');
      
      if (jsonData.success) {
        console.log('Success: true');
        console.log('Estructura de datos disponible:', Object.keys(jsonData.data).join(', '));
        
        // Guardar la respuesta a un archivo para análisis detallado
        fs.writeFileSync('response_area_stats.json', JSON.stringify(jsonData, null, 2));
        console.log('Respuesta completa guardada en response_area_stats.json');
      } else {
        console.log('Error en la respuesta:', jsonData.error);
      }
    } catch (e) {
      console.log('Error al parsear respuesta como JSON:', e.message);
      console.log('Datos recibidos (primeros 300 caracteres):', data.substring(0, 300));
    }
  });
});

// Manejar errores
req.on('error', (e) => {
  console.error(`Problema con la solicitud: ${e.message}`);
});

// Enviar la solicitud
req.end(); 