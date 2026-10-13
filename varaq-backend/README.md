# Varaq backend

Initial Go + PostgreSQL foundation for Varaq, a pseudonymous literary publishing platform.

## Stack

- Go, Chi, pgx
- Supabase PostgreSQL / Supabase Auth (auth integration is a follow-up task)
- SQL migrations and sqlc query generation
- OpenAPI 3.1 contract

## Important schema note

The initial migration references `auth.users`, which exists in Supabase. For local PostgreSQL without Supabase, either run a local Supabase stack or change the `app_users.id` foreign key in the migration to a plain UUID before applying it.

## Setup

1. Install Go 1.23+ and PostgreSQL, or create a Supabase project.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Apply `db/migrations/000001_initial_schema.up.sql` to the database. In Supabase, use the SQL editor or your migration workflow.
4. Run the API:

   ```sh
   set -a; source .env; set +a
   go mod tidy
   go run ./cmd/api
   ```

5. Check `GET http://localhost:8080/healthz` and `GET http://localhost:8080/readyz`.

## Current endpoints

- `GET /healthz` — process health
- `GET /readyz` — database readiness
- `GET /api/v1/feed` — temporary empty response; real cursor-paginated query is next

## Development sequence

1. Add migration runner and apply schema locally.
2. Generate sqlc code and implement feed/persona/piece queries.
3. Implement Supabase JWT verification and authorization middleware before write endpoints.
4. Add persona creation and piece create/edit/publish flows.
5. Add OpenAPI-generated TypeScript client for the React frontend.

Do not expose the database directly to the frontend. The Go service must enforce piece visibility and ownership for every request.

this is to check ownership