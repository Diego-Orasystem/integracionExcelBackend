# Backend del Sistema de Gestión de Archivos Excel

Este es el backend para el sistema de gestión de archivos Excel con funcionalidades multi-empresa, gestión de carpetas, carga de archivos Excel e integración SFTP.

## Tecnologías

- **Node.js**: Entorno de ejecución
- **Express**: Framework web
- **MongoDB**: Base de datos
- **Mongoose**: ODM para MongoDB
- **JWT**: Autenticación basada en tokens
- **Multer**: Manejo de subida de archivos
- **SSH2-SFTP-Client**: Cliente SFTP
- **ExcelJS**: Procesamiento de archivos Excel

## Estructura del Proyecto

```
src/
├── controllers/     # Controladores para cada entidad
├── models/          # Modelos de datos
├── routes/          # Definición de rutas
├── middlewares/     # Middlewares personalizados
├── services/        # Servicios (SFTP, procesamiento, etc.)
├── utils/           # Utilidades
└── server.js        # Punto de entrada
```

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:
   ```
   npm install
   ```
3. Configurar variables de entorno (crear archivo `.env` basado en `.env.example`)
4. Iniciar el servidor:
   ```
   npm run dev
   ```

## Funcionalidades Principales

- **Autenticación**: Sistema completo con JWT
- **Empresas**: Soporte multi-empresa con separación de datos
- **Usuarios**: Diferentes roles (admin, admin_empresa, usuario)
- **Carpetas**: Estructura jerárquica de carpetas
- **Archivos**: Carga, descarga y gestión de archivos Excel
- **SFTP**: Integración con servidores SFTP para carga automática
- **Logs**: Registro detallado de todas las actividades

## Endpoints API

La documentación completa de la API se encuentra en `../estructura_apis.md`

### Principales Endpoints:

#### Autenticación
- `POST /api/auth/login`: Iniciar sesión
- `GET /api/auth/me`: Información del usuario actual

#### Carpetas
- `GET /api/folders`: Listar carpetas
- `POST /api/folders`: Crear carpeta
- `DELETE /api/folders/:id`: Eliminar carpeta

#### Archivos
- `POST /api/files/upload`: Subir archivo
- `GET /api/files`: Listar archivos en carpeta
- `GET /api/files/:id/download`: Descargar archivo

#### SFTP
- `POST /api/sftp/sync`: Sincronizar archivos SFTP
- `GET /api/sftp/jobs`: Listar trabajos de sincronización

## Configuración SFTP

El sistema permite configurar conexiones SFTP por empresa. Los archivos se sincronizarán según la configuración y se procesarán automáticamente.

## Seguridad

- Todas las contraseñas se almacenan con hash
- Autenticación mediante JWT
- Separación de datos por empresa
- Validación de permisos en cada operación 

## Pruebas Automatizadas

El proyecto incluye un conjunto completo de pruebas automatizadas para verificar el correcto funcionamiento del sistema:

### Comandos de Prueba

```bash
# Ejecutar todas las pruebas
npm run test

# Ejecutar solo pruebas unitarias
npm run test:unit

# Ejecutar solo pruebas de integración
npm run test:integration

# Ejecutar solo pruebas de roles y permisos
npm run test:roles

# Generar datos de prueba para el MVP
npm run generate-test-data
```

### Tipos de Pruebas

- **Pruebas Unitarias**: Verifican el funcionamiento correcto de los controladores individuales
- **Pruebas de Integración**: Comprueban la interacción entre diferentes componentes del sistema
- **Pruebas de Roles y Permisos**: Validan el sistema de control de acceso basado en roles

### Documentación de Pruebas

Para obtener más información sobre las pruebas automatizadas, consulte:

- `flujos-prueba-mvp.md`: Guía de flujos de prueba manuales para el MVP
- `test-pruebas-automatizadas.html`: Documentación detallada de las pruebas automatizadas

Los resultados de las pruebas se guardan en la carpeta `test-results/` incluyendo:
- Archivos JSON con resultados detallados
- Un informe HTML con visualización de resultados 