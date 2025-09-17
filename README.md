# Genesis Signin - Backend

## Requisitos

- Node.js 18.x o superior
- Base de datos PostgreSQL

## Instalación

1. Clona el repositorio:

   ```bash
   git clone <REPO_URL>
   cd genesissign-backend
   ```

2. Instala las dependencias:
   ```bash
   yarn
   ```
   > También puedes usar `npm install` si lo prefieres.

## Variables de entorno

1. Copia el archivo `env.example` y renómbralo a `.env`:
   ```bash
   cp env.example .env
   ```
2. Edita el archivo `.env` y configura las variables según tu entorno:
   - `PORT`: Puerto en el que corre el servidor (por defecto: 3200)
   - `API_PREFIX`: Prefijo global para las rutas de la API (por defecto: /api/v1)
   - `CORS_ORIGIN`: Orígenes permitidos separados por coma (por defecto: http://localhost:9002)
   - `NODE_ENV`: Entorno de ejecución (por defecto: development)
   - `DATABASE_URL`: URL de conexión a la base de datos PostgreSQL
   - `OPENAI_API_KEY`: Clave de API para OpenAI
   - `OPENAI_MODEL`: Modelo de OpenAI a utilizar

Asegúrate de agregar y configurar estas variables en tu archivo `.env` antes de iniciar la aplicación.

## Prisma

1. **Configura la variable `DATABASE_URL` en tu `.env`:**
   - Abre el archivo `.env` y agrega o edita la línea:
     ```
     DATABASE_URL="postgresql://usuario:password@localhost:5432/tu_db"
     ```
   - Cambia `usuario`, `password`, `localhost` y `tu_db` según tu configuración de PostgreSQL.

2. **Para generar el cliente Prisma y aplicar migraciones:**

   ```bash
   yarn db:generate
   yarn db:migrate
   ```

   Puedes ver y editar el esquema en `prisma/schema.prisma`.

3. **Para abrir Prisma Studio (UI para la base de datos):**

   ```bash
   yarn prisma studio
   ```

4. **Para importar el esquema de una base de datos existente (pull):**

   ```bash
   yarn prisma db pull
   ```

   Esto actualizará tu archivo `schema.prisma` con los modelos generados a partir de la base de datos actual.

5. **Para generar los modelos a partir del esquema actualizado:**

   ```bash
   yarn db:generate
   ```

6. **Para crear y aplicar migraciones:**
   - Crea una nueva migración:
     ```bash
     yarn prisma migrate dev --name nombre_de_migracion
     ```
   - Aplica migraciones pendientes en producción:
     ```bash
     yarn db:deploy
     ```

## Correr la aplicación

- En modo desarrollo (con recarga automática):

  ```bash
  yarn start:dev
  ```

- En modo producción:
  ```bash
  yarn build
  yarn start:prod
  ```

## Swagger

En desarrollo la documentación se expone en `http://localhost:3200/api/v1/docs`.

## Ejemplos cURL - Gestión de Usuarios

Reemplaza `TOKEN` por un access token válido y ajusta los IDs/paths según tu entorno.

- **Listar usuarios activos**

  ```bash
  curl -X GET \
    http://localhost:3200/api/v1/users \
    -H "Authorization: Bearer $TOKEN"
  ```

- **Obtener detalle de un usuario**

  ```bash
  curl -X GET \
    http://localhost:3200/api/v1/users/1 \
    -H "Authorization: Bearer $TOKEN"
  ```

- **Crear usuario (multipart, con foto opcional)**

  ```bash
  curl -X POST \
    http://localhost:3200/api/v1/users \
    -H "Authorization: Bearer $TOKEN" \
    -F "primer_nombre=Ana" \
    -F "primer_apellido=García" \
    -F "correo_institucional=ana.garcia@local" \
    -F "codigo_empleado=EMP123" \
    -F "password=Temporal!123" \
    -F "foto=@/ruta/a/foto-perfil.jpg"
  ```

- **Actualizar usuario (multipart, nueva foto opcional)**

  ```bash
  curl -X PATCH \
    http://localhost:3200/api/v1/users/1 \
    -H "Authorization: Bearer $TOKEN" \
    -F "primer_nombre=Ana María" \
    -F "telefono=+50255550000" \
    -F "foto=@/ruta/a/nueva-foto.png"
  ```

- **Cambiar contraseña (propio usuario)**

  ```bash
  curl -X PATCH \
    http://localhost:3200/api/v1/users/1/password \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"currentPassword":"Temporal!123","newPassword":"NuevoPass!456"}'
  ```

- **Resetear contraseña (admin a otro usuario)**

  ```bash
  curl -X PATCH \
    http://localhost:3200/api/v1/users/2/password \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"newPassword":"Reset!789"}'
  ```

- **Eliminar lógicamente un usuario**

  ```bash
  curl -X DELETE \
    http://localhost:3200/api/v1/users/1 \
    -H "Authorization: Bearer $TOKEN"
  ```

## Scripts útiles

- `yarn lint`: Formatea y corrige el código.
- `yarn test`: Ejecuta los tests.

-----

Documentación oficial de [NestJS](https://docs.nestjs.com/) y [Prisma](https://www.prisma.io/docs/).
