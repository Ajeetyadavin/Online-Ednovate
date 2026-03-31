# Separate Frontend and Backend Deploy

This project is arranged to support separate frontend and backend domains.

## Current Folder Split
- Frontend app: `frontend/`
- Backend API: `backend/`

## Recommended Split
- Frontend: `https://app.example.com`
- Backend API: `https://api.example.com`

## What Supports This Now
- Relative frontend requests like `/api/...` can be redirected with `VITE_API_BASE_URL`
- Upload URLs can be redirected with `VITE_UPLOADS_BASE_URL`
- Shared upload asset resolution is centralized
- Vite local proxy targets are configurable by env
- Backend CORS is already controlled by `CORS_ORIGIN`

## Frontend Env
Set these in `frontend/.env` for local or frontend hosting env settings.

```env
VITE_API_BASE_URL=https://api.example.com
VITE_UPLOADS_BASE_URL=https://api.example.com
```

If uploads come from a CDN:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_UPLOADS_BASE_URL=https://assets.example.com
```

## Backend Env
Set these in `backend/.env` or backend hosting env settings.

```env
API_PORT=4000
CORS_ORIGIN=https://app.example.com,https://www.app.example.com
DATABASE_URL=postgresql://...
```

## Local Development

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_UPLOADS_BASE_URL=http://localhost:4000
VITE_DEV_API_PROXY_TARGET=http://localhost:4000
VITE_DEV_UPLOADS_PROXY_TARGET=http://localhost:4000
API_PORT=4000
```

## Deploy Order
1. Deploy backend first
2. Verify backend API and uploads work on their own domain
3. Set frontend `VITE_API_BASE_URL` and `VITE_UPLOADS_BASE_URL`
4. Deploy frontend
5. Set backend `CORS_ORIGIN` to the frontend domain

## Notes
- Existing frontend code can keep using relative `/api/...` calls
- Existing upload paths like `/uploads/...` and `/api/uploads/...` are resolved at runtime
- Backend serves uploads from both `/uploads` and `/api/uploads`
- Frontend deploy root is `frontend/`
- Backend deploy root is `backend/`