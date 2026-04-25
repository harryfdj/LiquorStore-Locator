---
title: GCP MCP
tags:
  - project/cloud
  - project/mcp
  - production-readiness
status: active
---

# GCP MCP

This project uses the official Google Cloud MCP server through Cursor.

## Cursor Config

The project-level MCP config lives at `.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "gcloud": {
      "command": "npx",
      "args": ["-y", "@google-cloud/gcloud-mcp"]
    }
  }
}
```

## Local Requirements

- Google Cloud CLI installed with Homebrew: `gcloud-cli`.
- Cursor must be restarted or MCP servers refreshed after changing `.cursor/mcp.json`.
- A Google account and active project must be configured before cloud tools can do useful work.

## Authentication

Configured local project:

```bash
gcloud config set project project-ee46ccd5-2dae-4bce-9c0
gcloud auth application-default set-quota-project project-ee46ccd5-2dae-4bce-9c0
```

Use least-privilege IAM for production work. Do not store service-account keys, tokens, passwords, or project secrets in this repo or in Obsidian notes.

## Live Compute Engine Instance

- Project ID: `project-ee46ccd5-2dae-4bce-9c0`
- Instance name: `liquor-store`
- Zone: `us-central1-f`
- Status: `RUNNING`
- Machine type: `e2-medium`
- External IP: `34.72.8.208`
- Public URL: `https://34.72.8.208.nip.io`

## Live Runtime

- OS: Debian 12.
- Reverse proxy: Caddy.
- Caddy config: `/etc/caddy/Caddyfile`.
- Caddy route: `34.72.8.208.nip.io` -> `localhost:3000`.
- App directory: `/home/hirak_fdj/LiquorStore-Locator`.
- Process manager: PM2.
- PM2 app name: `liquor-store`.
- PM2 owner: `hirak_fdj`.
- PM2 script: `/home/hirak_fdj/LiquorStore-Locator/server.ts`.
- PM2 interpreter: `tsx`.
- Runtime env: `NODE_ENV=production`.
- Git remote on VM: `https://github.com/harryfdj/LiquorStore-Locator.git`.
- VM branch: `main`.
- Last verified commit on VM: `5b8d47f`.

## Cloud Build Deployment

- Cloud Build API: enabled.
- Secret Manager API: enabled.
- Deploy config: `cloudbuild.yaml`.
- Last manual Cloud Build deploy: succeeded.
- Successful build ID: `e5ef938f-5fb1-4943-879d-6d1424ce4cfd`.
- GitHub connection: `github-liquor-store` in `us-central1`.
- GitHub connection status: complete.
- Connected repository: `liquorstore-locator-repo`.
- GitHub repo: `https://github.com/harryfdj/LiquorStore-Locator.git`.
- Push trigger: `deploy-liquor-store-vm`.
- Trigger ID: `4cd0733c-eb85-4732-9e89-abcfae0e249a`.
- Trigger branch: `^main$`.
- Trigger config file: `cloudbuild.yaml`.

Cloud Build deployment behavior:

- SSH to `hirak_fdj@liquor-store`.
- `cd /home/hirak_fdj/LiquorStore-Locator`.
- Fetch and reset to `origin/main`.
- Run `npm ci`.
- Run `npm run build`.
- Restart PM2 app `liquor-store`.
- Save PM2 process list.

Before deploying the Supabase rewrite to `main`, configure the PM2/VM environment with:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_JWT_SECRET`
- `ADMIN_EMAIL`
- `PRODUCT_IMAGE_BUCKET`

IAM configured for Cloud Build deployment:

- `36705937245-compute@developer.gserviceaccount.com`: `roles/compute.instanceAdmin.v1`, `roles/logging.logWriter`.
- `36705937245-compute@developer.gserviceaccount.com` can act as the VM service account.
- `service-36705937245@gcp-sa-cloudbuild.iam.gserviceaccount.com`: `roles/secretmanager.admin` for GitHub connection token storage.

Useful commands:

```bash
gcloud compute instances describe liquor-store --zone us-central1-f
gcloud compute ssh liquor-store --zone us-central1-f
gcloud compute scp LOCAL_FILE liquor-store:REMOTE_PATH --zone us-central1-f
gcloud compute ssh liquor-store --zone us-central1-f --command "sudo -u hirak_fdj env PM2_HOME=/home/hirak_fdj/.pm2 pm2 status"
gcloud builds submit --project project-ee46ccd5-2dae-4bce-9c0 --config cloudbuild.yaml --no-source
gcloud builds triggers describe 4cd0733c-eb85-4732-9e89-abcfae0e249a --region us-central1
```

## Intended Uses

- Inspect Google Cloud projects, services, and deployment state.
- Plan production infrastructure for this app.
- Validate Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, and logging setup.
- Support deployment and operations work from Cursor once authenticated.
