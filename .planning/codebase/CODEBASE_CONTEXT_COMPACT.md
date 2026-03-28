# Ednovate Codebase Context (Compact, Source-Verified)

Last verified: 2026-03-27

## Stack + Runtime
- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn/ui.
- Routing: `react-router-dom` with public and admin route trees in `src/App.tsx`.
- Backend: Express + PostgreSQL (`server/index.js`, `server/db.js`).
- Dev scripts: `npm run dev`, `npm run server`, `npm run server:dev`, `npm test`.

## Real Architecture
- Hybrid architecture (not context-only):
  - Server-backed domains: auth/session, students, orders, technical support, marketing, categories, courses/curriculum, homepage, leads, uploads, platform settings, analytics.
  - Frontend context state still used heavily for UI data orchestration (`PlatformDataContext`, `AuthContext`, `CartContext`, `SiteSettingsContext`, `AdminAuthContext`).

## Frontend Route Map (Actual)
- Public shell (`Layout`): `/`, `/packages`, `/login`, `/signup`, `/forgot-password`, `/checkout`, `/order-confirmation`, `/course/:id`, `/learn/:id`, `/dashboard`, `/dashboard/technical-support`, `/dashboard/course/:id/about`, `/collections/:slug`, `/faculty/:id`, `/contact-us`, `/api-test`.
- Admin auth: `/admin`, `/admin/login`.
- Admin module routes under `/admin/*`:
  - `dashboard`, `courses`, `course-content`, `categories`, `masters`, `coupons`, `faculty`, `users`, `student-access`, `orders`, `leads`, `announcements`, `technical-support`, `marketing`, `homepage`, `header`, `settings`, `subadmins`, `logs`.

## Security + Session Controls (Implemented)
- `SiteSecurityGuard` in `src/App.tsx`:
  - Optional anti-inspect lock (F12/devtools detection + debugger timing).
  - Optional copy/cut/paste/context-menu blocking on non-admin routes.
- Forced logout notice key: `ednovate_forced_logout_notice`.
- Admin and student contexts poll session-status endpoints every ~4s and auto-logout on conflict.

## Core Context Truth
- `PlatformDataContext` includes:
  - entities: `courses`, `categories`, `banners`, `testimonials`, `announcements`, `coupons`, `curricula`.
  - CRUD-like methods for courses/categories/coupons + curriculum operations.
  - startup fetch calls to `/api/courses`, `/api/categories`, `/api/homepage`, `/api/coupons`.
- `AdminAuthContext`:
  - module-action permission model (`read|create|edit|delete`) for all admin modules.
  - login via `/api/admin/login` and session polling via `/api/admin/session-status`.
- `AuthContext`:
  - profile + login/signup/otp wrappers via `authApi`.
  - session polling via `/api/auth/student/session-status`.

## Backend API Surface (High-Level)
- Admin auth/session: `/api/admin/login`, `/api/admin/session-status`, subadmin + audit/activity logs.
- Student auth/profile/session: `/api/auth/student/*` (signup/login/profile/session/change-password).
- Student learning ops: orders, support tickets, purchase, video activity, lesson notes, watch progress, lesson completion.
- Admin student ops: `/api/students*`, course-access controls, messaging, notifications.
- Commerce ops: `/api/admin/orders*` including dispatch, invoice, refund.
- Catalog ops: `/api/categories`, `/api/admin/categories*`, `/api/course-masters`, `/api/admin/course-masters`, `/api/courses*`, curriculum endpoints.
- Homepage/coupons/settings: `/api/homepage`, `/api/coupons`, `/api/platform-settings`, `/api/admin/platform-settings`, `/api/admin/coupons`.
- Lead system: `/api/lead-form-settings`, `/api/leads/enquiry`, `/api/admin/leads*`, `/api/admin/lead-form-settings`.
- Media ops: `/api/uploads/image`, `/api/uploads/bunny-video`, `/api/bunny/signed-playback`, `/api/admin/bunny/video-duration/:videoId`.
- Analytics + health: `/api/analytics/*`, `/api/health`, `/api/db-check`.

## Known Practical Rule for New Work
- For admin features, always check both:
  - frontend page + context/service wiring in `src/pages/admin/*`, `src/context/*`, `src/services/adminApi.ts`
  - corresponding backend endpoints in `server/index.js`
- Assume no feature is purely localStorage until endpoint usage is confirmed.
