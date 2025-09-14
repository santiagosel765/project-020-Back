| Controller | Método | HTTP | Ruta | Auth | Query | Path | Body (media-type) | FormData parts | Tablas | Estado |
|------------|-------|------|------|------|-------|------|--------------------|---------------|-------|--------|
| documents  | guardarCuadroFirmas | POST | /documents/cuadro-firmas | JwtAuthGuard | - | - | multipart/form-data | file,responsables,titulo,descripcion,version,codigo,empresa_id,createdBy | cuadro_firma,cuadro_firma_user,documento | ✅ |
| documents  | findCuadroFirmas | GET | /documents/cuadro-firmas/{id} | JwtAuthGuard | - | id | - | - | cuadro_firma,documento | ✅ |
| documents  | getUsuariosFirmantesCuadroFirmas | GET | /documents/cuadro-firmas/firmantes/{id} | JwtAuthGuard | - | id | - | - | cuadro_firma_user,user | ✅ |
| documents  | getHistorialCuadroFirmas | GET | /documents/cuadro-firmas/historial/{id} | JwtAuthGuard | page,limit | id | - | - | cuadro_firma_estado_historial | ✅ |
| documents  | updateCuadroFirmas | PATCH | /documents/cuadro-firmas/{id} | JwtAuthGuard | - | id | application/json | - | cuadro_firma,cuadro_firma_user | ✅ |
| documents  | updateDocumentoAsignacion | PATCH | /documents/cuadro-firmas/documento/{id} | JwtAuthGuard | - | id | multipart/form-data | file,userId,observaciones | documento,cuadro_firma_estado_historial | ✅ |
| documents  | signDocument | POST | /documents/cuadro-firmas/firmar | JwtAuthGuard | - | - | multipart/form-data | file,userId,nombreUsuario,cuadroFirmaId,responsabilidadId,nombreResponsabilidad | cuadro_firma_user,cuadro_firma,cuadro_firma_estado_historial | ✅ |
| documents  | cambiarEstadoAsignacion | PATCH | /documents/cuadro-firmas/estado | JwtAuthGuard | - | - | application/json | - | cuadro_firma,cuadro_firma_estado_historial | ✅ |
| documents  | getAsignacionesByUserId | GET | /documents/cuadro-firmas/by-user/{userId} | JwtAuthGuard | page,limit,estado,search,empresa,sort | userId | - | - | cuadro_firma_user,cuadro_firma | ✅ |
| documents  | getSueprvisionDocumentos | GET | /documents/cuadro-firmas/documentos/supervision | JwtAuthGuard | page,limit,estado,search,empresa,sort | - | - | - | cuadro_firma | ✅ |
| documents  | getDocumentoURLBucket | GET | /documents/cuadro-firmas/documento-url | JwtAuthGuard | fileName | - | - | - | - | ✅ |
