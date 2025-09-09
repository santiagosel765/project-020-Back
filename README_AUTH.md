# Auth module usage

## Environment variables

Set these variables in your `.env` file (see `env.example`):

```
PORT=3200
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:9002
NODE_ENV=development
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
JWT_ACCESS_EXPIRATION=900        # 15 minutes
JWT_REFRESH_EXPIRATION=604800    # 7 days
OPENAI_API_KEY=
OPENAI_MODEL=
```

## Setup

Run these commands after cloning the repo:

```
yarn db:generate
yarn db:migrate
yarn db:seed
yarn start:dev
```

## Cookies

- **Desarrollo**
  - nombre: `refresh_token`
  - `secure=false`, `path=/api/v1/auth/refresh`
- **Producción**
  - nombre: `__Host-refresh`
  - `secure=true`, `path=/`

## Example curl

```
API=http://localhost:3200/api/v1
REM COOKIE_NAME=refresh_token en dev, __Host-refresh en prod

REM login (recibe access y setea cookie refresh)
curl.exe -i -X POST %API%/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@local\",\"password\":\"Admin!123\"}"

REM refresh (usa cookie)
curl.exe -i -X POST %API%/auth/refresh --cookie "%COOKIE_NAME%=<token>"

REM me (con Authorization: Bearer <access>)
curl.exe -i %API%/users/me -H "Authorization: Bearer <access_token>"

REM logout (borra cookie)
curl.exe -i -X POST %API%/auth/logout --cookie "%COOKIE_NAME%=<token>"
```

> En dev la cookie es `refresh_token`; en prod `__Host-refresh`.

> Nota: En Windows el warning de `pdfjs-dist` sobre canvas se puede ignorar en desarrollo. Para producción, si se requiere render o medición avanzada, instala `canvas` 2.x y su toolchain.

## Testing

Run lint and unit tests:

```
yarn lint
yarn test
```
