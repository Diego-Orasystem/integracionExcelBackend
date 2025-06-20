const http = require('http');

// Opciones para la solicitud
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/test-token',
  method: 'GET'
};

console.log('Obteniendo token de prueba...');

// Realizar la solicitud
const req = http.request(options, (res) => {
  console.log(`Código de estado: ${res.statusCode}`);
  
  // Recopilar los fragmentos de datos
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // Finalizar y mostrar la respuesta completa
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.success && response.token) {
        console.log('\nToken generado correctamente:');
        console.log(response.token);
        console.log('\nGuarda este token para usar en tus pruebas.');
      } else {
        console.log('Respuesta inesperada:');
        console.log(data);
      }
    } catch (e) {
      console.error('Error al procesar la respuesta:', e.message);
      console.log('Datos recibidos:', data);
    }
  });
});

// Manejar errores
req.on('error', (e) => {
  console.error(`Problema con la solicitud: ${e.message}`);
});

// Enviar la solicitud
req.end(); 