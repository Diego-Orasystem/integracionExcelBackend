# Gestión de Roles y Permisos

## Matriz de Roles y Permisos

El sistema implementa una matriz de roles y permisos simplificada con 4 roles principales:

| Rol | Descripción |
|-----|-------------|
| Administrador de Aplicación | Control total sobre el sistema |
| Administrador de Compañía | Control sobre una compañía específica |
| Usuario - Control | Monitorea actividades y archivos en su área |
| Usuario - Responsable | Responsable de gestionar subáreas |

## Permisos por Funcionalidad

La siguiente matriz muestra los permisos asignados a cada rol:

| Funcionalidad / Permiso | Administrador (Aplicación) | Administrador de Compañía | Usuario - Control | Usuario - Responsable |
|-------------------------|----------------------------|---------------------------|-------------------|----------------------|
| Gestión de Usuarios | Completo | Solo de su compañía | No | No |
| Gestión de Compañías | Completo | No | No | No |
| Gestión de Áreas | Completo | Crear, Editar, Eliminar | No | No |
| Gestión de Subáreas | Completo | Crear, Editar, Eliminar | No | No |
| Asignación de Responsables | Completo | Solo en su compañía | No | No |
| Archivos - Lectura | Todos | De su compañía | De su área | De sus subáreas |
| Archivos - Escritura | Todos | De su compañía | No | De sus subáreas |
| Archivos - Eliminación | Todos | De su compañía | No | De sus subáreas |
| Monitoreo de Archivos | Todos | De su compañía | De su área | De sus subáreas |

## Implementación Técnica

### Estructura de Datos

#### Permisos
Los permisos están organizados por categorías:
- **Usuario**: Permisos relacionados con la gestión de usuarios
- **Compañía**: Permisos relacionados con la gestión de compañías
- **Área**: Permisos relacionados con la gestión de áreas
- **Subárea**: Permisos relacionados con la gestión de subáreas
- **Archivo**: Permisos relacionados con la gestión de archivos
- **Sistema**: Permisos relacionados con la configuración del sistema

Cada permiso tiene:
- Nombre descriptivo
- Código único
- Categoría
- Acciones permitidas (create, read, update, delete, list, etc.)

#### Roles
Cada rol tiene:
- Nombre descriptivo
- Código único
- Lista de permisos asociados
- Indicador de si es un rol del sistema
- Compañía asociada (para roles específicos de una compañía)

### Inicialización de Roles y Permisos

Para inicializar los roles y permisos en la base de datos:

```bash
npm run init-roles
```

Este comando ejecuta un script que crea todos los permisos y roles predefinidos según la matriz.

### Verificación de Permisos

El sistema incluye métodos para verificar si un usuario tiene un permiso específico:

```javascript
// Verificar si un rol tiene un permiso
const hasPermission = await role.hasPermission('permission_code');

// Verificar si un rol tiene un permiso con una acción específica
const canPerform = await role.hasPermissionWithAction('permission_code', 'action');
```

## Asignación de Roles a Usuarios

Los usuarios pueden tener múltiples roles asignados, cada uno con:
- Rol base
- Compañía asociada
- Área asociada (opcional)
- Subárea asociada (opcional)
- Permisos adicionales específicos (opcional)
- Permisos denegados específicos (opcional)

## Flujo de Autorización

1. El usuario se autentica y recibe un token JWT
2. Al acceder a un recurso, el middleware de autorización verifica:
   - Si el usuario tiene un rol con el permiso necesario
   - Si el permiso aplica al contexto (compañía, área, subárea)
   - Si hay permisos adicionales o denegados que afecten la autorización

## API de Roles y Permisos

### Endpoints de Permisos
- `GET /api/permissions` - Listar permisos
- `GET /api/permissions/:id` - Ver detalle de un permiso
- `POST /api/permissions` - Crear un nuevo permiso (solo Admin)
- `PUT /api/permissions/:id` - Actualizar un permiso (solo Admin)
- `DELETE /api/permissions/:id` - Desactivar un permiso (solo Admin)
- `POST /api/permissions/defaults` - Crear permisos predefinidos (solo Admin)

### Endpoints de Roles
- `GET /api/roles` - Listar roles
- `GET /api/roles/:id` - Ver detalle de un rol
- `POST /api/roles` - Crear un nuevo rol (solo Admin)
- `PUT /api/roles/:id` - Actualizar un rol (solo Admin)
- `DELETE /api/roles/:id` - Desactivar un rol (solo Admin)

### Endpoints de Asignación de Roles
- `GET /api/user-roles/user/:userId` - Ver roles de un usuario
- `POST /api/user-roles` - Asignar rol a usuario
- `PUT /api/user-roles/:id` - Modificar asignación
- `DELETE /api/user-roles/:id` - Revocar asignación 