# Faculty Domain Guide

## Base URL

`http://localhost:3000/api/v1`

## Runtime Response Contract

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2026-02-28T15:20:52.815Z"
}
```

### Error (development)

```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "stack": "Error: ..."
}
```

Note: `stack` appears in development mode for debugging.

## Auth Quick Flow

### Login (Admin)

Request:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "name": "Admin",
      "role": "admin"
    },
    "token": "<jwt>"
  },
  "timestamp": "2026-02-28T15:21:50.123Z"
}
```

### Logout + Token Invalidation

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Then same token on protected route:

```bash
curl -i http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected: `401` with `success:false`.

## Faculty Endpoints

## 1) Admin - List Faculties

`GET /admin/faculties?search=&isActive=&limit=&offset=`

Request:

```bash
curl -i "http://localhost:3000/api/v1/admin/faculties" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Success response:

```json
{
  "success": true,
  "message": "Faculties retrieved",
  "data": {
    "items": [
      {
        "id": 1,
        "facultyName": "Arts and Design",
        "facultyCode": "ENG",
        "isActive": true
      }
    ],
    "total": 1
  },
  "timestamp": "2026-02-28T15:22:16.229Z"
}
```

Validation error example (`limit=0&offset=-1`): `422`.

## 2) Admin - Create Faculty

`POST /admin/faculties`

Request:

```bash
curl -i -X POST "http://localhost:3000/api/v1/admin/faculties" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code":"ART","name":"Arts"}'
```

Success: `201`.

Conflict example (duplicate code/name):

```json
{
  "success": false,
  "message": "Faculty code or name already exists",
  "stack": "Error: ..."
}
```

Status: `409`.

## 3) Admin - Update Faculty

`PATCH /admin/faculties/:id`

Request:

```bash
curl -i -X PATCH "http://localhost:3000/api/v1/admin/faculties/1" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Arts and Design"}'
```

Success response:

```json
{
  "success": true,
  "message": "Faculty updated",
  "data": {
    "id": 1,
    "facultyName": "Arts and Design",
    "facultyCode": "ENG",
    "isActive": true
  },
  "timestamp": "2026-02-28T15:22:17.099Z"
}
```

## 4) Admin - Deactivate Faculty

`PATCH /admin/faculties/:id/deactivate`

Request:

```bash
curl -i -X PATCH "http://localhost:3000/api/v1/admin/faculties/1/deactivate" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Success: `200`, `isActive:false`.

## 5) Admin - Assign User Faculty

`PATCH /admin/users/:id/faculty`

Request:

```bash
curl -i -X PATCH "http://localhost:3000/api/v1/admin/users/2/faculty" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"facultyId":1}'
```

Success: `200`.

Common errors:
- `400` invalid user id / invalid faculty / role requires faculty but null
- `404` user not found
- `409` cannot change faculty when user already has contributions

## 6) Admin - List Users By Faculty

`GET /admin/faculties/:id/users?roleCode=&limit=&offset=`

Request:

```bash
curl -i "http://localhost:3000/api/v1/admin/faculties/1/users" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Success response:

```json
{
  "success": true,
  "message": "Faculty users retrieved",
  "data": {
    "items": [],
    "total": 0
  },
  "timestamp": "2026-02-28T15:22:31.507Z"
}
```

## 7) Coordinator - Contributions

`GET /coordinator/contributions`  
`GET /coordinator/contributions/:id`

Request:

```bash
curl -i "http://localhost:3000/api/v1/coordinator/contributions" \
  -H "Authorization: Bearer <COORD_TOKEN>"
```

Success response:

```json
{
  "success": true,
  "message": "Contributions retrieved",
  "data": {
    "items": [],
    "total": 0
  },
  "timestamp": "2026-02-28T15:40:01.043Z"
}
```

If token missing/invalid: `401`.

## 8) Reports - Faculty Statistics/Exceptions

`GET /reports/faculty/:facultyId/statistics?academicYearId=2024`  
`GET /reports/faculty/:facultyId/exceptions?academicYearId=2024`

Requests:

```bash
curl -i "http://localhost:3000/api/v1/reports/faculty/1/statistics?academicYearId=2024" \
  -H "Authorization: Bearer <COORD_TOKEN>"

curl -i "http://localhost:3000/api/v1/reports/faculty/1/exceptions?academicYearId=2024" \
  -H "Authorization: Bearer <COORD_TOKEN>"
```

Success response (statistics):

```json
{
  "success": true,
  "message": "Faculty statistics",
  "data": {
    "totalContributions": 0,
    "selectedContributions": 0,
    "distinctContributors": 0
  },
  "timestamp": "2026-02-28T15:40:01.247Z"
}
```

Success response (exceptions):

```json
{
  "success": true,
  "message": "Faculty exceptions",
  "data": {
    "missingComment": [],
    "overdue": []
  },
  "timestamp": "2026-02-28T15:40:01.423Z"
}
```

Validation errors:
- invalid `facultyId` -> `400`
- missing `academicYearId` -> `400`

## 9) Guest Endpoints (Public)

`GET /guest/faculties`  
`GET /guest/faculties/:facultyId/contributions/selected`  
`GET /guest/contributions/:id`

Requests:

```bash
curl -i "http://localhost:3000/api/v1/guest/faculties"
curl -i "http://localhost:3000/api/v1/guest/faculties/1/contributions/selected"
curl -i "http://localhost:3000/api/v1/guest/contributions/1"
```

Success response (list faculties):

```json
{
  "success": true,
  "message": "Faculties retrieved",
  "data": [
    { "id": 1, "facultyCode": "ENG", "facultyName": "Arts and Design" }
  ],
  "timestamp": "2026-02-28T15:23:23.510Z"
}
```

Not found example (`/guest/contributions/1` when missing):

```json
{
  "success": false,
  "message": "Contribution not found",
  "stack": "Error: ..."
}
```

Invalid id example (`/guest/contributions/abc`):

```json
{
  "success": false,
  "message": "Invalid contribution id",
  "stack": "Error: ..."
}
```

Status: `400`.

## Role Access Matrix

- `admin`: full admin faculty/user assignment endpoints
- `coordinator`: coordinator endpoints + reports (faculty scoped)
- `student`: blocked from admin/coordinator/reports (`403`)
- `guest`: guest endpoints only (public)
- `manager`: reports endpoints allowed

## Known Testing Pitfalls

1. `Route /api/v1/admin/users//faculty not found`
- Cause: empty `USER_ID` variable in script.

2. `401 Authentication required. Please provide a valid token.`
- Cause: empty/invalid token parsing.

3. Coordinator tests fail with 401
- Cause: coordinator user missing in DB.

4. Manager report tests return 401
- Cause: manager user/token not seeded or login failed.

5. `POST /api/v1/users` returns 404
- Current runtime does not expose this endpoint.
- Create test users via existing auth/admin flows or direct DB seed for local QA.

## Tested Status (Current Branch)

- `GET /health` -> tested, `200`
- `POST /auth/login` -> tested, `200`
- `POST /auth/logout` + token reuse -> tested, `200` then `401`
- `GET /admin/faculties` -> tested, `200`
- `POST /admin/faculties` duplicate -> tested, `409`
- `PATCH /admin/faculties/:id` -> tested, `200`
- `PATCH /admin/faculties/:id/deactivate` -> tested, `200`
- `PATCH /admin/users/:id/faculty` -> tested, `200`
- `GET /admin/faculties/:id/users` with filters -> tested, `200`
- `GET /coordinator/contributions` -> tested, `200`
- `GET /coordinator/contributions/:id` -> tested `404` path
- `GET /reports/faculty/:id/statistics` -> tested, `200`
- `GET /reports/faculty/:id/exceptions` -> tested, `200`
- `GET /guest/faculties` -> tested, `200`
- `GET /guest/faculties/:id/contributions/selected` -> tested, `200`
- `GET /guest/contributions/:id` -> tested `404`
- `GET /guest/contributions/abc` -> tested `400` (bug fix verified)

## Reliable Variable Guards (Bash)

```bash
[[ -z "$BASE" ]] && echo "BASE missing" && exit 1
[[ -z "$ADMIN_TOKEN" ]] && echo "ADMIN_TOKEN missing" && exit 1
[[ -z "$COORD_TOKEN" ]] && echo "COORD_TOKEN missing" && exit 1
[[ -z "$STUDENT_ID" ]] && echo "STUDENT_ID missing" && exit 1
```
