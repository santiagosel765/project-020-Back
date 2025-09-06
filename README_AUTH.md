# Auth module usage

## Environment variables

Set these variables in your `.env` file:

```
PORT=3000
API_PREFIX=api
CORS_ORIGIN=http://localhost:9002
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
JWT_ACCESS_EXPIRATION=900        # 15 minutes
JWT_REFRESH_EXPIRATION=604800    # 7 days
OPENAI_API_KEY=dummy
OPENAI_MODEL=dummy
```

## Setup

Run these commands after cloning the repo:

```
npx prisma generate
npx prisma migrate dev
npx prisma db seed
yarn start:dev
```

## Example curl

```
# signup
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"primer_nombre":"Admin","primer_apellido":"User","correo_institucional":"admin@local","codigo_empleado":"ADMIN","password":"Admin!123"}'

# login (returns access token and sets refresh cookie)
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"user":"admin@local","password":"Admin!123"}'

# refresh (send stored cookie, no body)
curl -i -X POST http://localhost:3000/api/auth/refresh \
  --cookie "__Host-refresh=<refresh_token_from_cookie>"

# current user
curl http://localhost:3000/api/users/me \
  -H 'Authorization: Bearer <access_token>'
```

## Testing

Run lint and unit tests:

```
npm run lint
npm test
```
