# Auth module usage

## Environment variables

Set these variables in your `.env` file:

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
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

## Cookies

- Desarrollo: cookie `refresh_token`, secure=false, path=`/api/v1/auth/refresh`.
- Producción: cookie `__Host-refresh`, secure=true, path=`/` (regla del prefijo `__Host-`).

## Example curl

```
API=http://localhost:3200/api/v1
# nombre de la cookie según entorno
# dev: refresh_token, prod: __Host-refresh
COOKIE_NAME=refresh_token

# login (recibe access y setea cookie refresh)
curl -i -X POST %API%/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@local\",\"password\":\"Admin!123\"}"

# refresh (usa cookie)
curl -i -X POST %API%/auth/refresh --cookie "$COOKIE_NAME=<token>"

# me (con Authorization: Bearer <access>)
curl -i %API%/users/me -H "Authorization: Bearer <access_token>"

# logout (borra cookie)
curl -i -X POST %API%/auth/logout --cookie "$COOKIE_NAME=<token>"
```

## Testing

Run lint and unit tests:

```
npm run lint
npm test
```
