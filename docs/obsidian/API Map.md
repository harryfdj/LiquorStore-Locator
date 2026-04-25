---
title: API Map
tags:
  - project/api
  - project/memory
status: draft
---

# API Map

## Route Prefixes

| Prefix | File | Auth |
| --- | --- | --- |
| `/api/auth` | `server/routes/auth.routes.ts` | mixed |
| `/api/admin` | `server/routes/admin.routes.ts` | admin |
| `/api/products` | `server/routes/inventory.routes.ts` | authenticated |
| `/api/reports` | `server/routes/reports.routes.ts` | authenticated |
| `/api/verifications` | `server/routes/verifications.routes.ts` | authenticated |
| `/api/image-proxy` | `server/routes/proxy.routes.ts` | authenticated |

## Auth Flow

- `POST /api/auth/login` returns a Supabase admin token or a signed store token.
- Admin login uses Supabase Auth and requires a matching row in `admin_profiles`.
- Store login uses store code/name plus password checked against `stores.password_hash`.
- The frontend stores the token in `localStorage`.
- `src/lib/api.ts` sends `Authorization: Bearer <token>` and clears local session on `401`.
- `GET /api/auth/me` returns current user/store information.
- Store users get a store database attached by auth middleware.

## Admin Flow

- Admin users can manage stores, store mappings, and store locations through Supabase-backed APIs.
- Admin routes should stay separate from store-user routes.

## Inventory Flow

- Product list and updates are under `/api/products`.
- CSV upload is handled by the inventory router.
- Image search and image update flow uses the scraper service and Supabase Storage.

## Verification Flow

- Verification records are under `/api/verifications`.
- Finalized reports are under `/api/reports`.

## Security Notes

- `/api/image-proxy` requires auth and blocks obvious private/local hosts. Prefer Supabase Storage URLs for product images.
- Keep auth behavior documented here whenever routes are added or changed.
