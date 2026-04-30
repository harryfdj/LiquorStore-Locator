---
title: Session Notes
tags:
  - project/session-notes
  - project/memory
status: active
---

# Session Notes

Add short notes after meaningful work. Newest entries go first.

## 2026-04-29: Experimental image fetch accuracy branch

- Created `harryfdj/feat/test-image-fetch-confidence` for testing improved product image autofetch without changing `main`.
- Experimental image fetch skips products with `stock <= 0`, avoids UPC-first search, uses name/size/product-type queries, prefers trusted product source domains, and only auto-saves high-confidence matches.
- Manual image candidates now use the same improved query/scoring order while still returning URL candidates for selection.

## 2026-04-29: GCP blank page recovery

- Diagnosed the live `https://34.72.8.208.nip.io` blank page as a zero-byte `dist/index.html` on the Compute Engine VM.
- Root cause was the VM root disk reaching 100% usage; build output was truncated while PM2 and Caddy still returned HTTP 200.
- Freed safe cache/log space, rebuilt `dist`, restarted PM2, and verified the homepage plus JS/CSS assets return non-zero content.
- Remaining risk: local `public/product-images-*` folders consume about 3.8GB on the 10GB VM disk, so future deploys can fail again unless images are migrated/deleted or the disk is expanded.
- Deleted old VM-local `public/product-images-*` folders after confirming images will be downloaded again; root disk usage dropped from 93% to 51%.

## 2026-04-29: Alabama order import bottle cost

- Orders UI now shows imported-line **Cost / Bottle** from the pre-discount order price; case lines divide price by pack size, bottle lines use price directly, and unknown pack sizes show `N/A`.
- Imported order lines render a UPC barcode for valid numeric UPCs, matching the product listing barcode style.
- Fixed Alabama money parsing for cells that include both visible and screen-reader prices, avoiding stored values like `69.9969` that displayed as `$70.00`.
- Receive controls now use mobile-friendly minus/value/plus steppers for received bottles and rack count.
- Matched order lines can be reopened for product search if the wrong inventory product was selected; the line display now prefers the selected product UPC.

## 2026-04-26: Camera scanner reliability

- Made scanner output and product UPC lookup tolerate the common scanner case where UPC-A is reported with one extra leading zero.
- Re-centered the camera scanner modal with dynamic viewport sizing for phone and laptop screens.
- Restored the scanner runtime to the original broad `html5-qrcode` configuration that worked on phone and laptop cameras.
- Split scanner engines by device: desktop/laptop uses fast native `BarcodeDetector`, phones use the broad `html5-qrcode` scanner.
- Replaced the phone path with lazy-loaded ZXing 1D barcode scanning, keeping `html5-qrcode` only as a mobile fallback.

## 2026-04-26: Bulk inventory location mode

- Added inventory **Bulk Location Mode**: enter active shelf code, scan UPCs, and apply that location to products without opening each item edit panel.
- If scanned products already have one or more locations, the UI asks whether to replace a specific existing location or add the active location as another location.

## 2026-04-26: Delete Alabama order import

- Added `DELETE /api/orders/:id` for non-finalized orders (lines removed via FK cascade).
- Orders UI: trash control on each saved order row and **Delete import** on the order header, with confirm dialog and copy about removing mistaken imports before finalize.

## 2026-04-25: Supabase Production Rewrite

- Added Supabase migration `0001_initial_schema.sql` for stores, products, verifications, reports, admin profiles, and product image storage.
- Replaced SQLite-backed route logic with Supabase-backed auth, admin, inventory, verification, and report APIs.
- Added server config validation, typed Supabase clients, validation schemas, and shared API error handling.
- Replaced the frontend global `fetch` monkey patch with `src/lib/api.ts`.
- Updated admin UI copy and behavior for Supabase tenants and hidden store passwords.
- Improved scanner handling by avoiding editable controls and reducing verification lookup debounce.
- Added `npm test`, `npm run check`, validation tests, README updates, and Supabase environment documentation.
- Removed legacy SQLite database manager files and the `better-sqlite3` dependency.

## 2026-04-25: Live VM Deployment Inspection

- Inspected the `liquor-store` Compute Engine VM in `us-central1-f`.
- Confirmed public app health at `https://34.72.8.208.nip.io`.
- Found Caddy reverse proxy in `/etc/caddy/Caddyfile`, forwarding to `localhost:3000`.
- Found PM2 running app `liquor-store` as user `hirak_fdj`.
- Found app directory at `/home/hirak_fdj/LiquorStore-Locator`.
- Confirmed VM Git remote points to `https://github.com/harryfdj/LiquorStore-Locator.git` on branch `main`.
- Confirmed local repo and VM repo are both at commit `5b8d47f`.
- Added `cloudbuild.yaml` for VM deployment through Cloud Build.
- Enabled Cloud Build and Secret Manager APIs.
- Granted Cloud Build permissions needed to SSH to the VM and write logs.
- Verified a manual Cloud Build deployment succeeded and restarted PM2.
- Created GitHub connection `github-liquor-store` and connected `harryfdj/LiquorStore-Locator`.
- Created Cloud Build trigger `deploy-liquor-store-vm` for pushes to `main`.

## 2026-04-25: GCP MCP Setup

- Added project-level Cursor MCP config at `.cursor/mcp.json`.
- Configured the official Google Cloud MCP server: `@google-cloud/gcloud-mcp`.
- Installed Google Cloud CLI with Homebrew.
- Verified `gcloud` is available.
- Identified the live Compute Engine VM: `liquor-store` in project `project-ee46ccd5-2dae-4bce-9c0`, zone `us-central1-f`.
- Set the local active GCP project and ADC quota project to `project-ee46ccd5-2dae-4bce-9c0`.
- Added [[GCP MCP]] memory note for auth and usage guidance.

## 2026-04-25: Cursor Skills And Obsidian Memory Setup

- Installed `antigravity-awesome-skills` for Cursor at `/Users/hd/.cursor/skills`.
- Created this Obsidian vault at `docs/obsidian`.
- Added starter memory notes for architecture, API map, production roadmap, feature backlog, decisions, and session notes.
- Added Cursor guidance to keep project memory updated during future coding work.
