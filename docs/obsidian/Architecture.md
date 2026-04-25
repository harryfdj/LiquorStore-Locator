---
title: Architecture
tags:
  - project/architecture
  - project/memory
status: draft
---

# Architecture

## Stack

- Frontend: React 19, Vite 6, Tailwind 4.
- Backend: Express 4 running from `server.ts`.
- Runtime: `tsx watch server.ts` for development.
- Database: Supabase Postgres with store-scoped tables.
- Auth: Supabase Auth for admins and signed app JWTs for store users.
- Storage: Supabase Storage bucket `product-images`.

## Entry Points

- `index.html` loads the SPA.
- `src/main.tsx` mounts React.
- `src/App.tsx` controls auth state, role-based screens, and store tabs.
- `src/lib/api.ts` provides the browser API client and session expiry behavior.
- `server.ts` starts Express, mounts API routes, and serves Vite middleware in development.

## Frontend Areas

- `src/components/LoginScreen.tsx`: login UI.
- `src/components/AdminDashboard.tsx`: admin store management.
- `src/components/InventoryTab.tsx`: inventory browsing and editing.
- `src/components/StockVerify.tsx`: physical inventory verification.
- `src/components/VerificationReports.tsx`: verification reporting.
- `src/components/GeoFence.tsx`: client-side location check.
- `src/hooks/useInventory.ts`: inventory state, CSV upload, product image flow.
- `src/hooks/usePhysicalScanner.ts`: barcode scanner keyboard input.

## Backend Areas

- `server/routes/auth.routes.ts`: login and current-user endpoints.
- `server/routes/admin.routes.ts`: admin store setup, mappings, and locations.
- `server/routes/inventory.routes.ts`: products, CSV upload, image search, image update.
- `server/routes/reports.routes.ts`: verification reports.
- `server/routes/verifications.routes.ts`: verification records.
- `server/routes/proxy.routes.ts`: image proxy.
- `server/middlewares/auth.ts`: Supabase/admin and store JWT auth middleware.
- `server/lib/supabase.ts`: server-side Supabase clients and row mapping helpers.
- `server/lib/config.ts`: environment contract.
- `server/services/scraper.ts`: image search and download service.

## Database Model

- `stores` stores tenant identity, CSV mapping, geofence data, and hashed store passwords.
- `products` stores inventory rows with `store_id` tenant scope.
- `stock_verifications` stores active and reported verification rows.
- `verification_reports` stores finalized report summaries.
- Product images are stored in Supabase Storage under `product-images/{store_id}/...`.

## Production Concerns

- Production requires Supabase environment variables on the VM before deploying.
- The image proxy is authenticated and no longer used for Supabase Storage URLs.
- Production run mode needs a clear build/start process.
- Supabase backup and migration operations should be handled through Supabase project controls.
