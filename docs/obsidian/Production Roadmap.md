---
title: Production Roadmap
tags:
  - project/roadmap
  - production-readiness
status: active
---

# Production Roadmap

## Phase 1: Stabilize The Existing App

- Replace hardcoded JWT secret and default admin credentials with Supabase Auth and environment variables.
- Make `PORT`, Supabase settings, image bucket, and public app URL environment-driven.
- Add a real `npm test` script and focused tests for auth, inventory, and verification flows.
- Update `README.md` with accurate local, build, and production instructions.
- Remove or document root `test-*.js` scripts.

## Phase 2: Security Hardening

- Lock down `/api/image-proxy`.
- Add request validation for all write endpoints.
- Add auth and role tests.
- Review CSV upload limits, file handling, and parser safety.
- Add secret scanning and dependency audit checks to CI.
- Move remaining server secrets to Secret Manager or VM environment variables.

## Phase 3: Production Runtime

- Define the production start command. Current VM runs `server.ts` through PM2 with the `tsx` interpreter.
- Decide whether to compile backend TypeScript or run with a process manager that supports TS.
- Add Docker or a deployment guide. Current deployment is a Compute Engine VM with Caddy proxying `34.72.8.208.nip.io` to `localhost:3000`.
- Add database backup and restore instructions.
- Add logging and error handling conventions.
- Add a safe GitHub-to-VM deployment flow. Current VM repo is `/home/hirak_fdj/LiquorStore-Locator` on branch `main`.
- Configure Supabase production environment variables on the VM before merging to `main`.

## Phase 4: Feature Improvements

- Improve store onboarding.
- Improve inventory search, image selection, and CSV mapping.
- Improve verification reporting and export.
- Improve mobile scanner and camera scanner UX.
- Add admin audit trail for sensitive changes.

## Phase 5: Rewrite Or Refactor

- Rewrite only after the current behavior is documented and covered by tests.
- Preserve working user flows during migration.
- Replace risky modules one at a time: auth, database layer, product import, reporting, then UI polish.
