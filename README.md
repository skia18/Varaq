# Varaq (ورق)

**Leave a page of yourself behind.**

Varaq is a literary writing platform built around personal expression, thoughtful reading, and the discovery of writing that resonates. Writers can publish poems, fragments, short stories, letters, and essays under pseudonymous identities, creating personal literary walls that reflect their voices.

The experience draws inspiration from paper, ink, annotations, and literary scrapbooks. Rather than optimizing for follower counts and engagement metrics, Varaq aims to make writing feel personal, intimate, and discoverable.

## Vision

Create a public space where people can leave pieces of themselves through writing and discover meaningful connections between words, ideas, and experiences.

## Core Features

- **Commons:** A public feed of literary writing.
- **Discover:** Explore writing through themes, tags, and related pieces.
- **Personal Walls:** Individual literary spaces for pseudonymous writers.
- **Piece Reader:** A focused reading experience for poems, stories, essays, and fragments.
- **Writing Room:** A distraction-free environment for drafting and publishing.
- **Library:** Save writing and organize pieces into collections.
- **Persona Studio:** Create and manage a literary identity.
- **Privacy Controls:** Support public, unlisted, and private writing.
- **Semantic Discovery (planned):** Find related writing using meaning rather than exact keywords.
- **MCP Integration (planned):** Enable AI tools to discover and retrieve public writing through controlled interfaces.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript |
| Routing | React Router |
| Styling | Tailwind CSS |
| Backend | Go |
| HTTP Router | Chi |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Database Access | pgx and sqlc |
| API Specification | OpenAPI |
| Semantic Search (planned) | PostgreSQL with pgvector |
| Version Control | Git and GitHub |

## Architecture

Varaq uses a monorepo containing two independently runnable applications.

```text
varaq/
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── pages/            # Application pages
│   │   ├── components/       # Reusable UI components
│   │   ├── layouts/          # Shared page layouts
│   │   ├── routes/           # React Router configuration
│   │   ├── services/         # Backend API client
│   │   ├── hooks/            # Custom React hooks
│   │   └── types/            # TypeScript types
│   ├── public/
│   └── package.json
│
├── backend/                  # Go REST API
│   ├── cmd/
│   │   └── api/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── db/
│   │   ├── httpapi/
│   │   ├── personas/
│   │   └── pieces/
│   ├── db/
│   │   ├── migrations/
│   │   └── queries/
│   ├── api/
│   │   └── openapi.yaml
│   └── go.mod
│
├── infra/                    # Local infrastructure configuration
├── .gitignore
└── README.md
```

The directory structure may evolve as implementation progresses.

### Request Flow

1. The React frontend renders pages and handles user interactions.
2. The frontend calls the Go REST API over HTTP using JSON.
3. The Go backend validates requests, enforces authorization, and executes business logic.
4. The backend accesses PostgreSQL through its database layer.
5. Responses return to the frontend for rendering.

The frontend and backend are separate applications. They can be developed and deployed independently while remaining in the same Git repository.

## Getting Started

For database setup, Docker, and the SQL migration workflow, read [Database setup and migrations](documentation/database-workflow.md). The current database migrations live in the root `supabase/migrations/` directory; use that guide for database setup rather than the older database paths below.

### Prerequisites

Install the following tools:

- Node.js and npm
- Go
- Git
- A Supabase project, or a compatible local PostgreSQL environment

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd varaq
```

### 2. Start the frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Start the development server:

```bash
npm run dev
```

The Vite development server typically runs at `http://localhost:5173`.

### 3. Configure the backend

Open a separate terminal:

```bash
cd backend
```

Create a `.env` file based on the backend's environment configuration template. Configure the database connection, server port, and authentication settings.

Example configuration:

```env
PORT=8080
DATABASE_URL=<your-postgresql-connection-string>
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_JWT_ISSUER=<your-supabase-jwt-issuer>
```

The exact variables depend on the backend implementation. Do not commit secrets or production credentials.

Install dependencies and start the API:

```bash
go mod download
go run ./cmd/api
```

The API should be available at `http://localhost:8080`, assuming the default port is configured.

### 4. Configure the database

Apply the version-controlled SQL migrations in `backend/db/migrations/` using the project's migration workflow.

When using Supabase, ensure the schema is compatible with Supabase Auth and its `auth.users` table. A vanilla PostgreSQL instance will not have Supabase's authentication schema automatically.

Keep migrations version-controlled so that local, staging, and production environments can be updated consistently.

## Application Routes

| Route | Purpose |
|---|---|
| `/` | Commons — public literary feed |
| `/discover` | Discover writing and themes |
| `/u/:handle` | Personal literary wall |
| `/p/:slug` | Individual piece reader |
| `/write` | Writing room |
| `/library` | Saved pieces and collections |
| `/settings/persona` | Persona management |

These routes are intended to be implemented using React Router.

## API Design

The backend exposes a versioned REST API under `/api/v1`.

Planned resource groups include:

- **Personas:** Create, retrieve, and update literary identities.
- **Pieces:** Draft, publish, retrieve, update, and delete writing.
- **Feed:** Retrieve published public writing.
- **Tags:** Categorize and discover writing.
- **Collections:** Organize related pieces.
- **Library:** Save and retrieve bookmarked writing.
- **Responses:** Support reader responses where enabled.
- **Moderation:** Handle reports, blocks, and content restrictions.

The OpenAPI specification in `backend/api/openapi.yaml` serves as the API contract.

## Privacy and Security

Privacy is a core product requirement.

- **Public:** Discoverable and accessible to readers.
- **Unlisted:** Accessible through a direct link, but excluded from public discovery.
- **Private:** Accessible only to the author and explicitly authorized systems.

The backend must enforce visibility and ownership rules on every relevant request. Frontend controls alone are not sufficient.

Additional requirements:

- Verify authentication tokens on the server.
- Never expose database credentials, service-role keys, or private API secrets in frontend code.
- Apply rate limits to publishing, responses, and other abuse-prone endpoints.
- Support reporting, blocking, and moderation.
- Ensure private or unlisted writing is excluded from public semantic-search indexes.
- Propagate deletion and visibility changes to any derived search indexes.

## Development Roadmap

### Phase 1 — Core Platform
- Establish the frontend and backend foundations.
- Implement personas and literary walls.
- Implement drafting, publishing, and public piece retrieval.
- Build the Commons feed and Piece Reader.
- Add visibility controls and authorization.

### Phase 2 — Reading and Organization
- Implement Discover and tag-based browsing.
- Add saved pieces and collections.
- Improve the writing and reading experience.
- Introduce reporting and blocking workflows.

### Phase 3 — Semantic Discovery
- Generate embeddings for eligible public writing.
- Store vectors using PostgreSQL with pgvector.
- Support semantic search and related-piece recommendations.
- Evaluate retrieval quality and enforce privacy boundaries.

### Phase 4 — MCP and AI Integration
- Introduce controlled MCP tools for public writing discovery.
- Support semantic queries over eligible public pieces.
- Add authenticated access to the user's own archive where appropriate.
- Require explicit confirmation for write operations such as creating drafts.
- Test authorization, privacy, and deletion behavior across all AI interfaces.

## Design Principles

- **Literary first:** Prioritize the writing and reading experience.
- **Pseudonymity:** Support expression without requiring a public real-world identity.
- **Intentional discovery:** Help readers find writing that resonates.
- **Quiet visual design:** Use warm paper tones, ink-black typography, muted sage, and oxide-red accents.
- **Privacy by design:** Enforce visibility rules throughout the application and its integrations.
- **Modular architecture:** Start with a Go modular monolith and avoid unnecessary microservices.

## Contributing

Varaq is currently under active development.

As the project evolves, contributions should preserve the separation between frontend presentation, backend business logic, and database access. API changes should be reflected in the OpenAPI specification.

## License

License to be determined.
