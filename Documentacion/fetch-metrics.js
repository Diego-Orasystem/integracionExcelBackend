const http = require('http');

// Token para la autenticación - actualizado con el token generado
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MThkMTUxZTA1NzQyM2ZmYzBhZWViNiIsInJvbGUiOiJjb21wYW55X2FkbWluIiwiY29tcGFueUlkIjoiNjgxOGQxNTBlMDU3NDIzZmZjMGFlZWFmIiwiaWF0IjoxNzQ2Nzc1NTY5LCJleHAiOjE3NDY4NjE5Njl9.TVnLoGetw_-p1rl4tZUsIHFdyh8KSBcBBMZYKcmlhVA';

// Opciones para la solicitud
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/files/metrics',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

console.log('Iniciando solicitud a /api/files/metrics');

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