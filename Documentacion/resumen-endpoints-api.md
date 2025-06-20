# Resumen de Endpoints de la API

Este documento proporciona un resumen de los principales endpoints disponibles para la gestión de áreas y subáreas en el sistema.

## Requisitos de autenticación

Todos los endpoints requieren un token JWT válido enviado en el encabezado `Authorization: Bearer {token}`.

## Endpoints de Áreas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/areas` | Listar todas las áreas |
| `GET` | `/api/areas/:id` | Obtener un área específica por ID |
| `POST` | `/api/areas` | Crear un área nueva |
| `PUT` | `/api/areas/:id` | Actualizar un área existente |
| `DELETE` | `/api/areas/:id` | Eliminar un área |
| `POST` | `/api/areas/default` | Crear áreas predefinidas |

## Ejemplos de uso de Áreas

### Crear un área nueva:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Nueva Área",
    "description": "Descripción del área",
    "icon": "folder",
    "color": "#ff5733"
  }' \
  http://localhost:5000/api/areas
```

### Actualizar un área:

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Nombre Actualizado",
    "description": "Nueva descripción",
    "icon": "updated",
    "color": "#33ff57"
  }' \
  http://localhost:5000/api/areas/{id}
```

## Endpoints de Subáreas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/subareas` | Listar todas las subáreas |
| `GET` | `/api/subareas/:id` | Obtener una subárea específica por ID |
| `POST` | `/api/areas/:areaId/subareas` | Crear una subárea nueva (asociada a un área) |
| `POST` | `/api/subareas` | Crear una subárea (ruta alternativa) |
| `PUT` | `/api/subareas/:id` | Actualizar una subárea existente |
| `DELETE` | `/api/subareas/:id` | Eliminar una subárea |
| `POST` | `/api/areas/:areaId/subareas/default` | Crear subáreas predefinidas para un área |
| `GET` | `/api/subareas/:id/sample-files` | Obtener archivos de ejemplo de una subárea |
| `POST` | `/api/subareas/:id/sample-files` | Añadir archivo de ejemplo a una subárea |
| `DELETE` | `/api/subareas/:id/sample-files/:fileId` | Eliminar archivo de ejemplo de una subárea |

## Ejemplos de uso de Subáreas

### Crear una subárea nueva:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Nueva Subárea",
    "description": "Descripción de la subárea",
    "icon": "subfolder"
  }' \
  http://localhost:5000/api/areas/{areaId}/subareas
```

### Actualizar una subárea:

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Nombre Actualizado",
    "description": "Nueva descripción",
    "icon": "updated"
  }' \
  http://localhost:5000/api/subareas/{id}
```

## Códigos de estado HTTP

| Código | Descripción |
|--------|-------------|
| `200` | OK - La solicitud se ha completado correctamente |
| `201` | Created - Se ha creado un nuevo recurso |
| `400` | Bad Request - Error en la solicitud (formato inválido, datos faltantes) |
| `401` | Unauthorized - No se ha proporcionado autenticación o es inválida |
| `403` | Forbidden - Autenticado pero sin permisos para acceder al recurso |
| `404` | Not Found - El recurso solicitado no existe |
| `500` | Internal Server Error - Error en el servidor |

## Solución de problemas comunes

1. **Error 401 (No autorizado)**: Asegurarse de incluir el token JWT en el encabezado de la solicitud con el formato correcto.

2. **Error 400 (ID inválido)**: Verificar que el ID proporcionado tenga el formato correcto (ObjectId de MongoDB).

3. **Error 404 (Recurso no encontrado)**: Comprobar que el ID del recurso existe y pertenece a la compañía del usuario.

4. **Error 403 (Prohibido)**: El usuario no tiene permisos suficientes para realizar la acción (solo admin o admin de compañía pueden crear áreas).

5. **Error 500 (Error del servidor)**: Error interno en el servidor. Verificar los logs para más detalles. 