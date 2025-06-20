# Guía de Pruebas para el MVP de Visualización de Estado de Archivos

Este documento resume los pasos para verificar que el MVP de la visualización tipo rompecabezas para el monitoreo de archivos funciona correctamente.

## Preparación del Entorno

1. **Configuración de la Base de Datos**
   - Asegurarse de que MongoDB está en ejecución
   - Verificar que la conexión en `.env` apunta a la base de datos correcta:
     ```
     MONGO_URI=mongodb://localhost:27017/excel-manager
     ```

2. **Generar Datos de Prueba**
   - Ejecutar el script de generación de datos:
     ```
     node src/scripts/test-data-generator.js
     ```
   - Verificar que se muestran mensajes de éxito en consola para:
     - Creación de empresa de prueba
     - Creación de usuario de prueba
     - Creación de carpetas de prueba
     - Creación de archivos de prueba con diferentes estados

3. **Iniciar el Servidor de Prueba**
   - Ejecutar el servidor de prueba:
     ```
     npm run test-server
     ```
   - Verificar que el servidor inicia en el puerto 5002
   - Comprobar que el mensaje "Servidor de prueba corriendo en el puerto 5002" aparece en consola

## Verificación de la API

1. **Endpoint de Estado de Archivos**
   - Acceder a: `http://localhost:5002/api/files/status`
   - Verificar que devuelve estadísticas generales en formato JSON
   - Comprobar que incluye conteos para: pendientes, procesando, procesados, errores

2. **Endpoint de Estado con Agrupación**
   - Probar con diferentes agrupaciones:
     - `http://localhost:5002/api/files/status?groupBy=folder`
     - `http://localhost:5002/api/files/status?groupBy=date`
     - `http://localhost:5002/api/files/status?groupBy=type`
   - Verificar que cada agrupación muestra los datos organizados correctamente

3. **Endpoint de Métricas**
   - Acceder a: `http://localhost:5002/api/files/metrics`
   - Verificar que devuelve:
     - Objeto `stats` con estadísticas generales
     - Array `puzzleItems` con elementos para la visualización
   - Probar con filtros de tiempo:
     - `http://localhost:5002/api/files/metrics?timeFrame=week`
     - `http://localhost:5002/api/files/metrics?timeFrame=month`

## Prueba de la Interfaz de Usuario

1. **Visualización del Rompecabezas**
   - Abrir en el navegador: `test-puzzle-visualization.html`
   - Verificar que se cargan:
     - Estadísticas generales
     - Visualización de rompecabezas con elementos de colores según estado

2. **Funcionalidad de Filtros**
   - Probar el selector "groupBy":
     - Seleccionar "Por Carpeta" y verificar que se actualiza la visualización
     - Seleccionar "Por Fecha" y verificar que se actualiza la visualización
     - Seleccionar "Por Tipo" y verificar que se actualiza la visualización
   - Probar el selector "timeFrame":
     - Seleccionar "Última semana" y verificar que se filtran los datos
     - Seleccionar "Último mes" y verificar que se filtran los datos
     - Seleccionar "Todo el tiempo" y verificar que se muestran todos los datos

3. **Interactividad**
   - Hacer clic en un elemento del rompecabezas y verificar que se muestran los detalles
   - Probar el botón "Actualizar" y verificar que refresca los datos
   - Probar los botones de prueba:
     - "Cargar Datos": Debe actualizar la visualización
     - "Generar Archivos": Simulación de generación de nuevos archivos
     - "Limpiar Datos": Debe limpiar la visualización

## Validación Funcional

1. **Verificar la Claridad Visual**
   - Los elementos deben ser claramente distinguibles por color según su estado:
     - Pendiente: Amarillo
     - Procesando: Azul
     - Procesado: Verde
     - Error: Rojo
   - El tamaño de los elementos debe reflejar su importancia relativa
   - La visualización debe ser responsive y adaptarse a diferentes tamaños de pantalla

2. **Verificar el Rendimiento**
   - La carga inicial debe completarse en menos de 2 segundos
   - Las actualizaciones al cambiar filtros deben ser fluidas
   - La interacción con los elementos debe ser responsiva

3. **Verificar la Coherencia de Datos**
   - Las estadísticas mostradas deben coincidir con los elementos visualizados
   - Los filtros deben aplicarse correctamente sin errores
   - Los detalles mostrados al hacer clic en un elemento deben ser correctos

## Lista de Verificación Final

- [ ] El script de generación de datos funciona correctamente
- [ ] El servidor de prueba inicia sin errores
- [ ] La API de estado devuelve datos estructurados correctamente
- [ ] La API de métricas proporciona datos para la visualización
- [ ] La visualización de rompecabezas carga y muestra los elementos
- [ ] Los filtros funcionan correctamente
- [ ] La interacción con los elementos muestra los detalles esperados
- [ ] La claridad visual es adecuada y comunica eficazmente el estado
- [ ] El rendimiento es aceptable para un MVP

## Ejecución de Tests Automatizados

Para verificar el funcionamiento del sistema, se han implementado varios scripts de prueba:

1. **Pruebas Unitarias**
   - Ejecutar: `npm run test:unit`
   - Estas pruebas verifican el funcionamiento correcto de los controladores
   - Comprueban que los datos devueltos tengan la estructura esperada
   - Verifican el manejo de casos de error

2. **Pruebas de Integración**
   - Ejecutar: `npm run test:integration`
   - Verifican la interacción entre componentes del sistema
   - Prueban la comunicación entre la API, base de datos y servidor
   - Validan la consistencia de datos entre diferentes partes

3. **Pruebas de Roles y Permisos**
   - Ejecutar: `npm run test:roles`
   - Comprueban que el sistema de roles y permisos funcione correctamente
   - Verifican que solo usuarios autorizados puedan acceder a ciertas funciones
   - Validan la estructura de datos para soportar permisos por área/subárea

4. **Todas las Pruebas**
   - Ejecutar: `npm run test`
   - Ejecuta todas las pruebas anteriores y genera un informe unificado
   - Crea un reporte HTML con resultados detallados en la carpeta `test-results`

Los resultados de las pruebas se guardan en la carpeta `test-results` y pueden revisarse posteriormente.

## Notas para Futuras Mejoras

- Implementar filtros adicionales (por usuario, por tamaño, etc.)
- Añadir más interactividad a los elementos del rompecabezas
- Mejorar la visualización con animaciones y transiciones
- Implementar vistas alternativas (gráficos, tablas, etc.)
- Añadir funcionalidad para generar informes basados en los datos
- Optimizar el rendimiento para conjuntos de datos más grandes
- Ampliar cobertura de pruebas automatizadas
- Implementar pruebas end-to-end con Cypress o Playwright 