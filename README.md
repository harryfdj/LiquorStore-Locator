# Liquor Store Locator

Production inventory and stock verification app for multi-store liquor operations.

## Stack

- React 19 + Vite frontend
- Express API
- Supabase Postgres, Auth, and Storage
- GCP Compute Engine VM with Caddy + PM2
- Cloud Build trigger for deployments from GitHub `main`

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` or `.env` from `.env.example` and fill in Supabase values:

   ```bash
   cp .env.example .env.local
   ```

3. Apply Supabase migrations from `supabase/migrations` in your Supabase project.

4. Create an admin user in Supabase Auth, then add that user to `public.admin_profiles`.

5. Run the app:

   ```bash
   npm run dev
   ```

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

or run everything:

```bash
npm run check
```

## Production Deploy

Pushing to GitHub `main` triggers Cloud Build. The trigger uses `cloudbuild.yaml` to SSH into the GCP VM, reset the VM checkout to `origin/main`, run `npm ci`, run `npm run build`, and restart PM2 app `liquor-store`.

Live VM details are documented in `docs/obsidian/GCP MCP.md`.

Before pushing Supabase changes to production, configure the VM environment with:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_JWT_SECRET`
- `ADMIN_EMAIL`
- `PRODUCT_IMAGE_BUCKET`

Never commit live secrets or service role keys.
