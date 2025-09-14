# API

La API expone sus endpoints bajo el prefijo `/api/v1`.

## A) Tabla resumen

| Grupo/Controlador | Nombre método | HTTP | Ruta completa | Auth | Query | Path Params | Body (tipo) | Form-Data parts | Respuestas | Notas |
|---|---|---|---|---|---|---|---|---|---|---|
| App | getHello | GET | /api/v1 | none | - | - | - | - | 200 string | - |
| Auth | signup | POST | /api/v1/auth/signup | none | - | - | CreateUserDto | - | 201 tokens | Crea usuario (Prisma) |
| Auth | login | POST | /api/v1/auth/login | none | - | - | LoginDto | - | 200 `{ok}` | Emite cookies JWT |
| Auth | refresh | POST | /api/v1/auth/refresh | none | - | - | - | - | 200 `{ok}` | Lee cookie refresh |
| Auth | logout | POST | /api/v1/auth/logout | none | - | - | - | - | 204 vacío | Borra cookies |
| Users | create | POST | /api/v1/users | none | - | - | CreateUserDto | - | 201 user | Prisma user.create |
| Users | findAll | GET | /api/v1/users | none | - | - | - | - | 200 lista | Prisma user.findMany |
| Users | me | GET | /api/v1/users/me | JwtAuthGuard | - | - | - | - | 200 MeResponseDto | Obtiene páginas/roles |
| Users | findOne | GET | /api/v1/users/:id | none | - | id:number | - | - | 200 user | Prisma user.findUnique |
| Users | update | PATCH | /api/v1/users/:id | none | - | id:number | UpdateUserDto | - | 200 user | Prisma user.update |
| Users | remove | DELETE | /api/v1/users/:id | none | - | id:number | - | - | 200 user | Prisma user.delete |
| Roles | findAll | GET | /api/v1/roles | JwtAuthGuard | all? | - | - | - | 200 lista | Prisma rol.findMany |
| Roles | create | POST | /api/v1/roles | JwtAuthGuard | - | - | CreateRolDto | - | 201 rol | Prisma rol.create |
| Roles | update | PATCH | /api/v1/roles/:id | JwtAuthGuard | - | id:number | UpdateRolDto | - | 200 rol | Prisma rol.update |
| Roles | getPages | GET | /api/v1/roles/:id/paginas | JwtAuthGuard | - | id:number | - | - | 200 `{paginaIds}` | Valida rol activo |
| Roles | setPages | PUT | /api/v1/roles/:id/paginas | JwtAuthGuard | - | id:number | `{paginaIds:number[]}` | - | 200 `{paginaIds}` | Tx pagina_rol + auditoria |
| Roles | remove | DELETE | /api/v1/roles/:id | JwtAuthGuard | - | id:number | - | - | 200 rol | Marca activo=false |
| Roles | restore | PATCH | /api/v1/roles/:id/restore | JwtAuthGuard | - | id:number | - | - | 200 rol | Marca activo=true |
| Paginas | findAll | GET | /api/v1/paginas | JwtAuthGuard | all? | - | - | - | 200 lista | Prisma pagina.findMany |
| Paginas | create | POST | /api/v1/paginas | JwtAuthGuard | - | - | CreatePaginaDto | - | 201 pagina | Prisma pagina.create |
| Paginas | update | PATCH | /api/v1/paginas/:id | JwtAuthGuard | - | id:number | UpdatePaginaDto | - | 200 pagina | Prisma pagina.update |
| Paginas | remove | DELETE | /api/v1/paginas/:id | JwtAuthGuard | - | id:number | - | - | 200 pagina | Activo=false |
| Paginas | restore | PATCH | /api/v1/paginas/:id/restore | JwtAuthGuard | - | id:number | - | - | 200 pagina | Activo=true |
| Documents | create | POST | /api/v1/documents | none | - | - | - | file:file | 201 `{status,data}` | Sube PDF a S3 |
| Documents | signDocumentTest | POST | /api/v1/documents/cuadro-firmas/firmar | none | - | - | FirmaCuadroDto | file:file | 200 `{status,data}` | Firma PDF, actualiza cuadro |
| Documents | updateDocumentoAsignacion | PATCH | /api/v1/documents/cuadro-firmas/documento/:id | none | - | id:number | idUser,observaciones | file:file | 200 `{status,data}` | Sube PDF y registra historial |
| Documents | analyzePDFTest | POST | /api/v1/documents/analyze-pdf-test | none | - | - | - | files:files | 200 texto | Extrae texto PDF |
| Documents | generarPlantilla | POST | /api/v1/documents/plantilla | none | - | - | CreatePlantillaDto | - | 201 `{status,data}` | Genera plantilla Prisma |
| Documents | getDocumentoURLBucket | GET | /api/v1/documents/cuadro-firmas/documento-url | none | fileName | - | - | - | 200 URL | Presigned S3 |
| Documents | findCuadroFirmas | GET | /api/v1/documents/cuadro-firmas/:id | none | - | id:number | - | - | 200 detalle | S3 presigned + Prisma |
| Documents | guardarCuadroFirmas | POST | /api/v1/documents/cuadro-firmas | none | - | - | CreateCuadroFirmaDto + responsables | file:file | 201 cuadro | Guarda PDF, historial |
| Documents | agregarHistorialCuadroFirma | POST | /api/v1/documents/cuadro-firmas/historial | none | - | - | AddHistorialCuadroFirmaDto | - | 201 `{registro}` | Inserta historial |
| Documents | getAllEstadosFirma | GET | /api/v1/documents/estados-firma | none | - | - | - | - | 200 lista | Prisma estado_firma |
| Documents | getHistorialCuadroFirmas | GET | /api/v1/documents/cuadro-firmas/historial/:id | none | page,limit | id:number | - | - | 200 historial | Prisma historial |
| Documents | getUsuariosFirmantesCuadroFirmas | GET | /api/v1/documents/cuadro-firmas/firmantes/:id | none | - | id:number | - | - | 200 firmantes | Prisma cuadro_firma_user |
| Documents | getAsignacionesByUserId | GET | /api/v1/documents/cuadro-firmas/by-user/:userId | none | page,limit | userId:number | - | - | 200 asignaciones | Prisma filtro por usuario |
| Documents | getSupervisionDocumentos | GET | /api/v1/documents/cuadro-firmas/documentos/supervision | none | page,limit | - | - | - | 200 documentos | Prisma supervisión |
| Documents | cambiarEstadoAsignacion | PATCH | /api/v1/documents/cuadro-firmas/estado | none | - | - | UpdateEstadoAsignacionDto | - | 200 `{status,data}` | Actualiza estado + historial |
| Documents | updateCuadroFirmas | PATCH | /api/v1/documents/cuadro-firmas/:id | none | - | id:number | UpdateCuadroFirmaDto + responsables | multipart | 200 `{status,data}` | Actualiza cuadro y responsables |
| AI | findAll | GET | /api/v1/ai | none | - | - | - | - | 200 string | endpoint de prueba |

## B) Detalle por endpoint

### AppController
#### GET /api/v1 – AppController#getHello
- **Auth:** ninguna
- **Respuesta:** `200` texto simple.

### AuthController
#### POST /api/v1/auth/signup – signup
- **Auth:** ninguna
- **Body (JSON CreateUserDto):**
  - primer_nombre, primer_apellido, correo_institucional, codigo_empleado, password – `string` obligatorios.
- **Respuesta:** `201` `{access_token, refresh_token}`.
- **Efectos:** crea usuario (`prisma.user.create`).

#### POST /api/v1/auth/login – login
- **Body (LoginDto):** email `string`, password `string` obligatorios.
- **Respuesta:** `200` `{ok: true}` y establece cookies JWT.

#### POST /api/v1/auth/refresh – refresh
- **Cookies:** `refresh_token`.
- **Respuesta:** `200` `{ok: true}` nuevas cookies.

#### POST /api/v1/auth/logout – logout
- **Respuesta:** `204` sin cuerpo, limpia cookies.

### UsersController
#### POST /api/v1/users – create
- **Body (CreateUserDto):** campos string obligatorios, password almacenada con hash.
- **Respuesta:** `201` usuario creado.

#### GET /api/v1/users – findAll
- **Respuesta:** `200` lista de `{id, primer_nombre, correo_institucional, activo}`.

#### GET /api/v1/users/me – me
- **Auth:** `JwtAuthGuard` (Bearer).
- **Respuesta:** `200` `{id, nombre, correo, pages[], roles[]}`.

#### GET /api/v1/users/:id – findOne
- **Path:** `id` número requerido.
- **Respuesta:** `200` usuario o `null`.

#### PATCH /api/v1/users/:id – update
- **Path:** `id` número requerido.
- **Body (UpdateUserDto):** mismos campos que CreateUserDto opcionales.
- **Respuesta:** `200` usuario actualizado.

#### DELETE /api/v1/users/:id – remove
- **Path:** `id` número requerido.
- **Respuesta:** `200` usuario eliminado.

### RolesController
*(todos requieren `JwtAuthGuard`)*

#### GET /api/v1/roles – findAll
- **Query:** `all` (`"1"` para incluir inactivos, opcional).
- **Respuesta:** `200` lista de roles.

#### POST /api/v1/roles – create
- **Body (CreateRolDto):** nombre `string` requerido, descripcion `string` opcional, activo `boolean` opcional, created_by `number` opcional.
- **Respuesta:** `201` rol creado.

#### PATCH /api/v1/roles/:id – update
- **Path:** `id` número requerido.
- **Body (UpdateRolDto):** campos de CreateRolDto opcionales.
- **Respuesta:** `200` rol actualizado.

#### GET /api/v1/roles/:id/paginas – getPages
- **Path:** `id` número requerido.
- **Respuesta:** `200` `{paginaIds:number[]}`.

#### PUT /api/v1/roles/:id/paginas – setPages
- **Path:** `id` número.
- **Body:** `{paginaIds:number[]}`.
- **Respuesta:** `200` ids asignados.
- **Efectos:** transacción `pagina_rol` y `auditoria`.

#### DELETE /api/v1/roles/:id – remove
- **Path:** `id` número.
- **Respuesta:** `200` rol desactivado (`activo=false`).

#### PATCH /api/v1/roles/:id/restore – restore
- **Path:** `id` número.
- **Respuesta:** `200` rol activado.

### PaginasController
*(todos requieren `JwtAuthGuard`)*

#### GET /api/v1/paginas – findAll
- **Query:** `all` (`"1"` para incluir inactivas).
- **Respuesta:** `200` lista de páginas.

#### POST /api/v1/paginas – create
- **Body (CreatePaginaDto):** nombre y url `string` obligatorios; descripcion `string` y activo `boolean` opcionales.
- **Respuesta:** `201` página creada.

#### PATCH /api/v1/paginas/:id – update
- **Path:** `id` número.
- **Body (UpdatePaginaDto):** campos de CreatePaginaDto opcionales.
- **Respuesta:** `200` página actualizada.

#### DELETE /api/v1/paginas/:id – remove
- **Path:** `id` número.
- **Respuesta:** `200` página desactivada.

#### PATCH /api/v1/paginas/:id/restore – restore
- **Path:** `id` número.
- **Respuesta:** `200` página restaurada.

### DocumentsController
*(sin guardas, expone operaciones críticas sin autenticación)*

#### POST /api/v1/documents – create
- **Form-Data:** archivo `file` (PDF).
- **Respuesta:** `201` `{status,data}` con clave S3.
- **Efectos:** `awsService.uploadFile` → carga a S3.

#### POST /api/v1/documents/cuadro-firmas/firmar – signDocumentTest
- **Form-Data:** archivo `file` (firma) + campos `userId`, `nombreUsuario`, `cuadroFirmaId`, `responsabilidadId`, `nombreResponsabilidad` (FirmaCuadroDto).
- **Respuesta:** `200` `{status,data}`.
- **Efectos:** inserta firma en PDF, actualiza `cuadro_firma` y `cuadro_firma_user`, sube PDF firmado a S3.

#### PATCH /api/v1/documents/cuadro-firmas/documento/:id – updateDocumentoAsignacion
- **Path:** `id` número.
- **Form-Data:** archivo `file` (PDF) + campos de texto `idUser`, `observaciones`.
- **Respuesta:** `200` `{status,data}`.
- **Efectos:** sube archivo a S3 y agrega registro en historial.

#### POST /api/v1/documents/analyze-pdf-test – analyzePDFTest
- **Form-Data:** archivo `files`.
- **Respuesta:** `200` texto extraído.

#### POST /api/v1/documents/plantilla – generarPlantilla
- **Body (CreatePlantillaDto):** color, nombre, descripcion `string`; idEmpresa `number`.
- **Respuesta:** `201` `{status,data}`.
- **Efectos:** crea registro `plantilla` en Prisma.

#### GET /api/v1/documents/cuadro-firmas/documento-url – getDocumentoURLBucket
- **Query:** `fileName` `string` requerido.
- **Respuesta:** `200` URL prefirmada.
- **Efectos:** `awsService.getPresignedURL`.

#### GET /api/v1/documents/cuadro-firmas/:id – findCuadroFirmas
- **Path:** `id` número.
- **Respuesta:** `200` detalle del cuadro + URLs de S3.

#### POST /api/v1/documents/cuadro-firmas – guardarCuadroFirmas
- **Form-Data:** archivo `file` (PDF) + JSON `responsables` + campos de `CreateCuadroFirmaDto`.
- **Respuesta:** `201` cuadro de firmas.
- **Efectos:** carga PDF a S3, crea registro `cuadro_firma` y agrega historial.

#### POST /api/v1/documents/cuadro-firmas/historial – agregarHistorialCuadroFirma
- **Body (AddHistorialCuadroFirmaDto):** cuadroFirmaId, estadoFirmaId, userId `number`; observaciones `string`.
- **Respuesta:** `201` `{registro}`.

#### GET /api/v1/documents/estados-firma – getAllEstadosFirma
- **Respuesta:** `200` lista de estados.

#### GET /api/v1/documents/cuadro-firmas/historial/:id – getHistorialCuadroFirmas
- **Path:** `id` número.
- **Query:** `page`, `limit` opcionales.
- **Respuesta:** `200` historial paginado.

#### GET /api/v1/documents/cuadro-firmas/firmantes/:id – getUsuariosFirmantesCuadroFirmas
- **Path:** `id` número.
- **Respuesta:** `200` firmantes.

#### GET /api/v1/documents/cuadro-firmas/by-user/:userId – getAsignacionesByUserId
- **Path:** `userId` número.
- **Query:** `page`, `limit`.
- **Respuesta:** `200` asignaciones del usuario.

#### GET /api/v1/documents/cuadro-firmas/documentos/supervision – getSupervisionDocumentos
- **Query:** `page`, `limit`.
- **Respuesta:** `200` documentos para supervisión.

#### PATCH /api/v1/documents/cuadro-firmas/estado – cambiarEstadoAsignacion
- **Body (UpdateEstadoAsignacionDto):** idCuadroFirma, idEstadoFirma, nombreEstadoFirma, idUser, nombreUser, observaciones.
- **Respuesta:** `200` `{status,data}`.

#### PATCH /api/v1/documents/cuadro-firmas/:id – updateCuadroFirmas
- **Path:** `id` número.
- **Form-Data:** JSON `responsables` + campos opcionales de `UpdateCuadroFirmaDto` (titulo, descripcion, version, codigo, empresa_id, createdBy, observaciones).
- **Respuesta:** `200` `{status,data}`.
- **Efectos:** actualiza cuadro y responsables asociados.

### AiController
#### GET /api/v1/ai – findAll
- **Respuesta:** `200` cadena "findAll()".

## E) Hallazgos / advertencias
- Existe un controlador duplicado en `src/user/users.controller.ts` que define rutas `/users` no usadas en el módulo principal.
- Algunos nombres de parámetros varían entre endpoints (`idUser` vs `userId`).
- La mayoría de rutas en `DocumentsController` no están protegidas con guards; podría requerir autenticación.
- Se mezclan cuerpos JSON y `multipart/form-data` para acciones relacionadas, lo que complica la integración.
