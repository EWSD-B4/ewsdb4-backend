# Faculty Domain Guide (Docker + Prisma + Tests)

## Quick Start (Docker)

Start services:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mysql redis rabbitmq
```

Build + start app:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml build app
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-build app
```

Prisma migration (dev):

```
DB_USER=root DB_PASSWORD=dev1234 \
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app npx prisma migrate dev --name init
```

Prisma client:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app npx prisma generate
```

Base URL:

```
http://localhost:3000/api/v1
```

## Environment (Docker dev)

Set these in `.env`:

```
DB_HOST=mysql
DB_PORT=3306
DB_USER=ews_user
DB_PASSWORD=dev1234
DB_NAME=ewsdb4

REDIS_HOST=redis
REDIS_PORT=6379

RABBITMQ_URL=amqp://rabbitmq:5672
```

## Seed Roles

Run once:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec mysql \
  mysql -u root -p -e "USE ewsdb4; \
  INSERT INTO roles (role_name, role_code, requires_faculty, is_active, created_at, updated_at) VALUES \
  ('Admin','admin',0,1,NOW(),NOW()), \
  ('Student','student',1,1,NOW(),NOW()), \
  ('Coordinator','coordinator',1,1,NOW(),NOW()), \
  ('Manager','manager',0,1,NOW(),NOW()), \
  ('Guest','guest',0,1,NOW(),NOW()), \
  ('User','user',0,1,NOW(),NOW()), \
  ('Moderator','moderator',0,1,NOW(),NOW()) \
  ON DUPLICATE KEY UPDATE role_name=VALUES(role_name), requires_faculty=VALUES(requires_faculty), is_active=VALUES(is_active), updated_at=NOW();"
```

Verify roles:

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec mysql \
  mysql -u root -p -e "USE ewsdb4; SELECT id, role_code FROM roles;"
```

## Endpoints (Faculty Domain)

Admin

- `POST /admin/faculties`
- `GET /admin/faculties?search=&isActive=&limit=&offset=`
- `PATCH /admin/faculties/:id`
- `PATCH /admin/faculties/:id/deactivate`
- `PATCH /admin/users/:id/faculty`
- `GET /admin/faculties/:id/users?roleCode=&limit=&offset=`

Coordinator

- `GET /coordinator/contributions`
- `GET /coordinator/contributions/:id`

Guest (public)

- `GET /guest/faculties`
- `GET /guest/faculties/:facultyId/contributions/selected`
- `GET /guest/contributions/:id`

Reports

- `GET /reports/faculty/:facultyId/statistics?academicYearId=...`
- `GET /reports/faculty/:facultyId/exceptions?academicYearId=...`

## Curl Examples (Quick Reference)

Login admin:

```
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

Create faculty:

```
curl -s -X POST http://localhost:3000/api/v1/admin/faculties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ENG","name":"Engineering"}'
```

List faculties:

```
curl -s "http://localhost:3000/api/v1/admin/faculties?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Assign faculty to user:

```
curl -s -X PATCH http://localhost:3000/api/v1/admin/users/<USER_ID>/faculty \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"facultyId":1}'
```

Guest list faculties:

```
curl -s http://localhost:3000/api/v1/guest/faculties
```

Guest selected by faculty:

```
curl -s http://localhost:3000/api/v1/guest/faculties/1/contributions/selected
```

Coordinator list:

```
curl -s http://localhost:3000/api/v1/coordinator/contributions \
  -H "Authorization: Bearer <COORD_TOKEN>"
```

Reports:

```
curl -s "http://localhost:3000/api/v1/reports/faculty/1/statistics?academicYearId=2024" \
  -H "Authorization: Bearer $TOKEN"
```

## Seed Data (Optional)

Create a coordinator:

```
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"coord@example.com","name":"Coordinator","password":"Coord123!","role_id":3}'
```

Create a student:

```
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","name":"Student","password":"Student123!","role_id":2}'
```

Assign student to faculty:

```
curl -s -X PATCH http://localhost:3000/api/v1/admin/users/<STUDENT_ID>/faculty \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"facultyId":1}'
```

## Troubleshooting

- `401 UNAUTHORIZED` on protected routes:
  - Ensure `Authorization: Bearer <token>` is set.
  - Ensure Redis is running (login state is stored in Redis).
  - Re-login if Redis was restarted.

- `409 CONFLICT` on create:
  - Use unique `facultyCode` and `facultyName`.

- `422 VALIDATION_ERROR`:
  - Missing required fields or wrong types.

- Empty guest lists:
  - Ensure faculty is `isActive=true`.
  - Ensure contributions exist and are marked `selected`.

## Role-Specific Quick Notes

Backend Developers

- Use Prisma migrations for schema changes (`migrate dev` in local).
- Keep admin/guest/coordinator role behaviors consistent with the access matrix.
- Never return `password_hash` in responses.

DevOps / DBA

- Use `migrate deploy` in staging/production.
- Keep secrets out of `.env` in production (use CI/CD secrets or secret manager).
- Redis restart invalidates tokens; plan rolling restarts.

Testers (QA)

- Validate admin CRUD + failure cases.
- Validate student/coordinator cannot access admin endpoints (403).
- Validate guest endpoints are public and filtered by status.

Frontend Developers

- Use response envelope `{ data, meta, requestId }` consistently.
- On 401/403, redirect to login or show “no permission”.
- Guest lists may be empty; handle empty states gracefully.

## Roles and Access Matrix

Admin

- Full access to all admin endpoints.
- Can assign faculty to users.

Coordinator

- Can access coordinator and report endpoints for their own faculty only.

Student

- Cannot access admin, coordinator, or report endpoints.
- Guest endpoints remain public.

Guest

- Public access only to guest endpoints.

Manager

- Can access report endpoints across faculties.

## Expected Error Codes

Common

- `401 UNAUTHORIZED`: missing/invalid token or logged out.
- `403 FORBIDDEN`: authenticated but role not allowed.

Admin faculties

- `409 CONFLICT`: duplicate `facultyCode` or `facultyName`.
- `400 BAD_REQUEST`: invalid faculty id format.
- `404 NOT_FOUND`: faculty id not found.
- `422 VALIDATION_ERROR`: missing or invalid body fields.

Admin user assignment

- `400 BAD_REQUEST`: invalid faculty id or role requires faculty but null.
- `409 CONFLICT`: user has contributions and faculty change is blocked.
- `404 NOT_FOUND`: user not found or faculty not found.

Guest

- `400 VALIDATION_ERROR`: invalid faculty id format.
- `404 NOT_FOUND`: contribution not found for selected-only endpoint.

Reports

- `400 VALIDATION_ERROR`: missing `academicYearId` or invalid ids.

## Admin Test Flow (Success + Failure)

1. Login admin:

```
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

Set token:

```
TOKEN=<admin_token>
```

2. Create faculty:

```
curl -s -X POST http://localhost:3000/api/v1/admin/faculties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ENG","name":"Engineering"}'
```

Expected: `201`

3. Duplicate create:
   Expected: `409 CONFLICT`

4. Update valid:

```
curl -s -X PATCH http://localhost:3000/api/v1/admin/faculties/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineering and Tech"}'
```

Expected: `200`

5. Invalid id:

```
curl -i -X PATCH http://localhost:3000/api/v1/admin/faculties/abc \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Invalid"}'
```

Expected: `400 BAD_REQUEST`

6. Deactivate:

```
curl -s -X PATCH http://localhost:3000/api/v1/admin/faculties/1/deactivate \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `200`

## Student Test Flow

Login student:

```
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"Student123!"}'
```

Student is blocked from admin/coordinator/reports:

```
curl -i http://localhost:3000/api/v1/admin/faculties \
  -H "Authorization: Bearer <student_token>"
```

Expected: `403 FORBIDDEN`

## Coordinator Test Flow

Register coordinator:

```
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"coord@example.com","name":"Coordinator","password":"Coord123!","role_id":3}'
```

Assign faculty (admin):

```
curl -s -X PATCH http://localhost:3000/api/v1/admin/users/<COORD_ID>/faculty \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"facultyId":1}'
```

Coordinator list:

```
curl -s http://localhost:3000/api/v1/coordinator/contributions \
  -H "Authorization: Bearer <coord_token>"
```

Expected: `200` (empty if no contributions)

## Guest Test Flow

Guest list faculties:

```
curl -s http://localhost:3000/api/v1/guest/faculties
```

Guest selected by faculty:

```
curl -s http://localhost:3000/api/v1/guest/faculties/1/contributions/selected
```

## Notes

- Guest endpoints are public in this implementation.
- Invalid faculty id now returns `400 BAD_REQUEST`.
- Admin list/users does not return password hashes.

## Known Issues / Expected Errors

- Creating a faculty with an existing `facultyCode` or `facultyName` returns `409 CONFLICT`.
- Registering an already-existing user returns `409` (or `INTERNAL_ERROR` if the client retries without handling it).
- Guest selected list may return empty even for valid faculties when no contributions are `selected`.
- Reports endpoints return empty counts if no contributions or academic year data exist.
- If Redis is restarted, login tokens become invalid and users must login again.
