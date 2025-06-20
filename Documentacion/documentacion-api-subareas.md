# Documentación de la API de Subáreas

Esta documentación describe todos los endpoints disponibles para la gestión de subáreas en el sistema.

## Requisitos de autenticación

Todos los endpoints requieren autenticación mediante un token JWT válido. El token debe enviarse en todas las peticiones con el siguiente formato:

```
Authorization: Bearer {token}
```

Para obtener un token, primero debe iniciar sesión utilizando el endpoint de login:

- **URL**: `/api/auth/login`
- **Método**: `POST`
- **Cuerpo de la petición**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "contraseña"
  }
  ```
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "123456789",
        "name": "Nombre Usuario",
        "email": "usuario@ejemplo.com",
        "role": "admin",
        "companyId": "987654321"
      }
    }
  }
  ```

## Endpoints de Subáreas

### 1. Listar todas las subáreas

Obtiene un listado de todas las subáreas disponibles para el usuario actual.

- **URL**: `/api/subareas`
- **Método**: `GET`
- **Parámetros de consulta**:
  - `companyId` (opcional): Filtrar subáreas por ID de compañía (solo disponible para administradores)
  - `areaId` (opcional): Filtrar subáreas por ID de área
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "count": 3,
    "data": [
      {
        "_id": "123456789",
        "name": "Contabilidad",
        "description": "Gestión contable",
        "areaId": {
          "_id": "987654321",
          "name": "Finanzas"
        },
        "companyId": {
          "_id": "567891234",
          "name": "Mi Empresa"
        },
        "icon": "subfolder",
        "order": 0,
        "active": true,
        "folderId": "456789123",
        "requiredFiles": [],
        "sampleFiles": []
      },
      {...},
      {...}
    ]
  }
  ```

### 2. Obtener una subárea por ID

Obtiene los detalles de una subárea específica mediante su ID.

- **URL**: `/api/subareas/:id`
- **Método**: `GET`
- **Parámetros de ruta**:
  - `id`: ID de la subárea a consultar
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Contabilidad",
      "description": "Gestión contable",
      "areaId": {
        "_id": "987654321",
        "name": "Finanzas"
      },
      "companyId": {
        "_id": "567891234",
        "name": "Mi Empresa"
      },
      "responsibleUserId": {
        "_id": "234567891",
        "name": "Responsable",
        "email": "resp@ejemplo.com"
      },
      "icon": "subfolder",
      "order": 0,
      "active": true,
      "folderId": "456789123",
      "requiredFiles": [
        {
          "name": "Informe mensual",
          "description": "Informe de actividad mensual",
          "required": true
        }
      ],
      "sampleFiles": []
    }
  }
  ```
- **Respuesta de error** (cuando la subárea no existe):
  ```json
  {
    "success": false,
    "error": {
      "code": "SUBAREA_NOT_FOUND",
      "message": "Subárea no encontrada"
    }
  }
  ```

### 3. Crear una subárea nueva

Crea una nueva subárea en el sistema, asociada a un área específica.

- **URL**: `/api/areas/:areaId/subareas`
- **Método**: `POST`
- **Parámetros de ruta**:
  - `areaId`: ID del área a la que pertenecerá la subárea
- **Cuerpo de la petición**:
  ```json
  {
    "name": "Nueva Subárea",
    "description": "Descripción de la subárea",
    "icon": "subfolder",
    "responsibleUserId": "123456789", // Opcional
    "requiredFiles": [
      {
        "name": "Documento requerido",
        "description": "Descripción del documento",
        "required": true
      }
    ] // Opcional
  }
  ```
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Nueva Subárea",
      "description": "Descripción de la subárea",
      "areaId": "987654321",
      "companyId": "567891234",
      "responsibleUserId": "123456789",
      "icon": "subfolder",
      "order": 0,
      "active": true,
      "folderId": "456789123",
      "requiredFiles": [
        {
          "name": "Documento requerido",
          "description": "Descripción del documento",
          "required": true
        }
      ],
      "sampleFiles": []
    }
  }
  ```
- **Respuesta de error** (cuando ya existe una subárea con el mismo nombre en esa área):
  ```json
  {
    "success": false,
    "error": {
      "code": "SUBAREA_NAME_EXISTS",
      "message": "Ya existe una subárea con ese nombre en esta área"
    }
  }
  ```

### 4. Crear una subárea (ruta alternativa)

También es posible crear subáreas directamente desde el endpoint de subáreas.

- **URL**: `/api/subareas`
- **Método**: `POST`
- **Cuerpo de la petición**:
  ```json
  {
    "name": "Nueva Subárea",
    "description": "Descripción de la subárea",
    "areaId": "987654321", // Obligatorio en esta ruta
    "icon": "subfolder",
    "responsibleUserId": "123456789", // Opcional
    "requiredFiles": [
      {
        "name": "Documento requerido",
        "description": "Descripción del documento",
        "required": true
      }
    ] // Opcional
  }
  ```
- **Respuesta exitosa**: Similar a la del endpoint anterior

### 5. Actualizar una subárea

Actualiza la información de una subárea existente.

- **URL**: `/api/subareas/:id`
- **Método**: `PUT`
- **Parámetros de ruta**:
  - `id`: ID de la subárea a actualizar
- **Cuerpo de la petición**:
  ```json
  {
    "name": "Nombre Actualizado",
    "description": "Nueva descripción",
    "icon": "updated-icon",
    "areaId": "234567891", // Opcional, para cambiar de área
    "responsibleUserId": "345678912", // Opcional
    "requiredFiles": [
      {
        "name": "Nuevo documento requerido",
        "description": "Nueva descripción",
        "required": true
      }
    ] // Opcional
  }
  ```
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Nombre Actualizado",
      "description": "Nueva descripción",
      "areaId": "234567891",
      "companyId": "567891234",
      "responsibleUserId": "345678912",
      "icon": "updated-icon",
      "order": 0,
      "active": true,
      "folderId": "456789123",
      "requiredFiles": [
        {
          "name": "Nuevo documento requerido",
          "description": "Nueva descripción",
          "required": true
        }
      ],
      "sampleFiles": []
    }
  }
  ```

### 6. Eliminar una subárea

Elimina una subárea específica del sistema (marcándola como inactiva).

- **URL**: `/api/subareas/:id`
- **Método**: `DELETE`
- **Parámetros de ruta**:
  - `id`: ID de la subárea a eliminar
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 7. Crear subáreas predefinidas para un área

Crea un conjunto de subáreas predefinidas para un área específica.

- **URL**: `/api/areas/:areaId/subareas/default`
- **Método**: `POST`
- **Parámetros de ruta**:
  - `areaId`: ID del área para la que se crearán las subáreas
- **Cuerpo de la petición**: No requiere cuerpo
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "123456789",
        "name": "Subárea predefinida 1",
        "description": "...",
        "areaId": "987654321",
        "companyId": "567891234"
      },
      {
        "_id": "123456790",
        "name": "Subárea predefinida 2",
        "description": "...",
        "areaId": "987654321",
        "companyId": "567891234"
      },
      // Más subáreas predefinidas...
    ]
  }
  ```

### 8. Gestionar archivos de ejemplo

#### 8.1. Obtener archivos de ejemplo

Obtiene los archivos de ejemplo asociados a una subárea.

- **URL**: `/api/subareas/:id/sample-files`
- **Método**: `GET`
- **Parámetros de ruta**:
  - `id`: ID de la subárea
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "123456789",
        "name": "Ejemplo.xlsx",
        "originalName": "Ejemplo.xlsx",
        "path": "/uploads/examples/example1.xlsx",
        "size": 12345,
        "createdAt": "2025-05-05T10:30:00.000Z"
      },
      {...}
    ]
  }
  ```

#### 8.2. Añadir archivo de ejemplo

Añade un nuevo archivo de ejemplo a una subárea.

- **URL**: `/api/subareas/:id/sample-files`
- **Método**: `POST`
- **Parámetros de ruta**:
  - `id`: ID de la subárea
- **Cuerpo de la petición**: Formulario multipart con el archivo
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Ejemplo.xlsx",
      "originalName": "Ejemplo.xlsx",
      "path": "/uploads/examples/example1.xlsx",
      "size": 12345,
      "createdAt": "2025-05-05T10:30:00.000Z"
    }
  }
  ```

#### 8.3. Eliminar archivo de ejemplo

Elimina un archivo de ejemplo de una subárea.

- **URL**: `/api/subareas/:id/sample-files/:fileId`
- **Método**: `DELETE`
- **Parámetros de ruta**:
  - `id`: ID de la subárea
  - `fileId`: ID del archivo a eliminar
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

## Ejemplos de uso con curl

### Listar todas las subáreas:

```bash
curl -X GET \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/subareas
```

### Obtener una subárea específica por ID:

```bash
curl -X GET \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/subareas/{id}
```

### Crear una subárea nueva:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"name":"Nueva Subárea","description":"Descripción de la subárea","icon":"subfolder"}' \
  http://localhost:5000/api/areas/{areaId}/subareas
```

### Actualizar una subárea:

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"name":"Nombre Actualizado","description":"Nueva descripción","icon":"updated"}' \
  http://localhost:5000/api/subareas/{id}
```

### Eliminar una subárea:

```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/subareas/{id}
```

### Crear subáreas predefinidas para un área:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{}' \
  http://localhost:5000/api/areas/{areaId}/subareas/default
```

## Códigos de error comunes

| Código | Descripción |
|--------|-------------|
| `AUTH_ERROR` | No está autorizado para acceder a este recurso |
| `PERMISSION_DENIED` | No tiene permisos para realizar esta acción |
| `SUBAREA_NOT_FOUND` | Subárea no encontrada |
| `AREA_NOT_FOUND` | Área no encontrada |
| `SUBAREA_NAME_EXISTS` | Ya existe una subárea con ese nombre en esta área |
| `INVALID_ID` | El ID de la subárea tiene un formato inválido |
| `MISSING_NAME` | El nombre de la subárea es obligatorio |
| `MISSING_AREA_ID` | El ID del área es obligatorio |
| `SERVER_ERROR` | Error interno del servidor |

## Consideraciones importantes

1. Todos los endpoints requieren un token JWT válido.
2. Los usuarios solo pueden ver y modificar subáreas de su propia compañía, excepto los administradores que pueden ver todas.
3. Al crear o actualizar una subárea, si no se proporciona un `responsibleUserId`, se utilizará el responsable del área padre o el ID del usuario actual.
4. Las operaciones de eliminación son lógicas (soft delete), lo que significa que las subáreas se marcan como inactivas pero no se eliminan de la base de datos.
5. Al crear una subárea, automáticamente se crea una carpeta asociada en el sistema de archivos, subordinada a la carpeta del área padre.
6. Los archivos de ejemplo se almacenan físicamente en el servidor y pueden ser descargados por los usuarios con acceso a la subárea. 