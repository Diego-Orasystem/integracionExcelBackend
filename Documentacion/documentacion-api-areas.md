# Documentación de la API de Áreas

Esta documentación describe todos los endpoints disponibles para la gestión de áreas en el sistema.

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

## Endpoints de Áreas

### 1. Listar todas las áreas

Obtiene un listado de todas las áreas disponibles para el usuario actual.

- **URL**: `/api/areas`
- **Método**: `GET`
- **Parámetros de consulta**:
  - `companyId` (opcional): Filtrar áreas por ID de compañía (solo disponible para administradores)
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "count": 3,
    "data": [
      {
        "_id": "123456789",
        "name": "Finanzas",
        "description": "Área de finanzas",
        "companyId": {
          "_id": "987654321",
          "name": "Mi Empresa"
        },
        "icon": "folder",
        "color": "#3498db",
        "active": true,
        "folderId": "567891234"
      },
      {...},
      {...}
    ]
  }
  ```

### 2. Obtener un área por ID

Obtiene los detalles de un área específica mediante su ID.

- **URL**: `/api/areas/:id`
- **Método**: `GET`
- **Parámetros de ruta**:
  - `id`: ID del área a consultar
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Finanzas",
      "description": "Área de finanzas",
      "companyId": {
        "_id": "987654321",
        "name": "Mi Empresa"
      },
      "icon": "folder",
      "color": "#3498db",
      "active": true,
      "folderId": "567891234"
    }
  }
  ```
- **Respuesta de error** (cuando el área no existe):
  ```json
  {
    "success": false,
    "error": {
      "code": "AREA_NOT_FOUND",
      "message": "Área no encontrada"
    }
  }
  ```

### 3. Crear un área nueva

Crea una nueva área en el sistema.

- **URL**: `/api/areas`
- **Método**: `POST`
- **Cuerpo de la petición**:
  ```json
  {
    "name": "Nueva Área",
    "description": "Descripción del área",
    "icon": "folder",
    "color": "#ff5733",
    "responsibleUserId": "123456789" // Opcional
  }
  ```
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "123456789",
      "name": "Nueva Área",
      "description": "Descripción del área",
      "companyId": "987654321",
      "icon": "folder",
      "color": "#ff5733",
      "active": true,
      "folderId": "567891234",
      "responsibleUserId": "123456789"
    }
  }
  ```
- **Respuesta de error** (cuando ya existe un área con el mismo nombre):
  ```json
  {
    "success": false,
    "error": {
      "code": "AREA_NAME_EXISTS",
      "message": "Ya existe un área con ese nombre en esta compañía"
    }
  }
  ```

### 4. Actualizar un área

Actualiza la información de un área existente.

- **URL**: `/api/areas/:id`
- **Método**: `PUT`
- **Parámetros de ruta**:
  - `id`: ID del área a actualizar
- **Cuerpo de la petición**:
  ```json
  {
    "name": "Nombre Actualizado",
    "description": "Nueva descripción",
    "icon": "updated-icon",
    "color": "#33ff57",
    "responsibleUserId": "567891234" // Opcional
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
      "companyId": "987654321",
      "icon": "updated-icon",
      "color": "#33ff57",
      "active": true,
      "folderId": "567891234",
      "responsibleUserId": "567891234"
    }
  }
  ```

### 5. Eliminar un área

Elimina un área específica del sistema (marcándola como inactiva).

- **URL**: `/api/areas/:id`
- **Método**: `DELETE`
- **Parámetros de ruta**:
  - `id`: ID del área a eliminar
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": {}
  }
  ```

### 6. Crear áreas predefinidas

Crea un conjunto de áreas predefinidas para la compañía del usuario.

- **URL**: `/api/areas/default`
- **Método**: `POST`
- **Cuerpo de la petición**:
  ```json
  {
    "companyId": "987654321" // Opcional, si no se proporciona usará la compañía del usuario
  }
  ```
- **Respuesta exitosa**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "123456789",
        "name": "Finanzas",
        "description": "...",
        "companyId": "987654321"
      },
      {
        "_id": "123456790",
        "name": "Recursos Humanos",
        "description": "...",
        "companyId": "987654321"
      },
      // Más áreas predefinidas...
    ]
  }
  ```

## Ejemplos de uso con curl

### Iniciar sesión para obtener un token:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sistema.com","password":"Admin123456"}' \
  http://localhost:5000/api/auth/login
```

### Listar todas las áreas:

```bash
curl -X GET \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/areas
```

### Obtener un área específica por ID:

```bash
curl -X GET \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/areas/{id}
```

### Crear un área nueva:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"name":"Nueva Área","description":"Descripción del área","icon":"folder","color":"#ff5733"}' \
  http://localhost:5000/api/areas
```

### Actualizar un área:

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"name":"Nombre Actualizado","description":"Nueva descripción","icon":"updated","color":"#33ff57"}' \
  http://localhost:5000/api/areas/{id}
```

### Eliminar un área:

```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/areas/{id}
```

### Crear áreas predefinidas:

```bash     
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{}' \
  http://localhost:5000/api/areas/default
```

## Códigos de error comunes

| Código | Descripción |
|--------|-------------|
| `AUTH_ERROR` | No está autorizado para acceder a este recurso |
| `PERMISSION_DENIED` | No tiene permisos para realizar esta acción |
| `AREA_NOT_FOUND` | Área no encontrada |
| `AREA_NAME_EXISTS` | Ya existe un área con ese nombre en esta compañía |
| `INVALID_ID` | El ID del área tiene un formato inválido |
| `MISSING_NAME` | El nombre del área es obligatorio |
| `SERVER_ERROR` | Error interno del servidor |

## Consideraciones importantes

1. Todos los endpoints requieren un token JWT válido.
2. Los usuarios solo pueden ver y modificar áreas de su propia compañía, excepto los administradores que pueden ver todas.
3. Al crear o actualizar un área, si no se proporciona un `responsibleUserId`, se utilizará el ID del usuario actual.
4. Las operaciones de eliminación son lógicas (soft delete), lo que significa que las áreas se marcan como inactivas pero no se eliminan de la base de datos.
5. Al crear un área, automáticamente se crea una carpeta asociada en el sistema de archivos. 