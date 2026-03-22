# Ednovate Deployment Guide (Beginner Friendly)

This guide is for beginners. Follow it exactly and you can deploy this project safely.

## What You Are Deploying

This project has 2 parts:

1. Frontend (React + Vite) -> deploy on Vercel
2. Backend (Node + Express + PostgreSQL) -> deploy on Render (or Railway)

If you deploy only frontend, login/API will fail.

---

## 0) Before You Start

You need:

1. GitHub account
2. Vercel account
3. Render account
4. PostgreSQL database (Render Postgres / Neon / Supabase)

Also keep this project pushed to GitHub.

---

## 1) Push Code to GitHub

From project root (`Online-Ednovate`):

```bash
git add .
git commit -m "prepare deployment"
git push origin main
```

---

## 2) Deploy Database (PostgreSQL)

Use any provider (Neon/Supabase/Render Postgres).

**What is a "connection string"?**

A connection string is the complete address + password to access your database.

**Example connection string:**

```text
postgresql://postgres:mypassword123@db.123abc.neon.tech:5432/ednovate_db
```

Breaking it down:
- `postgresql://` = database type
- `postgres` = username
- `mypassword123` = password
- `db.123abc.neon.tech` = database server address (host)
- `5432` = port (always this for postgres)
- `ednovate_db` = database name

### Option 1: Neon (Free, Recommended)

1. Go to https://neon.tech -> Sign up (free)
2. Create project -> Create database
3. In Neon dashboard, click "Connection String"
4. Copy the string like: `postgresql://user:password@host.neon.tech:5432/dbname`
5. Use this as `DATABASE_URL`

### Option 2: Supabase (Free)

1. Go to https://supabase.com -> Create project
2. In project settings -> Database -> Connection string
3. Copy the postgres URL
4. Replace `[YOUR-PASSWORD]` with your actual password
5. Use as `DATABASE_URL`

### Option 3: Render Postgres

1. In Render dashboard -> Create New -> PostgreSQL
2. After creation, copy "External Database URL"
3. Use as `DATABASE_URL`

⚠️ **Important:** Keep this connection string secret. Don't share it anywhere public.

---

## 3) Deploy Backend on Render

### 3.1 Create Service

1. Go to Render Dashboard
2. Click `New +` -> `Web Service`
3. Connect GitHub repo
4. Select repo containing this project

### 3.2 Render Build Settings

Use these values:

1. Root Directory: `Online-Ednovate`
2. Build Command: `npm install`
3. Start Command: `npm run server`

### 3.3 Add Environment Variables (Very Important)

In Render dashboard -> Your Service -> Environment:

Click "Add Environment Variable" and add these 3:

| Variable Name | Value | Example |
|---|---|---|
| `DATABASE_URL` | Your postgres connection string from step 2 | `postgresql://user:pwd@host.neon.tech:5432/db` |
| `NODE_ENV` | `production` | `production` |
| `CORS_ORIGIN` | Your Vercel frontend URL (copy after deploying frontend) | `https://your-app.vercel.app` |

**Don't know your Vercel URL yet?** Deploy frontend first (step 4), then come back and update `CORS_ORIGIN`.

Optional (recommended to set custom password):

| Variable Name | Value | Example |
|---|---|---|
| `ADMIN_EMAIL` | Custom admin email | `admin@yourcompany.com` |
| `ADMIN_PASSWORD` | Strong password | `MySecurePass123!` |
| `ADMIN_NAME` | Admin name | `Super Admin` |

Then click "Deploy" to apply changes.

### 3.4 Verify Backend

After deploy, open:

```text
https://YOUR_RENDER_DOMAIN/api/health
```

If this works, backend is running.

---

## 4) Deploy Frontend on Vercel

### 4.1 Create Project

1. Go to Vercel
2. `Add New` -> `Project`
3. Import same GitHub repo

### 4.2 Build Settings

Set:

1. Root Directory: `Online-Ednovate`
2. Framework Preset: `Vite`
3. Build Command: `npm run build`
4. Output Directory: `dist`

Deploy once.

---

## 5) Connect Frontend to Backend (Most Important Step)

This project uses `/api/...` calls from frontend.
So Vercel must forward `/api/*` to your backend.

Edit `vercel.json` to this format:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://YOUR_RENDER_DOMAIN/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Then commit + push again. Vercel auto-redeploy karega.

---

## 6) Admin Login Credentials

Default backend seed credentials (if not overridden):

1. Email: `admin@ednovate.com`
2. Password: `admin123`

If you set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env in backend, use those.

---

## 7) Full Testing Checklist

After both deploys complete:

1. Open frontend URL
2. Try admin login
3. Open browser devtools -> Network
4. Verify login request goes to `/api/admin/login` and returns JSON (not HTML)
5. Check course list/API pages load

If all pass, deployment done.

---

## Deploy Using Plesk (Beginner)

If you want to deploy on Plesk instead of Render + Vercel, follow this model:

1. Frontend static files on main domain (example: `example.com`)
2. Backend Node app on subdomain (example: `api.example.com`)
3. Main domain `/api/*` proxied to `api.example.com`

This is the easiest and most stable setup for beginners on Plesk.

### A) Requirements in Plesk

Make sure these are available:

1. Node.js extension enabled in Plesk
2. Database available (external Neon/Supabase or local PostgreSQL)
3. SSL enabled for domain and subdomain

### B) Deploy Backend on Plesk (api.example.com)

1. Create subdomain: `api.example.com`
2. Upload project code to subdomain folder (or Git pull)
3. In Plesk -> `Node.js`:
  1. Document Root: backend folder root (where `package.json` exists)
  2. Application Mode: `production`
  3. Application Startup File: `server/index.js`
4. Run `npm install`
5. Add environment variables in Node.js settings:
  1. `DATABASE_URL`
  2. `NODE_ENV=production`
  3. `CORS_ORIGIN=https://example.com`
  4. Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`
6. Restart Node app from Plesk panel
7. Verify health URL:

```text
https://api.example.com/api/health
```

### C) Deploy Frontend on Plesk (example.com)

1. Local machine par frontend build karo:

```bash
npm install
npm run build
```

2. `dist/` folder ke saare files `example.com/httpdocs/` me upload karo
3. Confirm `index.html` directly open ho raha hai: `https://example.com`

### D) Proxy /api from Main Domain to Backend

Because frontend calls `/api/...`, you must forward `/api` to backend.

Plesk -> `Domains` -> `example.com` -> `Apache & nginx Settings` -> `Additional nginx directives`:

```nginx
location /api/ {
   proxy_pass https://api.example.com/api/;
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
}
```

Apply settings.

### E) SPA Route Fix (React refresh 404 issue)

For React routes (`/admin`, `/dashboard`, etc.), add one of these:

1. Plesk Nginx fallback rule to `index.html`, or
2. `.htaccess` rewrite in `httpdocs`

Minimal `.htaccess` for Apache hosting:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### F) Admin Login Notes on Plesk

If admin login says wrong password:

1. Check `https://api.example.com/api/health` works
2. Browser Network tab me dekho `/api/admin/login` JSON de raha hai ya HTML
3. If HTML aa raha hai -> proxy or SPA routing issue
4. If 401 JSON aa raha hai -> admin credentials/env issue

Default credentials (if env not overridden):

1. Email: `admin@ednovate.com`
2. Password: `admin123`

---

## Common Problems and Fix

### Problem 1: Admin login shows "wrong password"

Possible reasons:

1. Backend not deployed
2. `vercel.json` API rewrite missing/wrong
3. Frontend getting HTML from Vercel instead of JSON API
4. Wrong admin env password in backend

Fix:

1. Check backend `/api/health`
2. Fix `vercel.json` rewrite
3. Redeploy both

---

### Problem 2: CORS error in browser

Set backend env:

1. `CORS_ORIGIN=https://your-vercel-domain.vercel.app`

Then redeploy backend.

---

### Problem 3: Images/uploads disappear later

`server/uploads` is local disk. Free cloud services may reset storage.

Long-term fix:

1. Move uploads to Cloudinary / S3 / Bunny / other object storage.

---

## Quick Recap (Short)

1. DB banao -> get `DATABASE_URL`
2. Backend Render pe deploy karo (`npm run server`)
3. Frontend Vercel pe deploy karo (`npm run build`)
4. `vercel.json` me `/api/*` rewrite backend pe do
5. `CORS_ORIGIN` set karo
6. Test login + APIs

---

If you want, I can also create a one-click deploy checklist file (`DEPLOY_CHECKLIST.md`) for your team.