---
title: Decision Log
tags:
  - project/decisions
  - project/memory
status: active
---

# Decision Log

Use this note for durable technical decisions. Add new entries at the top.

## 2026-04-25: Rewrite Data Layer To Supabase

Decision: Replace SQLite tenant files with Supabase Postgres, Supabase Auth for admins, signed app JWTs for store users, and Supabase Storage for product images.

Why: The application needs production-ready data management, stronger credential handling, simpler backups, and a cleaner path for future multi-store features.

Consequences:

- Existing SQLite data can be reset and is no longer the source of truth.
- The VM must have Supabase environment variables before this branch is deployed.
- Store passwords are hashed in Supabase rather than stored in plaintext.
- Browser code must never receive the Supabase service role key.
- Schema changes should be tracked in `supabase/migrations`.

## 2026-04-25: Use Official Google Cloud MCP

Decision: Configure this repo with the official `@google-cloud/gcloud-mcp` server in `.cursor/mcp.json`.

Why: The project is moving toward production readiness and needs a safe way for Cursor to inspect and assist with Google Cloud deployment and operations work.

Consequences:

- Google Cloud CLI must be installed and authenticated locally.
- Cloud access should use least-privilege IAM.
- Secrets and service-account keys must not be committed or stored in project memory.
- Cloud setup details should be tracked in [[GCP MCP]].

## 2026-04-25: Add Obsidian Project Memory

Decision: Use `docs/obsidian` as the project memory vault and keep it in the repository.

Why: The memory should travel with the application and stay visible to both the developer and Cursor.

Consequences:

- Future agents should read [[Home]] before large changes.
- Architecture, API behavior, roadmap, decisions, and session summaries should be updated as the code changes.
- Private secrets and local credentials must never be stored in notes.
