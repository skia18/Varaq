# Varaq (ورق)

**Leave a page of yourself behind.**

Varaq is a literary writing platform for poems, fragments, stories, letters, and essays published under pseudonymous identities. Its design draws on paper, ink, annotations, and literary scrapbooks.

## Current implementation

The repository contains a React frontend, a Go REST API, and a version-controlled Supabase PostgreSQL schema.

- Supabase Auth handles sign-up, login, sessions, and password recovery.
- The API supports persona creation and lookup, draft creation and editing, publishing, deletion, and public listings for a writer's wall.
- The frontend includes a writing room, a private vault, public writer walls, and discovery, collection, and saved-page screens.
- The Commons feed, collections, and saved-page views currently use bundled sample writing. Their presence does not imply a complete database-backed implementation.

Semantic discovery with pgvector, MCP integration, and expanded moderation and library features remain planned.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| UI | Tailwind CSS, Base UI, shadcn tooling |
| Backend | Go, Chi |
| Database | Supabase PostgreSQL, accessed through pgx |
| Authentication | Supabase Auth |
| Database migrations | Supabase CLI and SQL files |
| API specification | OpenAPI |

## Repository layout

```text
Varaq/
├── apps/
│   ├── varaq-frontend/
│   │   ├── src/
│   │   │   ├── app/             # Router and app entry
│   │   │   ├── auth/            # Sessions and protected routes
│   │   │   ├── components/      # Shared UI and login forms
│   │   │   ├── features/        # Feed and feature state
│   │   │   ├── lib/             # API and Supabase clients
│   │   │   ├── pages/
│   │   │   └── styles/
│   │   └── .env.local.example
│   └── varaq-backend/
│       ├── cmd/api/             # API entry point
│       ├── internal/
│       │   ├── auth/            # Supabase token verification
│       │   ├── config/          # Environment configuration
│       │   ├── httpapi/         # Routes, handlers, middleware
│       │   └── store/           # PostgreSQL connection helpers
│       ├── apispec/openapi.yaml
│       └── .env.example
├── documentation/
│   └── database-workflow.md
├── supabase/
│   ├── config.toml
│   └── migrations/              # Application schema history
├── package.json                # Workspace scripts and CLI tools
└── package-lock.json
```

## Getting started

### 1. Install prerequisites and dependencies

You need Git, Node.js 20.19 or newer with npm, and the Go toolchain specified by [go.mod](apps/varaq-backend/go.mod), currently Go 1.27.2. Docker Desktop is needed when running local Supabase or database commands that use containers. It does not need to run while the application uses hosted Supabase.

```bash
git clone https://github.com/skia18/Varaq.git
cd Varaq
npm ci
```

Run the remaining commands from this repository root unless a step explicitly changes directory. The root npm workspace installs the frontend dependencies and the Supabase CLI; a separate frontend npm installation is unnecessary.

### 2. Choose the database environment

For access to the existing hosted environment, obtain the project's Supabase URL, publishable key, and database connection string privately from a maintainer. Do not push schema changes merely to start the application.

For an isolated local environment, follow [Database setup and migrations](documentation/database-workflow.md). That guide covers Docker installation, creating the local database from migrations, linking a hosted project, and the original schema import. A fresh clone already has the configuration and baseline; do not repeat `supabase init` or pull another baseline.

Use the same Supabase instance for the frontend Auth client, backend Auth verification, and database connection. The `personas` table references `auth.users`, so plain PostgreSQL without an equivalent Auth setup is insufficient.

### 3. Configure environment files

Copy the templates:

```bash
cp apps/varaq-frontend/.env.local.example apps/varaq-frontend/.env.local
cp apps/varaq-backend/.env.example apps/varaq-backend/.env
```

Edit `apps/varaq-frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_API_BASE_URL=http://localhost:8080
```

`VITE_API_BASE_URL` is optional and defaults to `http://localhost:8080`. Do not append `/api/v1`: the frontend request paths already include it. Restart Vite after editing its environment variables.

Edit `apps/varaq-backend/.env`:

```env
PORT=8080
DATABASE_URL=YOUR_POSTGRESQL_CONNECTION_STRING
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the actual database connection string for your chosen environment. For local Supabase, run `npx supabase status` to get local connection details and client keys, and use its local API URL in place of the hosted URL above.

For hosted Auth, configure the Supabase Auth Site URL and allowed redirect URLs for your frontend origin. Password recovery returns to `/update-password`, so allow `http://localhost:5173/update-password` during local development and the corresponding URL for any deployed frontend.

Environment files are ignored by Git. Frontend `VITE_` values are exposed to the browser: use the publishable client key there, never a database password, secret key, or service-role key.

### 4. Start the API

In one terminal at the repository root:

```bash
npm run dev:go
```

This starts Go from `apps/varaq-backend`, where it reads `.env`. Go downloads missing modules when needed. By default, the API listens on `http://localhost:8080`.

Check it with:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

`/healthz` checks that the server responds. `/readyz` also checks database connectivity; neither verifies the complete schema or Auth configuration.

### 5. Start the frontend

In a second terminal at the repository root:

```bash
npm run dev:web
```

Open the URL printed by Vite, normally `http://localhost:5173`. The API allows that origin by default. To allow another frontend origin, set `FRONTEND_ORIGIN` in the backend environment and restart the API.

## Database changes

Keep each schema change in a new file under `supabase/migrations/`. Preserve migrations that have already been applied or shared.

The normal flow is to create a migration, write SQL, test it against local Supabase, review and commit it, then deploy it deliberately to the intended hosted project. **`supabase db push` changes the linked hosted database.** A local reset deletes local records; it does not copy production data.

See [Database setup and migrations](documentation/database-workflow.md) for the complete commands, target selection, data handling, and troubleshooting.

## Development commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev:web` | Start the frontend development server |
| `npm run dev:go` | Start the Go API |
| `npm run build:web` | Type-check and build the frontend |
| `npm run test:go` | Run Go tests |
| `npm run format:go` | Format backend Go source |
| `npm run lint --workspace=varaq-frontend` | Lint frontend code |
| `npm run format:check --workspace=varaq-frontend` | Check frontend formatting |
| `npm run api:validate-spec` | Validate the OpenAPI specification |
| `npm run api:generate:web` | Generate a TypeScript Fetch client from OpenAPI |

The OpenAPI Generator commands require Java. The current frontend uses the hand-written client at `apps/varaq-frontend/src/lib/api.ts`; generating a client does not automatically switch the application to it.

## Frontend routes

| Route | Purpose | Requires login |
| --- | --- | --- |
| `/` | Commons feed | No |
| `/discover` | Discovery screen | No |
| `/collections` | Collection browsing | No |
| `/wall/:handle` | Public writer wall | No |
| `/saved` | Saved pages | Yes |
| `/vault` | Writer's private workspace | Yes |
| `/write` | Writing room | Yes |
| `/login`, `/signup` | Account access | No |
| `/forgot-password`, `/update-password` | Password recovery screens | No route guard |

Password updates still require a valid Auth recovery/session flow. Frontend route guards improve navigation; backend authorization enforces access to private resources.

## API and request flow

The frontend authenticates through Supabase Auth and sends the session's bearer token with API requests. The Go API verifies protected requests through Supabase's `/auth/v1/user` endpoint, then queries PostgreSQL through pgx.

Current route groups under `/api/v1` include:

- `POST /personas` and `GET /me/persona` for the signed-in writer's persona.
- `GET /personas/{handle}` and `GET /personas/{handle}/pieces` for public walls.
- `POST /pieces` for creating writing.
- `GET /owner/pieces` and `GET`, `PUT`, or `DELETE /owner/pieces/{pieceID}` for owner access.
- `POST /owner/pieces/{pieceID}/publish` for publishing.

Public wall lookups are unauthenticated; the other operations listed require authentication. The API specification lives at [apps/varaq-backend/apispec/openapi.yaml](apps/varaq-backend/apispec/openapi.yaml). Keep it aligned with route and payload changes.

## Privacy and development direction

Varaq models public, unlisted, and private writing. Ownership and visibility checks belong in the backend as well as any database access policies. Keep database credentials and privileged keys out of browser code and Git. SQL migrations describe structure; production records and backups belong in separate private storage.

Future work includes database-backed discovery and library features, reporting and moderation, semantic search over eligible public writing, and controlled MCP access. Search and derived indexes must respect visibility changes and deletions.

Contributions should keep frontend presentation, backend business logic, and database changes coordinated. Include relevant validation and update the API specification and documentation when behavior changes.

## License

The root package metadata declares ISC, while the frontend has a separate [LICENSE](apps/varaq-frontend/LICENSE). There is currently no root license file; repository-wide licensing needs clarification.
