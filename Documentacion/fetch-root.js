const http = require('http');

// Opciones para la solicitud
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/',
  method: 'GET'
};

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
    console.log('Respuesta completa:');
    console.log(data);
  });
});

// Manejar errores
req.on('error', (e) => {
  console.error(`Problema con la solicitud: ${e.message}`);
});

// Enviar la solicitud
req.end(); 