# Seguimiento de paginación

## Activar trazas temporales

1. Define la variable de entorno `PAGINATION_DEBUG=1` antes de levantar el backend o ejecutar pruebas.
2. Los servicios `DocumentsService`, `UsersService`, `RolesService` y `PaginasService` imprimirán dos eventos por llamada paginada:
   - `before`: parámetros normalizados enviados a Prisma (`page`, `limit`, `sort`, `skip`, `take`, `orderBy`).
   - `after`: metadatos del resultado (`total`, `firstId`, `lastId`, `returned`).
3. El prefijo de log es `[PAGINACION][<Service>.<method>]` para poder filtrarlos rápido.

## Verificación manual reproducible

El script `scripts/pagination-debug-demo.ts` ejecuta una paginación contra un mock de Prisma con 15 filas ordenadas por `add_date`. Sirve para validar que la segunda página continúa exactamente donde termina la primera.

```bash
TS_NODE_TRANSPILE_ONLY=1 \
NODE_PATH=. \
PAGINATION_DEBUG=1 \
yarn ts-node -r tsconfig-paths/register scripts/pagination-debug-demo.ts
```

Salida esperada (resumen):

```
[PAGINACION][PaginasService.findAll][before] { page: 1, limit: 10, sort: 'desc', skip: 0, take: 10, orderBy: [ { add_date: 'desc' }, { id: 'desc' } ] }
[PAGINACION][PaginasService.findAll][after] { total: 15, count: 15, firstId: 15, lastId: 6, returned: 10 }
[PAGINACION][PaginasService.findAll][before] { page: 2, limit: 10, sort: 'desc', skip: 10, take: 10, orderBy: [ { add_date: 'desc' }, { id: 'desc' } ] }
[PAGINACION][PaginasService.findAll][after] { total: 15, count: 15, firstId: 5, lastId: 1, returned: 5 }
```

Los IDs listados en la salida final del script muestran que la primera página regresa 10 registros (`15`→`6`) y la segunda los 5 restantes (`5`→`1`), cumpliendo el criterio de aceptación.

> Nota: el comando usa `TS_NODE_TRANSPILE_ONLY=1` y `NODE_PATH=.` para facilitar la resolución de imports al ejecutar el servicio directamente con `ts-node`.
