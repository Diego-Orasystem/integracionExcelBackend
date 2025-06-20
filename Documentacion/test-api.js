const http = require('http');
const fs = require('fs');

// Token más reciente - podría necesitar actualizarse si ha expirado
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MWRhN2YwNDRlM2QyMzFmYzk3NmQxOSIsInJvbGUiOiJjb21wYW55X2FkbWluIiwiY29tcGFueUlkIjoiNjgxZGEzOGExZTUzNDM3ODUzMzliMGI2IiwiaWF0IjoxNzE1OTA1NTIwLCJleHAiOjE3MTU5OTE5MjB9.lWBByZdIQz_zEQmcGMmJbSkUfY1WPcD9Nc4aEy2ZkR4';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    console.log(`\nRealizando solicitud a ${path}...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== RESPUESTA DE ${path} ===`);
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        
        try {
          // Intentar parsearlo como JSON
          const jsonData = JSON.parse(data);
          console.log('Datos recibidos correctamente como JSON');
          
          if (jsonData.success === false && jsonData.error) {
            console.log('Error recibido:', jsonData.error);
          } else if (jsonData.success === true) {
            console.log('Success: true');
            
            // Mostrar un resumen de los datos
            if (jsonData.data) {
              console.log('Estructura de datos disponible:', Object.keys(jsonData.data).join(', '));
              
              // Guardar la respuesta a un archivo para análisis detallado
              const filename = `response_${path.replace(/\//g, '_')}.json`;
              fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2));
              console.log(`Respuesta completa guardada en ${filename}`);
            }
          } else {
            console.log('Respuesta (primeros 300 caracteres):', JSON.stringify(jsonData).substring(0, 300) + '...');
          }
          
          resolve(jsonData);
        } catch (e) {
          console.log('Error al parsear respuesta como JSON:', e.message);
          console.log('Datos recibidos (primeros 300 caracteres):', data.substring(0, 300));
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('Error en la solicitud:', e.message);
      reject(e);
    });
    
    req.end();
  });
}

// Probar la ruta de métricas
makeRequest('/api/files/metrics')
  .then(() => makeRequest('/api/files/area-stats'))
  .then(() => {
    console.log('\n--- Terminadas todas las solicitudes ---');
  })
  .catch(error => {
    console.error('Error en alguna de las solicitudes:', error);
  }); 