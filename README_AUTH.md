# Auth module usage

## Environment variables

Set these variables in your `.env` file:

```
PORT=3000
GLOBAL_PREFIX=api/v1
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
JWT_EXPIRATION=900        # 15 minutes
JWT_REFRESH_EXPIRATION=604800 # 7 days
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

# login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"user":"admin@local","password":"Admin!123"}'

# refresh
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<token>"}'

# current user
curl http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer <access_token>'
```

## Testing

Run lint and unit tests:

```
npm run lint
npm test
```
