# API

La API expone sus endpoints bajo el prefijo `/api/v1`.

- **Autenticación:** Bearer JWT via cabecera `Authorization`.
- **Cabeceras comunes:** `Content-Type: application/json`, `Accept: application/json`.
- Para subir archivos usar `multipart/form-data`.

## Índice
- [Auth](#auth)
- [Users](#users)
- [Roles](#roles)
- [Paginas](#paginas)
- [Documents](#documents)
- [AI](#ai)

## Auth

| Método | Ruta | Auth/Guards | Body DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| POST  | /auth/signup | none | CreateUserDto | - | `{access_token, refresh_token}` | 400 Usuario ya existe |
| POST  | /auth/login  | none | LoginDto | - | `{ok: true}` (cookies) | 401 Credenciales inválidas |
| POST  | /auth/refresh| none | - | cookies | `{ok: true}` (cookies) | 401 Token inválido |
| POST  | /auth/logout | none | - | - | 204 sin cuerpo | - |

### POST /auth/signup
Registra un nuevo usuario y devuelve tokens.

**Body:**
```
{
  "primer_nombre": "string",
  "primer_apellido": "string",
  "correo_institucional": "string",
  "codigo_empleado": "string",
  "password": "string"
}
```
**Respuesta:**
```
{
  "access_token": "string",
  "refresh_token": "string"
}
```
**curl**
```
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"primer_nombre":"Ana","primer_apellido":"Pérez","correo_institucional":"ana@correo.com","codigo_empleado":"EMP1","password":"secreta"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/auth/signup', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({primer_nombre:'Ana',primer_apellido:'Pérez',correo_institucional:'ana@correo.com',codigo_empleado:'EMP1',password:'secreta'})
});
```

### POST /auth/login
Inicia sesión, emite cookies de acceso y refresh.

**Body:**
```
{
  "email": "string",
  "password": "string"
}
```
**Respuesta:** `{ "ok": true }`

**curl**
```
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@correo.com","password":"secreta"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({email:'ana@correo.com',password:'secreta'})
});
```

### POST /auth/refresh
Regenera tokens a partir de la cookie de refresh.

**Respuesta:** `{ "ok": true }`

**curl**
```
curl -X POST http://localhost:3000/api/v1/auth/refresh --cookie "refresh_token=TOKEN"
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/auth/refresh', {method:'POST', credentials:'include'});
```

### POST /auth/logout
Limpia las cookies de autenticación.

**curl**
```
curl -X POST http://localhost:3000/api/v1/auth/logout
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/auth/logout', {method:'POST'});
```

## Users

| Método | Ruta | Auth/Guards | Body DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| POST | /users | none | CreateUserDto | - | Usuario creado | 400 Datos inválidos |
| GET | /users | none | - | - | Lista de usuarios | - |
| GET | /users/me | JwtAuthGuard | - | - | MeResponseDto | 401 No autorizado |
| GET | /users/:id | none | - | id | Usuario | 404 No encontrado |
| PATCH | /users/:id | none | UpdateUserDto | id | Usuario actualizado | 404 No encontrado |
| DELETE | /users/:id | none | - | id | Usuario eliminado | 404 No encontrado |

### POST /users
Crea un usuario.

**Body:** igual que `CreateUserDto`.

**curl**
```
curl -X POST http://localhost:3000/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"primer_nombre":"Ana","primer_apellido":"Pérez","correo_institucional":"ana@correo.com","codigo_empleado":"EMP1","password":"secreta"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({primer_nombre:'Ana',primer_apellido:'Pérez',correo_institucional:'ana@correo.com',codigo_empleado:'EMP1',password:'secreta'})
});
```

### GET /users
Devuelve usuarios activos con campos básicos.

**curl**
```
curl http://localhost:3000/api/v1/users
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users');
```

### GET /users/me
Requiere JWT. Devuelve perfil propio con páginas y roles.

**curl**
```
curl http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users/me',{headers:{Authorization:'Bearer TOKEN'}});
```

### GET /users/:id
Obtiene usuario por id.

**curl**
```
curl http://localhost:3000/api/v1/users/1
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users/1');
```

### PATCH /users/:id
Actualiza campos.

**curl**
```
curl -X PATCH http://localhost:3000/api/v1/users/1 \
  -H 'Content-Type: application/json' \
  -d '{"primer_nombre":"Nuevo"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users/1',{
  method:'PATCH',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({primer_nombre:'Nuevo'})
});
```

### DELETE /users/:id
Elimina usuario.

**curl**
```
curl -X DELETE http://localhost:3000/api/v1/users/1
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/users/1',{method:'DELETE'});
```

## Roles

| Método | Ruta | Auth/Guards | Body DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| GET | /roles | JwtAuthGuard | - | `all` | Lista de roles | - |
| POST | /roles | JwtAuthGuard | CreateRolDto | - | Rol creado | 409 Nombre duplicado |
| PATCH | /roles/:id | JwtAuthGuard | UpdateRolDto | id | Rol actualizado | 404 No encontrado |
| GET | /roles/:id/paginas | JwtAuthGuard | - | id | `{paginaIds: number[]}` | 404 Rol inexistente |
| PUT | /roles/:id/paginas | JwtAuthGuard | `{paginaIds:number[]}` | id | `{paginaIds:number[]}` | 400 Páginas inválidas |
| DELETE | /roles/:id | JwtAuthGuard | - | id | Rol desactivado | 404 No encontrado |
| PATCH | /roles/:id/restore | JwtAuthGuard | - | id | Rol reactivado | 404 No encontrado |

### GET /roles
Lista roles; `all=1` para incluir inactivos.

**curl**
```
curl http://localhost:3000/api/v1/roles -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles',{headers:{Authorization:'Bearer TOKEN'}});
```

### POST /roles
Crea un rol.

**Body:**
```
{
  "nombre":"string",
  "descripcion?":"string",
  "activo?":true,
  "created_by?":1
}
```
**curl**
```
curl -X POST http://localhost:3000/api/v1/roles \
 -H 'Authorization: Bearer TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"nombre":"Admin"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer TOKEN'},body:JSON.stringify({nombre:'Admin'})});
```

### PATCH /roles/:id
Actualiza un rol.

**curl**
```
curl -X PATCH http://localhost:3000/api/v1/roles/1 \
 -H 'Authorization: Bearer TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"descripcion":"Nuevo"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles/1',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer TOKEN'},body:JSON.stringify({descripcion:'Nuevo'})});
```

### GET /roles/:id/paginas
Obtiene ids de páginas del rol.

**curl**
```
curl http://localhost:3000/api/v1/roles/1/paginas -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles/1/paginas',{headers:{Authorization:'Bearer TOKEN'}});
```

### PUT /roles/:id/paginas
Reemplaza páginas del rol.

**Body:** `{ "paginaIds": [1,2] }`

**curl**
```
curl -X PUT http://localhost:3000/api/v1/roles/1/paginas \
 -H 'Authorization: Bearer TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"paginaIds":[1,2]}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles/1/paginas',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer TOKEN'},body:JSON.stringify({paginaIds:[1,2]})});
```

### DELETE /roles/:id
Desactiva un rol.

**curl**
```
curl -X DELETE http://localhost:3000/api/v1/roles/1 -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles/1',{method:'DELETE',headers:{Authorization:'Bearer TOKEN'}});
```

### PATCH /roles/:id/restore
Restaura un rol.

**curl**
```
curl -X PATCH http://localhost:3000/api/v1/roles/1/restore -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/roles/1/restore',{method:'PATCH',headers:{Authorization:'Bearer TOKEN'}});
```

## Paginas

| Método | Ruta | Auth/Guards | Body DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| GET | /paginas | JwtAuthGuard | - | `all` | Lista de páginas | - |
| POST | /paginas | JwtAuthGuard | CreatePaginaDto | - | Página creada | 409 Nombre duplicado |
| PATCH | /paginas/:id | JwtAuthGuard | UpdatePaginaDto | id | Página actualizada | 404 No encontrada |
| DELETE | /paginas/:id | JwtAuthGuard | - | id | Página desactivada | 404 No encontrada |
| PATCH | /paginas/:id/restore | JwtAuthGuard | - | id | Página reactivada | 404 No encontrada |

### GET /paginas
Listado de páginas; `all=1` para incluir inactivas.

**curl**
```
curl http://localhost:3000/api/v1/paginas -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/paginas',{headers:{Authorization:'Bearer TOKEN'}});
```

### POST /paginas
Crea una página.

**Body:**
```
{
 "nombre":"string",
 "url":"string",
 "descripcion?":"string",
 "activo?":true
}
```
**curl**
```
curl -X POST http://localhost:3000/api/v1/paginas \
 -H 'Authorization: Bearer TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"nombre":"Inicio","url":"/inicio"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/paginas',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer TOKEN'},body:JSON.stringify({nombre:'Inicio',url:'/inicio'})});
```

### PATCH /paginas/:id
Actualiza una página.

**curl**
```
curl -X PATCH http://localhost:3000/api/v1/paginas/1 \
 -H 'Authorization: Bearer TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"descripcion":"Nueva"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/paginas/1',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer TOKEN'},body:JSON.stringify({descripcion:'Nueva'})});
```

### DELETE /paginas/:id
Desactiva una página.

**curl**
```
curl -X DELETE http://localhost:3000/api/v1/paginas/1 -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/paginas/1',{method:'DELETE',headers:{Authorization:'Bearer TOKEN'}});
```

### PATCH /paginas/:id/restore
Restaura una página.

**curl**
```
curl -X PATCH http://localhost:3000/api/v1/paginas/1/restore -H 'Authorization: Bearer TOKEN'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/paginas/1/restore',{method:'PATCH',headers:{Authorization:'Bearer TOKEN'}});
```

## Documents

| Método | Ruta | Auth/Guards | Body/DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| POST | /documents | - | file `file` | - | `{fileKey}` | 500 Error de carga |
| POST | /documents/cuadro-firmas/firmar | - | file `file`, FirmaCuadroDto | - | `{status,data}` | 400 Orden inválido |
| PATCH | /documents/cuadro-firmas/documento/:id | - | file `file`, idUser, observaciones | id | `{status,data}` | 500 Error al actualizar |
| POST | /documents/analyze-pdf-test | - | file `files` | - | Texto del PDF | 400 Error |
| POST | /documents/plantilla | - | CreatePlantillaDto | - | `{status,data}` | 400 Plantilla existe |
| GET | /documents/cuadro-firmas/documento-url | - | - | fileName | `{status,data}` | 404 No existe |
| GET | /documents/cuadro-firmas/:id | - | - | id | Detalle de cuadro de firmas | 404 No existe |
| POST | /documents/cuadro-firmas | - | file `file`, CreateCuadroFirmaDto, responsables | - | `{status,data}` | 500 Error |
| POST | /documents/cuadro-firmas/historial | - | AddHistorialCuadroFirmaDto | - | `{status,data}` | 400 Error |
| GET | /documents/estados-firma | - | - | - | Lista de estados | - |
| GET | /documents/cuadro-firmas/historial/:id | - | - | id + paginación | `{status,data}` | 400 Error |
| GET | /documents/cuadro-firmas/firmantes/:id | - | - | id | `{status,data}` | 400 Error |
| GET | /documents/cuadro-firmas/by-user/:userId | - | - | userId + paginación | `{status,data}` | 400 Sin asignaciones |
| GET | /documents/cuadro-firmas/documentos/supervision | - | - | paginación | `{status,data}` | 400 Sin registros |
| PATCH | /documents/cuadro-firmas/estado | - | UpdateEstadoAsignacionDto | - | `{status,data}` | 400 Error |
| PATCH | /documents/cuadro-firmas/:id | - | UpdateCuadroFirmaDto + responsables | id | `{status,data}` | 400 Error |

(Se omiten algunos campos repetitivos por brevedad.)

Cada endpoint admite ejemplos similares; se muestran algunos representativos:

### POST /documents
Sube un PDF al bucket.

**curl**
```
curl -X POST http://localhost:3000/api/v1/documents \
  -F 'file=@/ruta/doc.pdf'
```
**fetch**
```js
const fd=new FormData();
fd.append('file',fileInput.files[0]);
await fetch('http://localhost:3000/api/v1/documents',{method:'POST',body:fd});
```

### POST /documents/cuadro-firmas/firmar
Firma un documento usando imagen.

**curl**
```
curl -X POST http://localhost:3000/api/v1/documents/cuadro-firmas/firmar \
 -F 'file=@firma.png' \
 -F 'userId=1' -F 'nombreUsuario=Ana Perez' -F 'cuadroFirmaId=10' \
 -F 'responsabilidadId=3' -F 'nombreResponsabilidad=Aprueba'
```
**fetch**
```js
const fd=new FormData();
fd.append('file',sigFile);
fd.append('userId','1');
fd.append('nombreUsuario','Ana Perez');
fd.append('cuadroFirmaId','10');
fd.append('responsabilidadId','3');
fd.append('nombreResponsabilidad','Aprueba');
await fetch('http://localhost:3000/api/v1/documents/cuadro-firmas/firmar',{method:'POST',body:fd});
```

### PATCH /documents/cuadro-firmas/estado
Actualiza el estado de una asignación.

**Body:**
```
{
  "idCuadroFirma":1,
  "idEstadoFirma":2,
  "nombreEstadoFirma":"En Progreso",
  "idUser":1,
  "nombreUser":"Ana",
  "observaciones":"Firmado"
}
```
**curl**
```
curl -X PATCH http://localhost:3000/api/v1/documents/cuadro-firmas/estado \
 -H 'Content-Type: application/json' \
 -d '{"idCuadroFirma":1,"idEstadoFirma":2,"nombreEstadoFirma":"En Progreso","idUser":1,"nombreUser":"Ana","observaciones":"Firmado"}'
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/documents/cuadro-firmas/estado',{
  method:'PATCH',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({idCuadroFirma:1,idEstadoFirma:2,nombreEstadoFirma:'En Progreso',idUser:1,nombreUser:'Ana',observaciones:'Firmado'})
});
```

(Otros endpoints siguen patrones similares combinando `FormData` y JSON según el DTO indicado.)

## AI

| Método | Ruta | Auth/Guards | Body DTO | Query/Params | Respuesta | Códigos de error |
|-------|------|-------------|----------|--------------|-----------|------------------|
| GET | /ai | none | - | - | "findAll()" | - |

### GET /ai
Retorna string de prueba.

**curl**
```
curl http://localhost:3000/api/v1/ai
```
**fetch**
```js
await fetch('http://localhost:3000/api/v1/ai');
```

