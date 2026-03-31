# Frontend Structure

## Stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI components

## Entry Points
- `frontend/src/main.tsx` - frontend bootstrap
- `frontend/src/App.tsx` - app routing and top-level screen composition
- `frontend/index.html` - Vite HTML entry

## Main Frontend Folders

### `frontend/src/components/`
Reusable UI components.

Examples:
- Header, Footer, HeroBanner
- CourseCard, CartDrawer
- FAQ, Testimonials, WhyChooseUs
- `ui/` for shared low-level UI primitives

### `frontend/src/pages/`
Route-level pages.

Examples:
- `Index.tsx`
- `CourseDetails.tsx`
- `Checkout.tsx`
- `Dashboard.tsx`
- `admin/` for admin panel screens

### `frontend/src/context/`
Global React context state.

Examples:
- `AuthContext.tsx`
- `CartContext.tsx`
- `PlatformDataContext.tsx`
- `SiteSettingsContext.tsx`
- `AdminAuthContext.tsx`

### `frontend/src/services/`
Frontend API layer. Backend ko yahi files hit karti hain.

Examples:
- `api.ts`
- `authApi.ts`
- `adminApi.ts`
- `marketingApi.ts`

### `frontend/src/lib/`
Helper logic, utility integrations, media helpers, access helpers.

### `frontend/src/hooks/`
Custom React hooks.

Examples:
- `use-mobile.tsx`
- `use-scroll-reveal.ts`
- `use-toast.ts`

### `frontend/src/data/`
Static or seeded frontend data.

### `frontend/src/test/`
Frontend/unit test files and setup.

## Styling Files
- `frontend/src/index.css` - global styles
- `frontend/src/App.css` - app-level styles
- `frontend/tailwind.config.ts` - Tailwind config
- `frontend/postcss.config.js` - PostCSS config

## Public Assets
- `frontend/public/` - static frontend assets
- `frontend/public/banners/` - banner images/assets
- `frontend/public/robots.txt`

## Frontend Commands
- `npm --prefix frontend run dev` - start Vite frontend
- `npm --prefix frontend run build` - production build
- `npm --prefix frontend run preview` - preview build
- `npm --prefix frontend run test` - run tests

## Frontend to Backend Connection
Frontend directly backend APIs ko mostly `src/services/` se call karta hai.

Typical flow:
1. Page or component user action leta hai
2. Service file API request bhejti hai
3. Backend response aata hai
4. UI state/context update hota hai

## Quick Summary
- User-visible UI: `frontend/src/components/`, `frontend/src/pages/`
- App state: `frontend/src/context/`
- API calls: `frontend/src/services/`
- Styling/assets: `frontend/src/index.css`, `frontend/src/App.css`, `frontend/public/`