# Backend Structure

## Stack
- Node.js
- Express
- PostgreSQL
- Nodemailer

## Entry Point
- `backend/server/index.js` - main Express server, middleware, routes, uploads, API logic

## Database Layer
- `backend/server/db.js` - database connection and schema bootstrapping helpers
- `backend/server/migrations/` - migration-related files

## Main Backend Folders

### `backend/server/`
Backend root folder.

Contains:
- `index.js` - API server
- `db.js` - PostgreSQL connection logic
- `migrations/` - DB migration files
- `uploads/` - uploaded files storage

### `backend/server/uploads/`
Uploaded content storage.

Examples:
- `courses/`
- `direct-videos/`
- `homepage-banners/`
- `packages/`

## Backend Responsibilities
- REST API serve karna
- Database queries chalana
- Auth-related operations handle karna
- Admin operations handle karna
- Uploads serve karna
- Email sending handle karna

## Backend Middleware and Infra
`server/index.js` me major setup already defined hai:
- CORS
- JSON body parsing
- URL encoded parsing
- uploads static serving
- environment-based port config

## Important Runtime Details
- Default API port env se aata hai: `API_PORT` ya `PORT`
- Uploads static path server se serve hota hai
- `.env` based config use ho raha hai

## Backend Command
- `npm --prefix backend run start` - start backend server
- `npm --prefix backend run dev` - watch mode backend server

## Frontend se Backend ka Link
Frontend backend ko directly hit nahi karta raw har jagah se. Centralized service files use hoti hain:
- `frontend/src/services/api.ts`
- `frontend/src/services/authApi.ts`
- `frontend/src/services/adminApi.ts`
- `frontend/src/services/marketingApi.ts`

Flow:
1. Frontend service request banati hai
2. Express route `server/index.js` me request receive karta hai
3. Database ya helper logic run hota hai
4. JSON response frontend ko return hota hai

## Quick Summary
- Server/API logic: `backend/server/index.js`
- DB layer: `backend/server/db.js`
- DB changes: `backend/server/migrations/`
- Uploaded files: `backend/server/uploads/`